begin;

-- ============================================================
-- ATOMIC OUTLET FORM VERSION ACTIVATION FOUNDATION
--
-- Activation is separate from publication. Only already-published
-- form versions can be assigned, and prior assignments remain as
-- append-only history.
-- ============================================================

create unique index if not exists outlet_form_assignments_one_active_per_outlet_form_idx
on public.outlet_form_assignments (outlet_id, form_id)
where is_active = true;

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
  v_version_status text;
  v_outlet_organization_id uuid;
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
    f.organization_id,
    fv.status
    into
    v_form_id,
    v_form_organization_id,
    v_version_status
  from public.form_versions fv
  join public.forms f
    on f.id = fv.form_id
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

  -- Lock order is always outlet first, then form. This serializes
  -- activation attempts for the outlet/form scope even when empty.
  select o.organization_id
    into v_outlet_organization_id
  from public.outlets o
  where o.id = p_outlet_id
  for update;

  if not found then
    raise exception
      'Outlet was not found.'
      using errcode = '22023';
  end if;

  perform 1
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

grant execute on function public.activate_outlet_form_version(uuid, uuid)
to authenticated;

-- Application assignment writes must use the locked activation RPC. SELECT
-- remains available through the existing RLS policies, and service_role
-- privileges are intentionally unchanged.
revoke insert, update, delete
on public.outlet_form_assignments
from authenticated;

commit;
