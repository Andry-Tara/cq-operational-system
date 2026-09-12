begin;

-- ============================================================
-- FORM / OUTLET OPERATIONAL SCOPE
--
-- This bootstrap classifies the existing production model, then makes
-- scope explicit for future forms and outlets. Activation remains the
-- existing atomic RPC; assignment history is not rewritten.
-- ============================================================

alter table public.outlets
  add column if not exists operational_scope text;

alter table public.forms
  add column if not exists operational_scope text;

update public.forms
set operational_scope = case
  when code in ('OPENING_CK', 'CLOSING_CK') then 'central_kitchen'
  when code in ('OPENING', 'CLOSING') then 'restaurant'
  else operational_scope
end
where operational_scope is null;

update public.outlets
set operational_scope = case
  when code = 'CNT' then 'central_kitchen'
  else 'restaurant'
end
where operational_scope is null;

do $$
begin
  if exists (
    select 1
    from public.forms
    where operational_scope is null
  ) then
    raise exception
      'Every form must have an operational scope before this migration can complete.';
  end if;

  if exists (
    select 1
    from public.outlets
    where operational_scope is null
  ) then
    raise exception
      'Every outlet must have an operational scope before this migration can complete.';
  end if;

  if exists (
    select 1
    from public.outlet_form_assignments ofa
    join public.outlets o
      on o.id = ofa.outlet_id
    join public.forms f
      on f.id = ofa.form_id
    where ofa.is_active = true
      and o.operational_scope is distinct from f.operational_scope
  ) then
    raise exception
      'Existing active assignment scope mismatch detected.';
  end if;
end;
$$;

alter table public.forms
  alter column operational_scope set not null;

alter table public.outlets
  alter column operational_scope set not null;

alter table public.forms
  drop constraint if exists forms_operational_scope_chk;

alter table public.forms
  add constraint forms_operational_scope_chk
  check (operational_scope in ('restaurant', 'central_kitchen'));

alter table public.outlets
  drop constraint if exists outlets_operational_scope_chk;

alter table public.outlets
  add constraint outlets_operational_scope_chk
  check (operational_scope in ('restaurant', 'central_kitchen'));

create or replace function public.activate_outlet_form_version(
  p_outlet_id uuid,
  p_form_version_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_form_id uuid;
  v_form_organization_id uuid;
  v_form_scope text;
  v_version_status text;
  v_outlet_organization_id uuid;
  v_outlet_scope text;
  v_current_assignment_id uuid;
  v_current_version_id uuid;
  v_new_assignment_id uuid;
begin
  if auth.uid() is null then
    raise exception
      'Authenticated caller is required.'
      using errcode = '28000';
  end if;

  select
    fv.form_id,
    fv.status
    into
    v_form_id,
    v_version_status
  from public.form_versions fv
  where fv.id = p_form_version_id;

  if not found then
    raise exception
      'Form version was not found.'
      using errcode = '22023';
  end if;

  if v_version_status is distinct from 'published' then
    raise exception
      'Only published form versions can be activated.'
      using errcode = '55000';
  end if;

  select
    o.organization_id,
    o.operational_scope
    into
    v_outlet_organization_id,
    v_outlet_scope
  from public.outlets o
  where o.id = p_outlet_id
  for update;

  if not found then
    raise exception
      'Outlet was not found.'
      using errcode = '22023';
  end if;

  select
    f.organization_id,
    f.operational_scope
    into
    v_form_organization_id,
    v_form_scope
  from public.forms f
  where f.id = v_form_id
  for update;

  if not found then
    raise exception
      'Form was not found.'
      using errcode = '22023';
  end if;

  if v_outlet_organization_id is distinct from v_form_organization_id then
    raise exception
      'Outlet and form belong to different organizations.'
      using errcode = '42501';
  end if;

  if v_outlet_scope is distinct from v_form_scope then
    raise exception
      'Outlet is not eligible for this form.'
      using errcode = '42501';
  end if;

  if public.has_org_permission(
    v_form_organization_id,
    'forms.manage'
  ) is distinct from true then
    raise exception
      'Not authorized to activate this form version.'
      using errcode = '42501';
  end if;

  select
    ofa.id,
    ofa.form_version_id
    into
    v_current_assignment_id,
    v_current_version_id
  from public.outlet_form_assignments ofa
  where ofa.outlet_id = p_outlet_id
    and ofa.form_id = v_form_id
    and ofa.is_active = true
  for update;

  if found and v_current_version_id = p_form_version_id then
    return v_current_assignment_id;
  end if;

  if found then
    update public.outlet_form_assignments
    set
      is_active = false,
      effective_until = current_date
    where id = v_current_assignment_id;
  end if;

  insert into public.outlet_form_assignments (
    outlet_id,
    form_id,
    form_version_id,
    is_active,
    effective_from,
    effective_until
  )
  values (
    p_outlet_id,
    v_form_id,
    p_form_version_id,
    true,
    current_date,
    null
  )
  returning id into v_new_assignment_id;

  return v_new_assignment_id;
end;
$$;

revoke all on function public.activate_outlet_form_version(uuid, uuid)
from public;

revoke all on function public.activate_outlet_form_version(uuid, uuid)
from anon;

revoke all on function public.activate_outlet_form_version(uuid, uuid)
from authenticated;

grant execute on function public.activate_outlet_form_version(uuid, uuid)
to authenticated;

-- Read-only preflight for existing active assignment scope consistency.
-- Run separately before applying this migration in the target database.
-- select count(*) as mismatches
-- from public.outlet_form_assignments ofa
-- join public.outlets o on o.id = ofa.outlet_id
-- join public.forms f on f.id = ofa.form_id
-- where ofa.is_active = true
--   and o.operational_scope is distinct from f.operational_scope;

commit;
