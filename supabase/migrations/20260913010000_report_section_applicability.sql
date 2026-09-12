begin;

-- ============================================================
-- DAILY REPORT SECTION APPLICABILITY
--
-- This state belongs to an individual report section, not to the form
-- version. Existing report answers and evidence remain untouched.
-- ============================================================

alter table public.report_sections
  add column if not exists applicability_status text not null default 'active';

alter table public.report_sections
  add column if not exists no_production_reason text;

alter table public.report_sections
  add column if not exists no_production_marked_by uuid;

alter table public.report_sections
  add column if not exists no_production_marked_at timestamptz;

alter table public.report_sections
  drop constraint if exists report_sections_applicability_status_chk;

alter table public.report_sections
  add constraint report_sections_applicability_status_chk
  check (applicability_status in ('active', 'no_production'));

alter table public.report_sections
  drop constraint if exists report_sections_applicability_consistency_chk;

alter table public.report_sections
  add constraint report_sections_applicability_consistency_chk
  check (
    (
      applicability_status = 'active'
      and no_production_reason is null
      and no_production_marked_by is null
      and no_production_marked_at is null
    )
    or (
      applicability_status = 'no_production'
      and no_production_reason is not null
      and btrim(no_production_reason) <> ''
      and no_production_marked_by is not null
      and no_production_marked_at is not null
    )
  );

alter table public.report_sections
  drop constraint if exists report_sections_no_production_marked_by_fkey;

alter table public.report_sections
  add constraint report_sections_no_production_marked_by_fkey
  foreign key (no_production_marked_by)
  references public.profiles(id)
  on delete restrict;

create or replace function public.enforce_report_section_applicability()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_organization_id uuid;
  v_outlet_id uuid;
  v_form_id uuid;
  v_report_form_version_id uuid;
  v_area_code text;
  v_finalization_area_code text;
begin
  if tg_op = 'INSERT' then
    if new.applicability_status is not distinct from 'active'
       and new.no_production_reason is null
       and new.no_production_marked_by is null
       and new.no_production_marked_at is null then
      return new;
    end if;

    raise exception
      'Report section no-production state must be set through the controlled workflow.'
      using errcode = '55000';
  end if;

  if new.applicability_status is not distinct from old.applicability_status
     and new.no_production_reason is not distinct from old.no_production_reason
     and new.no_production_marked_by is not distinct from old.no_production_marked_by
     and new.no_production_marked_at is not distinct from old.no_production_marked_at then
    return new;
  end if;

  if auth.uid() is null then
    raise exception
      'Authenticated caller is required.'
      using errcode = '28000';
  end if;

  if new.id is distinct from old.id
     or new.report_id is distinct from old.report_id
     or new.section_id is distinct from old.section_id
     or new.version_section_id is distinct from old.version_section_id
     or new.status is distinct from old.status then
    raise exception
      'Applicability changes cannot alter report section identity or workflow status.'
      using errcode = '55000';
  end if;

  if old.status not in (
    'pending',
    'in_progress',
    'reopened',
    'needs_correction'
  ) then
    raise exception
      'Report section applicability is not editable in its current workflow state.'
      using errcode = '55000';
  end if;

  select
    r.organization_id,
    r.outlet_id,
    r.form_id,
    r.form_version_id,
    s.area_code
    into
    v_organization_id,
    v_outlet_id,
    v_form_id,
    v_report_form_version_id,
    v_area_code
  from public.reports r
  join public.sections s
    on s.id = old.section_id
  where r.id = old.report_id;

  if not found then
    raise exception
      'Report context could not be resolved.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.form_version_sections fvs
    where fvs.id = old.version_section_id
      and fvs.section_id = old.section_id
      and fvs.form_version_id = v_report_form_version_id
  ) then
    raise exception
      'Report section does not belong to the report version.'
      using errcode = '22023';
  end if;

  if public.is_org_admin(v_organization_id) is distinct from true
     and public.has_section_permission(
       v_outlet_id,
       v_form_id,
       old.section_id,
       'fill'
     ) is distinct from true
     and public.has_section_permission(
       v_outlet_id,
       v_form_id,
       old.section_id,
       'submit'
     ) is distinct from true then
    raise exception
      'Not authorized to change report section applicability.'
      using errcode = '42501';
  end if;

  if v_area_code = 'PRODUCTION' then
    v_finalization_area_code := 'PRODUCTION';
  elsif v_area_code = 'STORE' then
    v_finalization_area_code := 'WAREHOUSE';
  else
    v_finalization_area_code := null;
  end if;

  if v_finalization_area_code is not null
     and exists (
       select 1
       from public.report_area_finalizations raf
       where raf.report_id = old.report_id
         and raf.area_code = v_finalization_area_code
     ) then
    raise exception
      'Report section applicability cannot change after its area is finalized.'
      using errcode = '55000';
  end if;

  if new.applicability_status = 'no_production' then
    if new.no_production_reason is null
       or btrim(new.no_production_reason) = '' then
      raise exception
        'A reason is required when production is not scheduled.'
        using errcode = '22023';
    end if;

    new.no_production_reason := btrim(new.no_production_reason);
    new.no_production_marked_by := auth.uid();
    new.no_production_marked_at := now();
  elsif new.applicability_status = 'active' then
    new.no_production_reason := null;
    new.no_production_marked_by := null;
    new.no_production_marked_at := null;
  else
    raise exception
      'Invalid report section applicability status.'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

