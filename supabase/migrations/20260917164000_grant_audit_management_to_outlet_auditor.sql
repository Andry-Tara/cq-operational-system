begin;

-- ============================================================
-- OUTLET AUDITOR — MANAGEMENT AUDIT VIEW
--
-- Auditor may:
--   submit Outlet Audit
--   view own audit reports
--   view Management Audit Dashboard
--
-- Auditor remains:
--   non-admin
--   no opening/closing submit
--   no general management/admin permissions
-- ============================================================

do $$
declare
  v_org_id uuid;
  v_role_id uuid;
  v_permission_id uuid;
begin
  select f.organization_id
    into v_org_id
  from public.forms f
  where upper(f.code) = 'OUTLET_AUDIT'
    and f.is_active = true
  limit 1;

  if v_org_id is null then
    raise exception
      'AUDITOR MANAGEMENT STOP: organization not found.';
  end if;

  select r.id
    into v_role_id
  from public.roles r
  where r.organization_id = v_org_id
    and r.code = 'OUTLET_AUDITOR'
    and r.is_active = true
  limit 1;

  if v_role_id is null then
    raise exception
      'AUDITOR MANAGEMENT STOP: OUTLET_AUDITOR role not found.';
  end if;

  select p.id
    into v_permission_id
  from public.permissions p
  where p.organization_id = v_org_id
    and p.code = 'audit.view_management'
    and p.is_active = true
  limit 1;

  if v_permission_id is null then
    raise exception
      'AUDITOR MANAGEMENT STOP: audit.view_management permission not found.';
  end if;

  insert into public.role_permissions (
    role_id,
    permission_id,
    is_allowed
  )
  values (
    v_role_id,
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

  -- Auditor must remain non-admin.
  if exists (
    select 1
    from public.roles r
    where r.id = v_role_id
      and r.is_admin = true
  ) then
    raise exception
      'AUDITOR MANAGEMENT POSTCHECK: OUTLET_AUDITOR must not be admin.';
  end if;

  if not exists (
    select 1
    from public.role_permissions rp
    where rp.role_id = v_role_id
      and rp.permission_id = v_permission_id
      and rp.is_allowed = true
  ) then
    raise exception
      'AUDITOR MANAGEMENT POSTCHECK: management permission missing.';
  end if;
end
$$;

commit;
