begin;

-- ============================================================
-- FORM VERSION DRAFT-ONLY IMMUTABILITY
--
-- Published and archived version content is read-only at the database
-- layer. Intentional status transitions remain a future workflow.
-- Stable sections are shared form-level masters and are intentionally
-- outside this protection boundary.
-- ============================================================

create or replace function public.assert_form_version_draft(
  p_form_version_id uuid,
  p_allow_missing boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  version_status text;
begin
  select fv.status
    into version_status
  from public.form_versions fv
  where fv.id = p_form_version_id;

  if version_status is null then
    if p_allow_missing then
      return;
    end if;

    raise exception
      'Form version owner could not be resolved.'
      using errcode = '55000';
  end if;

  if version_status <> 'draft' then
    raise exception
      'Form version content is immutable unless the version is draft.'
      using errcode = '55000';
  end if;
end;
$$;

create or replace function public.enforce_form_version_content_draft()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  old_form_version_id uuid;
  new_form_version_id uuid;
begin
  if tg_op in ('DELETE', 'UPDATE') then
    case tg_table_name
      when 'form_version_sections' then
        select fvs.form_version_id
          into old_form_version_id
        from public.form_version_sections fvs
        where fvs.id = old.id;

      when 'form_version_section_translations' then
        select fvs.form_version_id
          into old_form_version_id
        from public.form_version_section_translations fvst
        join public.form_version_sections fvs
          on fvs.id = fvst.version_section_id
        where fvst.id = old.id;

      when 'question_groups' then
        select fvs.form_version_id
          into old_form_version_id
        from public.question_groups qg
        join public.form_version_sections fvs
          on fvs.id = qg.version_section_id
        where qg.id = old.id;

      when 'question_group_translations' then
        select fvs.form_version_id
          into old_form_version_id
        from public.question_group_translations qgt
        join public.question_groups qg
          on qg.id = qgt.question_group_id
        join public.form_version_sections fvs
          on fvs.id = qg.version_section_id
        where qgt.id = old.id;

      when 'questions' then
        select fvs.form_version_id
          into old_form_version_id
        from public.questions q
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where q.id = old.id;

      when 'question_translations' then
        select fvs.form_version_id
          into old_form_version_id
        from public.question_translations qt
        join public.questions q
          on q.id = qt.question_id
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where qt.id = old.id;

      when 'question_rules' then
        select fvs.form_version_id
          into old_form_version_id
        from public.question_rules qr
        join public.questions q
          on q.id = qr.question_id
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where qr.id = old.id;

      when 'question_options' then
        select fvs.form_version_id
          into old_form_version_id
        from public.question_options qo
        join public.questions q
          on q.id = qo.question_id
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where qo.id = old.id;

      when 'question_option_translations' then
        select fvs.form_version_id
          into old_form_version_id
        from public.question_option_translations qot
        join public.question_options qo
          on qo.id = qot.option_id
        join public.questions q
          on q.id = qo.question_id
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where qot.id = old.id;
    end case;

    perform public.assert_form_version_draft(
      old_form_version_id,
      tg_op = 'DELETE' and pg_trigger_depth() > 1
    );
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    case tg_table_name
      when 'form_version_sections' then
        new_form_version_id := new.form_version_id;

      when 'form_version_section_translations' then
        select fvs.form_version_id
          into new_form_version_id
        from public.form_version_sections fvs
        where fvs.id = new.version_section_id;

      when 'question_groups' then
        select fvs.form_version_id
          into new_form_version_id
        from public.form_version_sections fvs
        where fvs.id = new.version_section_id;

      when 'question_group_translations' then
        select fvs.form_version_id
          into new_form_version_id
        from public.question_groups qg
        join public.form_version_sections fvs
          on fvs.id = qg.version_section_id
        where qg.id = new.question_group_id;

      when 'questions' then
        select fvs.form_version_id
          into new_form_version_id
        from public.form_version_sections fvs
        where fvs.id = new.version_section_id;

      when 'question_translations' then
        select fvs.form_version_id
          into new_form_version_id
        from public.questions q
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where q.id = new.question_id;

      when 'question_rules' then
        select fvs.form_version_id
          into new_form_version_id
        from public.questions q
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where q.id = new.question_id;

      when 'question_options' then
        select fvs.form_version_id
          into new_form_version_id
        from public.questions q
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where q.id = new.question_id;

      when 'question_option_translations' then
        select fvs.form_version_id
          into new_form_version_id
        from public.question_options qo
        join public.questions q
          on q.id = qo.question_id
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where qo.id = new.option_id;
    end case;

    perform public.assert_form_version_draft(new_form_version_id);
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create or replace function public.prevent_form_version_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.status is distinct from old.status then
    raise exception
      'Form version status transitions require the controlled version workflow.'
      using errcode = '55000';
  end if;

  if old.status is distinct from 'draft' then
    raise exception
      'Published or archived form versions are immutable.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_published_form_version_delete()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from 'draft' then
    raise exception
      'Published or archived form versions cannot be deleted.'
      using errcode = '55000';
  end if;

  return old;
end;
$$;

revoke execute on function public.assert_form_version_draft(uuid, boolean)
from public;

revoke execute on function public.enforce_form_version_content_draft()
from public;

revoke execute on function public.prevent_published_form_version_delete()
from public;

revoke execute on function public.prevent_form_version_update()
from public;

drop trigger if exists form_versions_prevent_direct_update
on public.form_versions;

create trigger form_versions_prevent_direct_update
before update on public.form_versions
for each row
execute function public.prevent_form_version_update();

-- The parent guard fires before any ON DELETE CASCADE child activity.
drop trigger if exists form_versions_prevent_non_draft_delete
on public.form_versions;

create trigger form_versions_prevent_non_draft_delete
before delete on public.form_versions
for each row
execute function public.prevent_published_form_version_delete();

-- Version-owned content is mutable only while its owning version is draft.
DO $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'form_version_sections',
    'form_version_section_translations',
    'question_groups',
    'question_group_translations',
    'questions',
    'question_translations',
    'question_rules',
    'question_options',
    'question_option_translations'
  ]
  loop
    execute format(
      'drop trigger if exists %I on public.%I',
      table_name || '_enforce_draft',
      table_name
    );

    execute format(
      'create trigger %I before insert or update or delete on public.%I for each row execute function public.enforce_form_version_content_draft()',
      table_name || '_enforce_draft',
      table_name
    );
  end loop;
end;
$$;

commit;