drop trigger if exists report_sections_enforce_applicability
on public.report_sections;

create trigger report_sections_enforce_applicability
before insert or update on public.report_sections
for each row
execute function public.enforce_report_section_applicability();

create or replace function public.set_report_section_applicability(
  p_report_id uuid,
  p_version_section_id uuid,
  p_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_report_section_id uuid;
  v_section_id uuid;
  v_current_status text;
  v_outlet_id uuid;
  v_form_id uuid;
  v_report_form_version_id uuid;
  v_organization_id uuid;
  v_version_section_form_version_id uuid;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception
      'Authenticated caller is required.'
      using errcode = '28000';
  end if;

  if p_status is null
     or p_status not in ('active', 'no_production') then
    raise exception
      'Invalid report section applicability status.'
      using errcode = '22023';
  end if;

  select
    rs.id,
    rs.section_id,
    rs.status,
    r.outlet_id,
    r.form_id,
    r.form_version_id,
    f.organization_id
    into
    v_report_section_id,
    v_section_id,
    v_current_status,
    v_outlet_id,
    v_form_id,
    v_report_form_version_id,
    v_organization_id
  from public.report_sections rs
  join public.reports r
    on r.id = rs.report_id
  join public.forms f
    on f.id = r.form_id
  where rs.report_id = p_report_id
    and rs.version_section_id = p_version_section_id
  for update of rs;

  if not found then
    raise exception
      'Report section was not found.'
      using errcode = '22023';
  end if;

  select fvs.form_version_id
    into v_version_section_form_version_id
  from public.form_version_sections fvs
  where fvs.id = p_version_section_id
    and fvs.section_id = v_section_id;

  if not found
     or v_version_section_form_version_id is distinct from v_report_form_version_id then
    raise exception
      'Report section does not belong to the report version.'
      using errcode = '22023';
  end if;

  if v_current_status not in (
    'pending',
    'in_progress',
    'reopened',
    'needs_correction'
  ) then
    raise exception
      'Report section is not editable in its current workflow state.'
      using errcode = '55000';
  end if;

  if public.is_org_admin(v_organization_id) is distinct from true
     and public.has_section_permission(
       v_outlet_id,
       v_form_id,
       v_section_id,
       'fill'
     ) is distinct from true
     and public.has_section_permission(
       v_outlet_id,
       v_form_id,
       v_section_id,
       'submit'
     ) is distinct from true then
    raise exception
      'Not authorized to change report section applicability.'
      using errcode = '42501';
  end if;

  if p_status = 'no_production' then
    v_reason := btrim(coalesce(p_reason, ''));

    if v_reason = '' then
      raise exception
        'A reason is required when production is not scheduled.'
        using errcode = '22023';
    end if;

    update public.report_sections
    set
      applicability_status = 'no_production',
      no_production_reason = v_reason,
      no_production_marked_by = auth.uid(),
      no_production_marked_at = now()
    where id = v_report_section_id;
  else
    update public.report_sections
    set
      applicability_status = 'active',
      no_production_reason = null,
      no_production_marked_by = null,
      no_production_marked_at = null
    where id = v_report_section_id;
  end if;
end;
$$;

revoke all on function public.enforce_report_section_applicability()
from public;

revoke all on function public.enforce_report_section_applicability()
from anon;

revoke all on function public.enforce_report_section_applicability()
from authenticated;

revoke all on function public.set_report_section_applicability(uuid, uuid, text, text)
from public;

revoke all on function public.set_report_section_applicability(uuid, uuid, text, text)
from anon;

revoke all on function public.set_report_section_applicability(uuid, uuid, text, text)
from authenticated;

grant execute on function public.set_report_section_applicability(uuid, uuid, text, text)
to authenticated;

commit;
