begin;

-- ============================================================
-- A5.8.1 — MANAGEMENT AUDIT DASHBOARD ACCESS
--
-- audit.view_management
--   Read-only organization-wide Outlet Audit monitoring.
--
-- Granted:
--   MANAGEMENT
--
-- BOD / ORG_ADMIN are already admin roles and therefore pass
-- application permission guards through isAdmin.
--
-- Explicitly NOT granted:
--   OUTLET_AUDITOR
-- ============================================================

do $$
declare
  v_org_id uuid;
  v_permission_id uuid;
  v_management_role_id uuid;
  v_count integer;
begin
  -- ----------------------------------------------------------
  -- Resolve organization from active OUTLET_AUDIT form
  -- ----------------------------------------------------------

  select f.organization_id
    into v_org_id
  from public.forms f
  where upper(f.code) = 'OUTLET_AUDIT'
    and f.operational_scope = 'restaurant'
    and f.is_active = true
  limit 1;

  if v_org_id is null then
    raise exception
      'A5.8.1 STOP: active OUTLET_AUDIT form not found.';
  end if;

  -- ----------------------------------------------------------
  -- Create / restore management audit permission
  -- ----------------------------------------------------------

  insert into public.permissions (
    organization_id,
    code,
    name,
    description,
    is_active
  )
  values (
    v_org_id,
    'audit.view_management',
    'View Audit Management Dashboard',
    'View organization-wide Outlet Audit scores, submitted audits, findings and severity summaries.',
    true
  )
  on conflict (
    organization_id,
    code
  )
  do update set
    name = excluded.name,
    description = excluded.description,
    is_active = true,
    updated_at = now();

  select p.id
    into v_permission_id
  from public.permissions p
  where p.organization_id = v_org_id
    and p.code = 'audit.view_management'
    and p.is_active = true
  limit 1;

  if v_permission_id is null then
    raise exception
      'A5.8.1 STOP: audit.view_management permission not available.';
  end if;

  -- ----------------------------------------------------------
  -- Resolve MANAGEMENT role exactly
  -- ----------------------------------------------------------

  select count(*)
    into v_count
  from public.roles r
  where r.organization_id = v_org_id
    and r.code = 'MANAGEMENT'
    and r.is_active = true;

  if v_count <> 1 then
    raise exception
      'A5.8.1 STOP: expected exactly one active MANAGEMENT role, found %.',
      v_count;
  end if;

  select r.id
    into v_management_role_id
  from public.roles r
  where r.organization_id = v_org_id
    and r.code = 'MANAGEMENT'
    and r.is_active = true
  limit 1;

  insert into public.role_permissions (
    role_id,
    permission_id,
    is_allowed
  )
  values (
    v_management_role_id,
    v_permission_id,
    true
  )
  on conflict (
    role_id,
    permission_id
  )
  do update set
    is_allowed = true,
    updated_at = now();

  -- ----------------------------------------------------------
  -- Safety: Outlet Auditor must never receive management view
  -- ----------------------------------------------------------

  if exists (
    select 1
    from public.role_permissions rp
    join public.roles r
      on r.id = rp.role_id
    where rp.permission_id = v_permission_id
      and rp.is_allowed = true
      and r.organization_id = v_org_id
      and r.code = 'OUTLET_AUDITOR'
  ) then
    raise exception
      'A5.8.1 POSTCHECK: OUTLET_AUDITOR must not receive audit.view_management.';
  end if;

  -- ----------------------------------------------------------
  -- Postcheck
  -- ----------------------------------------------------------

  if not exists (
    select 1
    from public.role_permissions rp
    where rp.role_id = v_management_role_id
      and rp.permission_id = v_permission_id
      and rp.is_allowed = true
  ) then
    raise exception
      'A5.8.1 POSTCHECK: MANAGEMENT permission assignment failed.';
  end if;
end
$$;

commit;
