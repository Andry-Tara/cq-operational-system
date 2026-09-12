begin;

-- ============================================================
-- DRAFT FORM BUILDER MUTATION RPC FOUNDATION
--
-- These functions expose only draft-owned, allowlisted mutations.
-- Structural identity, status, version allocation, rules, and
-- applicability are intentionally outside this phase.
-- ============================================================

create or replace function public.has_org_permission(
  p_organization_id uuid,
  p_permission_code text
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id = p_organization_id
      and p.is_active is distinct from false
      and (
        exists (
          select 1
          from public.user_roles ur
          join public.roles r
            on r.id = ur.role_id
          where ur.user_id = p.id
            and r.is_active is distinct from false
            and r.is_admin = true
        )
        or exists (
          select 1
          from public.user_roles ur
          join public.roles r
            on r.id = ur.role_id
          join public.role_permissions rp
            on rp.role_id = r.id
          join public.permissions permission
            on permission.id = rp.permission_id
          where ur.user_id = p.id
            and r.is_active is distinct from false
            and rp.is_allowed = true
            and permission.code = p_permission_code
            and permission.is_active is distinct from false
        )
      )
  );
$$;

create or replace function public.assert_draft_form_version_access(
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
      'Not authorized to modify this form version.'
      using errcode = '42501';
  end if;

  if v_status is distinct from 'draft' then
    raise exception
      'Form version is not editable.'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function public.update_draft_form_version(
  p_form_version_id uuid,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception
      'Authenticated caller is required.'
      using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(
    p_form_version_id
  );

  update public.form_versions fv
  set notes = p_notes
  where fv.id = p_form_version_id;
end;
$$;

create or replace function public.update_draft_form_version_section(
  p_form_version_id uuid,
  p_version_section_id uuid,
  p_display_name text,
  p_description text,
  p_sort_order integer,
  p_is_required boolean,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception
      'Authenticated caller is required.'
      using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(
    p_form_version_id
  );

    if p_display_name is null
      or p_sort_order is null
      or p_is_required is null
      or p_is_active is null
     or btrim(p_display_name) = ''
     or p_sort_order < 0 then
    raise exception
      'Invalid form section values.'
      using errcode = '22023';
  end if;

  update public.form_version_sections fvs
  set
    display_name = p_display_name,
    description = p_description,
    sort_order = p_sort_order,
    is_required = p_is_required,
    is_active = p_is_active
  where fvs.id = p_version_section_id
    and fvs.form_version_id = p_form_version_id;

  if not found then
    raise exception
      'Form section was not found in this form version.'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.update_draft_question_group(
  p_form_version_id uuid,
  p_question_group_id uuid,
  p_name text,
  p_sort_order integer,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception
      'Authenticated caller is required.'
      using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(
    p_form_version_id
  );

    if p_name is null
      or p_sort_order is null
      or p_is_active is null
     or btrim(p_name) = ''
     or p_sort_order < 0 then
    raise exception
      'Invalid question group values.'
      using errcode = '22023';
  end if;

  update public.question_groups qg
  set
    name = p_name,
    sort_order = p_sort_order,
    is_active = p_is_active
  from public.form_version_sections fvs
  where qg.id = p_question_group_id
    and qg.version_section_id = fvs.id
    and fvs.form_version_id = p_form_version_id;

  if not found then
    raise exception
      'Question group was not found in this form version.'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.update_draft_question(
  p_form_version_id uuid,
  p_question_id uuid,
  p_question_text text,
  p_help_text text,
  p_is_required boolean,
  p_unit text,
  p_min_value numeric,
  p_max_value numeric,
  p_placeholder text,
  p_sort_order integer,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception
      'Authenticated caller is required.'
      using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(
    p_form_version_id
  );

    if p_question_text is null
      or p_is_required is null
      or p_sort_order is null
      or p_is_active is null
     or btrim(p_question_text) = ''
     or p_sort_order < 0 then
    raise exception
      'Invalid question values.'
      using errcode = '22023';
  end if;

  if p_min_value is not null
     and p_max_value is not null
     and p_min_value > p_max_value then
    raise exception
      'Question minimum cannot exceed maximum.'
      using errcode = '22023';
  end if;

  update public.questions q
  set
    question_text = p_question_text,
    help_text = p_help_text,
    is_required = p_is_required,
    unit = p_unit,
    min_value = p_min_value,
    max_value = p_max_value,
    placeholder = p_placeholder,
    sort_order = p_sort_order,
    is_active = p_is_active
  from public.form_version_sections fvs
  where q.id = p_question_id
    and q.version_section_id = fvs.id
    and fvs.form_version_id = p_form_version_id;

  if not found then
    raise exception
      'Question was not found in this form version.'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.update_draft_question_option(
  p_form_version_id uuid,
  p_option_id uuid,
  p_label text,
  p_sort_order integer,
  p_is_failure boolean
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception
      'Authenticated caller is required.'
      using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(
    p_form_version_id
  );

    if p_label is null
      or p_sort_order is null
      or p_is_failure is null
     or btrim(p_label) = ''
     or p_sort_order < 0 then
    raise exception
      'Invalid question option values.'
      using errcode = '22023';
  end if;

  update public.question_options qo
  set
    label = p_label,
    sort_order = p_sort_order,
    is_failure = p_is_failure
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where qo.id = p_option_id
    and qo.question_id = q.id
    and fvs.form_version_id = p_form_version_id;

  if not found then
    raise exception
      'Question option was not found in this form version.'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.upsert_draft_section_translation(
  p_form_version_id uuid,
  p_version_section_id uuid,
  p_locale text,
  p_display_name text,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception
      'Authenticated caller is required.'
      using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(
    p_form_version_id
  );

  if p_locale is null
     or p_locale not in ('en', 'id-ID')
     or p_display_name is null
     or btrim(p_display_name) = '' then
    raise exception
      'Invalid section translation values.'
      using errcode = '22023';
  end if;

  insert into public.form_version_section_translations (
    version_section_id,
    locale,
    display_name,
    description
  )
  select
    fvs.id,
    p_locale,
    p_display_name,
    p_description
  from public.form_version_sections fvs
  where fvs.id = p_version_section_id
    and fvs.form_version_id = p_form_version_id
  on conflict (version_section_id, locale)
  do update set
    display_name = excluded.display_name,
    description = excluded.description;

  if not found then
    raise exception
      'Form section was not found in this form version.'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.upsert_draft_group_translation(
  p_form_version_id uuid,
  p_question_group_id uuid,
  p_locale text,
  p_display_name text,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception
      'Authenticated caller is required.'
      using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(
    p_form_version_id
  );

  if p_locale is null
     or p_locale not in ('en', 'id-ID')
     or p_display_name is null
     or btrim(p_display_name) = '' then
    raise exception
      'Invalid group translation values.'
      using errcode = '22023';
  end if;

  insert into public.question_group_translations (
    question_group_id,
    locale,
    display_name,
    description
  )
  select
    qg.id,
    p_locale,
    p_display_name,
    p_description
  from public.question_groups qg
  join public.form_version_sections fvs
    on fvs.id = qg.version_section_id
  where qg.id = p_question_group_id
    and fvs.form_version_id = p_form_version_id
  on conflict (question_group_id, locale)
  do update set
    display_name = excluded.display_name,
    description = excluded.description;

  if not found then
    raise exception
      'Question group was not found in this form version.'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.upsert_draft_question_translation(
  p_form_version_id uuid,
  p_question_id uuid,
  p_locale text,
  p_question_text text,
  p_help_text text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception
      'Authenticated caller is required.'
      using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(
    p_form_version_id
  );

  if p_locale is null
     or p_locale not in ('en', 'id-ID')
     or p_question_text is null
     or btrim(p_question_text) = '' then
    raise exception
      'Invalid question translation values.'
      using errcode = '22023';
  end if;

  insert into public.question_translations (
    question_id,
    locale,
    question_text,
    help_text
  )
  select
    q.id,
    p_locale,
    p_question_text,
    p_help_text
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where q.id = p_question_id
    and fvs.form_version_id = p_form_version_id
  on conflict (question_id, locale)
  do update set
    question_text = excluded.question_text,
    help_text = excluded.help_text;

  if not found then
    raise exception
      'Question was not found in this form version.'
      using errcode = '22023';
  end if;
end;
$$;

create or replace function public.upsert_draft_option_translation(
  p_form_version_id uuid,
  p_option_id uuid,
  p_locale text,
  p_label text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception
      'Authenticated caller is required.'
      using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(
    p_form_version_id
  );

  if p_locale is null
     or p_locale not in ('en', 'id-ID')
     or p_label is null
     or btrim(p_label) = '' then
    raise exception
      'Invalid option translation values.'
      using errcode = '22023';
  end if;

  insert into public.question_option_translations (
    option_id,
    locale,
    label
  )
  select
    qo.id,
    p_locale,
    p_label
  from public.question_options qo
  join public.questions q
    on q.id = qo.question_id
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where qo.id = p_option_id
    and fvs.form_version_id = p_form_version_id
  on conflict (option_id, locale)
  do update set
    label = excluded.label;

  if not found then
    raise exception
      'Question option was not found in this form version.'
      using errcode = '22023';
  end if;
end;
$$;

revoke all on function public.has_org_permission(uuid, text)
from public;

revoke all on function public.assert_draft_form_version_access(uuid)
from public;

revoke all on function public.update_draft_form_version(uuid, text)
from public;

revoke all on function public.update_draft_form_version_section(uuid, uuid, text, text, integer, boolean, boolean)
from public;

revoke all on function public.update_draft_question_group(uuid, uuid, text, integer, boolean)
from public;

revoke all on function public.update_draft_question(uuid, uuid, text, text, boolean, text, numeric, numeric, text, integer, boolean)
from public;

revoke all on function public.update_draft_question_option(uuid, uuid, text, integer, boolean)
from public;

revoke all on function public.upsert_draft_section_translation(uuid, uuid, text, text, text)
from public;

revoke all on function public.upsert_draft_group_translation(uuid, uuid, text, text, text)
from public;

revoke all on function public.upsert_draft_question_translation(uuid, uuid, text, text, text)
from public;

revoke all on function public.upsert_draft_option_translation(uuid, uuid, text, text)
from public;

revoke all on function public.has_org_permission(uuid, text)
from anon, authenticated;

revoke all on function public.assert_draft_form_version_access(uuid)
from anon, authenticated;

revoke all on function public.update_draft_form_version(uuid, text)
from anon;

revoke all on function public.update_draft_form_version_section(uuid, uuid, text, text, integer, boolean, boolean)
from anon;

revoke all on function public.update_draft_question_group(uuid, uuid, text, integer, boolean)
from anon;

revoke all on function public.update_draft_question(uuid, uuid, text, text, boolean, text, numeric, numeric, text, integer, boolean)
from anon;

revoke all on function public.update_draft_question_option(uuid, uuid, text, integer, boolean)
from anon;

revoke all on function public.upsert_draft_section_translation(uuid, uuid, text, text, text)
from anon;

revoke all on function public.upsert_draft_group_translation(uuid, uuid, text, text, text)
from anon;

revoke all on function public.upsert_draft_question_translation(uuid, uuid, text, text, text)
from anon;

revoke all on function public.upsert_draft_option_translation(uuid, uuid, text, text)
from anon;

grant execute on function public.update_draft_form_version(uuid, text)
to authenticated;

grant execute on function public.update_draft_form_version_section(uuid, uuid, text, text, integer, boolean, boolean)
to authenticated;

grant execute on function public.update_draft_question_group(uuid, uuid, text, integer, boolean)
to authenticated;

grant execute on function public.update_draft_question(uuid, uuid, text, text, boolean, text, numeric, numeric, text, integer, boolean)
to authenticated;

grant execute on function public.update_draft_question_option(uuid, uuid, text, integer, boolean)
to authenticated;

grant execute on function public.upsert_draft_section_translation(uuid, uuid, text, text, text)
to authenticated;

grant execute on function public.upsert_draft_group_translation(uuid, uuid, text, text, text)
to authenticated;

grant execute on function public.upsert_draft_question_translation(uuid, uuid, text, text, text)
to authenticated;

grant execute on function public.upsert_draft_option_translation(uuid, uuid, text, text)
to authenticated;

commit;
