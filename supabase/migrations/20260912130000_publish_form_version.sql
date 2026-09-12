begin;

-- ============================================================
-- CONTROLLED FORM VERSION PUBLISH FOUNDATION
--
-- Publishing is the only lifecycle transition introduced here.
-- The existing form_versions_prevent_direct_update trigger remains
-- installed and is given an explicit draft -> published branch.
-- ============================================================

create or replace function public.assert_form_version_publishable(
  p_form_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_has_active_section boolean;
  v_has_active_question boolean;
begin
  select fv.status
    into v_status
  from public.form_versions fv
  where fv.id = p_form_version_id;

  if not found then
    raise exception
      'Form version was not found.'
      using errcode = '22023';
  end if;

  if v_status is distinct from 'draft' then
    raise exception
      'Only draft form versions can be published.'
      using errcode = '55000';
  end if;

  if exists (
    select 1
    from public.form_version_sections fvs
    where fvs.form_version_id = p_form_version_id
      and fvs.is_active is distinct from false
      and (
        fvs.display_name is null
        or btrim(fvs.display_name) = ''
      )
  ) then
    raise exception
      'Active form sections require canonical display names.'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.form_version_sections fvs
    where fvs.form_version_id = p_form_version_id
      and fvs.is_active is distinct from false
  )
    into v_has_active_section;

  if v_has_active_section is distinct from true then
    raise exception
      'At least one active form section is required before publishing.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.question_groups qg
    join public.form_version_sections fvs
      on fvs.id = qg.version_section_id
    where fvs.form_version_id = p_form_version_id
      and fvs.is_active is distinct from false
      and qg.is_active is distinct from false
      and (
        qg.name is null
        or btrim(qg.name) = ''
      )
  ) then
    raise exception
      'Active question groups require canonical names.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where fvs.form_version_id = p_form_version_id
      and q.question_group_id is not null
      and not exists (
        select 1
        from public.question_groups qg
        where qg.id = q.question_group_id
          and qg.version_section_id = q.version_section_id
      )
  ) then
    raise exception
      'Question group ownership is structurally invalid.'
      using errcode = '22023';
  end if;

  select exists (
    select 1
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where fvs.form_version_id = p_form_version_id
      and fvs.is_active is distinct from false
      and q.is_active is distinct from false
  )
    into v_has_active_question;

  if v_has_active_question is distinct from true then
    raise exception
      'At least one active question in an active section is required before publishing.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where fvs.form_version_id = p_form_version_id
      and fvs.is_active is distinct from false
      and q.is_active is distinct from false
      and (
        q.question_text is null
        or btrim(q.question_text) = ''
      )
  ) then
    raise exception
      'Active questions require canonical question text.'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.prevent_form_version_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from 'draft' then
    raise exception
      'Published or archived form versions are immutable.'
      using errcode = '55000';
  end if;

    if new.id is distinct from old.id
      or new.form_id is distinct from old.form_id
     or new.version_number is distinct from old.version_number then
    raise exception
      'Form version identity is immutable.'
      using errcode = '55000';
  end if;

  if old.status = 'draft'
     and new.status = 'published' then
    if new.notes is distinct from old.notes then
      raise exception
        'Publishing cannot modify form version notes.'
        using errcode = '55000';
    end if;

    perform public.assert_form_version_publishable(old.id);
    new.published_at := now();
    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception
      'Form version status transitions require the controlled version workflow.'
      using errcode = '55000';
  end if;

  if new.published_at is distinct from old.published_at then
    raise exception
      'Publication timestamp is lifecycle-managed.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function public.publish_form_version(
  p_form_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception
      'Authenticated caller is required.'
      using errcode = '28000';
  end if;

  select
    f.organization_id,
    fv.status
    into
    v_organization_id,
    v_status
  from public.form_versions fv
  join public.forms f
    on f.id = fv.form_id
  where fv.id = p_form_version_id
  for update of fv;

  if not found then
    raise exception
      'Form version was not found.'
      using errcode = '22023';
  end if;

  if public.has_org_permission(
    v_organization_id,
    'forms.manage'
  ) is distinct from true then
    raise exception
      'Not authorized to publish this form version.'
      using errcode = '42501';
  end if;

  if v_status is distinct from 'draft' then
    raise exception
      'Only draft form versions can be published.'
      using errcode = '55000';
  end if;

  perform public.assert_form_version_publishable(
    p_form_version_id
  );

  update public.form_versions fv
  set status = 'published'
  where fv.id = p_form_version_id;
end;
$$;

revoke all on function public.assert_form_version_publishable(uuid)
from public;

revoke all on function public.assert_form_version_publishable(uuid)
from anon, authenticated;

revoke all on function public.publish_form_version(uuid)
from public;

revoke all on function public.publish_form_version(uuid)
from anon;

grant execute on function public.publish_form_version(uuid)
to authenticated;

commit;
