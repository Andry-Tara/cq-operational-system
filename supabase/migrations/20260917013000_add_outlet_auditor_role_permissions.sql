begin;

-- ============================================================
-- A4.5 — OUTLET AUDIT ACCESS FOUNDATION
--
-- Dedicated least-privilege role:
--   OUTLET_AUDITOR
--
-- Allowed:
--   dashboard.view
--   audit.submit
--   audit.reports.view
--
-- Explicitly NOT granted:
--   opening.submit
--   closing.submit
--   reports.view
--   reports.all_outlets
--   reports.reopen
--   admin.access
--   users.manage
--   permissions.manage
--   forms.manage
--   questions.manage
--
-- User -> outlet scope remains controlled by user_outlets.
-- No auditor user is created by this migration.
-- ============================================================

do $$
declare
  v_org_id uuid;
  v_role_id uuid;
  v_dashboard_permission_id uuid;
  v_audit_submit_permission_id uuid;
  v_audit_reports_view_permission_id uuid;
  v_count integer;
begin
  -- ----------------------------------------------------------
  -- 1. Resolve organization from OUTLET_AUDIT
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
      'A4.5 STOP: active OUTLET_AUDIT form not found.';
  end if;

  select count(*)
    into v_count
  from public.forms f
  where upper(f.code) = 'OUTLET_AUDIT'
    and f.operational_scope = 'restaurant'
    and f.is_active = true;

  if v_count <> 1 then
    raise exception
      'A4.5 STOP: expected exactly one active OUTLET_AUDIT form, found %.',
      v_count;
  end if;

  -- ----------------------------------------------------------
  -- 2. Ensure dedicated audit permissions
  -- ----------------------------------------------------------
  insert into public.permissions (
    organization_id,
    code,
    name,
    description,
    is_active
  )
  values
    (
      v_org_id,
      'audit.submit',
      'Submit Outlet Audit',
      'Create, edit and submit finding-only Outlet Audit sessions for assigned outlets.',
      true
    ),
    (
      v_org_id,
      'audit.reports.view',
      'View Audit Reports',
      'View Outlet Audit reports for outlets available to the user.',
      true
    )
  on conflict (organization_id, code)
  do update set
    name = excluded.name,
    description = excluded.description,
    is_active = true,
    updated_at = now();

  -- ----------------------------------------------------------
  -- 3. Existing dashboard permission is required
  -- ----------------------------------------------------------
  select p.id
    into v_dashboard_permission_id
  from public.permissions p
  where p.organization_id = v_org_id
    and p.code = 'dashboard.view'
    and p.is_active = true
  limit 1;

  if v_dashboard_permission_id is null then
    raise exception
      'A4.5 STOP: dashboard.view permission not found.';
  end if;

  select p.id
    into v_audit_submit_permission_id
  from public.permissions p
  where p.organization_id = v_org_id
    and p.code = 'audit.submit'
    and p.is_active = true
  limit 1;

  select p.id
    into v_audit_reports_view_permission_id
  from public.permissions p
  where p.organization_id = v_org_id
    and p.code = 'audit.reports.view'
    and p.is_active = true
  limit 1;

  if v_audit_submit_permission_id is null
     or v_audit_reports_view_permission_id is null then
    raise exception
      'A4.5 STOP: audit permissions were not created correctly.';
  end if;

  -- ----------------------------------------------------------
  -- 4. Dedicated OUTLET_AUDITOR role
  -- ----------------------------------------------------------
  insert into public.roles (
    organization_id,
    code,
    name,
    description,
    is_admin,
    is_active
  )
  values (
    v_org_id,
    'OUTLET_AUDITOR',
    'Outlet Auditor',
    'Finding-only outlet auditor. Outlet access is controlled through user_outlets.',
    false,
    true
  )
  on conflict (organization_id, code)
  do update set
    name = excluded.name,
    description = excluded.description,
    is_admin = false,
    is_active = true,
    updated_at = now()
  returning id
    into v_role_id;

  -- ----------------------------------------------------------
  -- 5. Least-privilege permission set
  -- ----------------------------------------------------------
  insert into public.role_permissions (
    role_id,
    permission_id,
    is_allowed
  )
  values
    (
      v_role_id,
      v_dashboard_permission_id,
      true
    ),
    (
      v_role_id,
      v_audit_submit_permission_id,
      true
    ),
    (
      v_role_id,
      v_audit_reports_view_permission_id,
      true
    )
  on conflict (role_id, permission_id)
  do update set
    is_allowed = true,
    updated_at = now();

  -- ----------------------------------------------------------
  -- 6. Remove any accidental/unwanted permissions
  --
  -- This makes OUTLET_AUDITOR deterministic and least privilege.
  -- ----------------------------------------------------------
  delete from public.role_permissions rp
  using public.permissions p
  where rp.permission_id = p.id
    and rp.role_id = v_role_id
    and p.organization_id = v_org_id
    and p.code not in (
      'dashboard.view',
      'audit.submit',
      'audit.reports.view'
    );

  -- ----------------------------------------------------------
  -- 7. Post-flight
  -- ----------------------------------------------------------
  select count(*)
    into v_count
  from public.role_permissions rp
  join public.permissions p
    on p.id = rp.permission_id
  where rp.role_id = v_role_id
    and rp.is_allowed = true
    and p.is_active = true;

  if v_count <> 3 then
    raise exception
      'A4.5 POSTCHECK: expected exactly 3 active allowed permissions for OUTLET_AUDITOR, found %.',
      v_count;
  end if;

  if exists (
    select 1
    from public.role_permissions rp
    join public.permissions p
      on p.id = rp.permission_id
    where rp.role_id = v_role_id
      and rp.is_allowed = true
      and p.code in (
        'opening.submit',
        'closing.submit',
        'reports.view',
        'reports.all_outlets',
        'reports.reopen',
        'admin.access',
        'users.manage',
        'permissions.manage',
        'forms.manage',
        'questions.manage'
      )
  ) then
    raise exception
      'A4.5 POSTCHECK: OUTLET_AUDITOR received a forbidden permission.';
  end if;

  if exists (
    select 1
    from public.roles r
    where r.id = v_role_id
      and r.is_admin = true
  ) then
    raise exception
      'A4.5 POSTCHECK: OUTLET_AUDITOR must never be admin.';
  end if;
end;
$$;

commit;
