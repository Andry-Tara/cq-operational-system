begin;

-- ============================================================
-- BOD ACCESS HARDENING
--
-- BOD is an executive read-only role.
-- ORG_ADMIN remains the actual superuser role.
--
-- BOD allowed:
--   dashboard.view
--   reports.view
--   reports.all_outlets
--   audit.view_management
--
-- BOD must NOT receive operational/admin write privileges.
-- ============================================================

do $$
declare
  v_org_id uuid;
  v_bod_role_id uuid;
  v_permission_id uuid;
  v_code text;
  v_count integer;
begin
  -- ----------------------------------------------------------
  -- Resolve organization
  -- ----------------------------------------------------------

  select f.organization_id
    into v_org_id
  from public.forms f
  where upper(f.code) = 'OUTLET_AUDIT'
    and f.is_active = true
  limit 1;

  if v_org_id is null then
    raise exception
      'BOD ACCESS STOP: organization could not be resolved.';
  end if;

  -- ----------------------------------------------------------
  -- Resolve BOD role exactly
  -- ----------------------------------------------------------

  select count(*)
    into v_count
  from public.roles r
  where r.organization_id = v_org_id
    and r.code = 'BOD'
    and r.is_active = true;

  if v_count <> 1 then
    raise exception
      'BOD ACCESS STOP: expected exactly one active BOD role, found %.',
      v_count;
  end if;

  select r.id
    into v_bod_role_id
  from public.roles r
  where r.organization_id = v_org_id
    and r.code = 'BOD'
    and r.is_active = true
  limit 1;

  -- ----------------------------------------------------------
  -- BOD IS NOT SUPERUSER
  -- ----------------------------------------------------------

  update public.roles
  set
    is_admin = false,
    updated_at = now()
  where id = v_bod_role_id;

  -- ----------------------------------------------------------
  -- Required read-only permissions
  -- ----------------------------------------------------------

  foreach v_code in array array[
    'dashboard.view',
    'reports.view',
    'reports.all_outlets',
    'audit.view_management'
  ]
  loop
    select p.id
      into v_permission_id
    from public.permissions p
    where p.organization_id = v_org_id
      and p.code = v_code
      and p.is_active = true
    limit 1;

    if v_permission_id is null then
      raise exception
        'BOD ACCESS STOP: required permission % not found.',
        v_code;
    end if;

    insert into public.role_permissions (
      role_id,
      permission_id,
      is_allowed
    )
    values (
      v_bod_role_id,
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
  end loop;

  -- ----------------------------------------------------------
  -- Remove explicit write/admin permissions if any exist.
  --
  -- Important because once is_admin=false, explicit role
  -- permissions become authoritative.
  -- ----------------------------------------------------------

  delete from public.role_permissions rp
  using public.permissions p
  where rp.permission_id = p.id
    and rp.role_id = v_bod_role_id
    and p.organization_id = v_org_id
    and p.code in (
      'opening.submit',
      'closing.submit',
      'audit.submit',
      'reports.reopen',
      'admin.access',
      'users.manage',
      'permissions.manage',
      'forms.manage',
      'questions.manage'
    );

  -- ----------------------------------------------------------
  -- Postchecks
  -- ----------------------------------------------------------

  if exists (
    select 1
    from public.roles r
    where r.id = v_bod_role_id
      and r.is_admin = true
  ) then
    raise exception
      'BOD ACCESS POSTCHECK: BOD must not be admin.';
  end if;

  select count(*)
    into v_count
  from public.role_permissions rp
  join public.permissions p
    on p.id = rp.permission_id
  where rp.role_id = v_bod_role_id
    and rp.is_allowed = true
    and p.is_active = true
    and p.code in (
      'dashboard.view',
      'reports.view',
      'reports.all_outlets',
      'audit.view_management'
    );

  if v_count <> 4 then
    raise exception
      'BOD ACCESS POSTCHECK: expected 4 executive read permissions, found %.',
      v_count;
  end if;

  if exists (
    select 1
    from public.role_permissions rp
    join public.permissions p
      on p.id = rp.permission_id
    where rp.role_id = v_bod_role_id
      and rp.is_allowed = true
      and p.code in (
        'opening.submit',
        'closing.submit',
        'audit.submit',
        'reports.reopen',
        'admin.access',
        'users.manage',
        'permissions.manage',
        'forms.manage',
        'questions.manage'
      )
  ) then
    raise exception
      'BOD ACCESS POSTCHECK: BOD still has write/admin permissions.';
  end if;
end
$$;

commit;
