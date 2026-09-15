begin;

-- ============================================================
-- SPLIT OUTLET OPERATION PERMISSION BRIDGE
--
-- Legacy OPENING / CLOSING:
--   app permission remains authoritative.
--
-- OPENING_CK / CLOSING_CK:
--   section permission remains authoritative.
--
-- Split Outlet forms:
--   user_form_permissions becomes authoritative.
-- ============================================================

create or replace function public.can_start_operational_report(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_form_id uuid,
  p_started_by uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_form_code text;
  v_permission_code text;
begin
  if auth.uid() is null then
    return false;
  end if;

  if p_started_by is distinct from auth.uid() then
    return false;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id =
        p_organization_id
  ) then
    return false;
  end if;

  if public.is_org_admin(
    p_organization_id
  ) then
    return true;
  end if;

  if not public.has_outlet_access(
    p_outlet_id
  ) then
    return false;
  end if;

  select
    upper(f.code)
  into
    v_form_code
  from public.forms f
  join public.outlets o
    on o.id = p_outlet_id
  where f.id = p_form_id
    and f.organization_id =
      p_organization_id
    and o.organization_id =
      p_organization_id
    and f.is_active = true
    and o.is_active = true
  limit 1;

  if v_form_code is null then
    return false;
  end if;

  if v_form_code in (
    'OPENING_CK',
    'CLOSING_CK'
  ) then
    return (
      public.has_any_form_permission(
        p_outlet_id,
        p_form_id,
        'fill'
      )
      or
      public.has_any_form_permission(
        p_outlet_id,
        p_form_id,
        'submit'
      )
    );
  end if;

  if v_form_code in (
    'OPENING_FOH',
    'OPENING_BOH',
    'CLOSING_FOH',
    'CLOSING_BOH'
  ) then
    return public.has_form_permission(
      p_outlet_id,
      p_form_id,
      'fill'
    );
  end if;

  v_permission_code :=
    case v_form_code
      when 'OPENING'
        then 'opening.submit'
      when 'CLOSING'
        then 'closing.submit'
      else null
    end;

  if v_permission_code is null then
    return false;
  end if;

  return exists (
    select 1
    from public.user_roles ur
    join public.roles r
      on r.id = ur.role_id
    join public.role_permissions rp
      on rp.role_id = r.id
    join public.permissions perm
      on perm.id = rp.permission_id
    where ur.user_id = auth.uid()
      and r.organization_id =
        p_organization_id
      and r.is_active = true
      and (
        ur.outlet_id is null
        or ur.outlet_id =
          p_outlet_id
      )
      and perm.code =
        v_permission_code
  );
end;
$function$;

revoke all on function
  public.can_start_operational_report(
    uuid,
    uuid,
    uuid,
    uuid
  )
from public;

revoke all on function
  public.can_start_operational_report(
    uuid,
    uuid,
    uuid,
    uuid
  )
from anon;

grant execute on function
  public.can_start_operational_report(
    uuid,
    uuid,
    uuid,
    uuid
  )
to authenticated;


create or replace function public.can_submit_outlet_form(
  p_outlet_id uuid,
  p_form_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_organization_id uuid;
  v_form_code text;
begin
  if auth.uid() is null then
    return false;
  end if;

  select
    f.organization_id,
    upper(f.code)
  into
    v_organization_id,
    v_form_code
  from public.forms f
  join public.outlets o
    on o.id = p_outlet_id
   and o.organization_id =
       f.organization_id
  where f.id = p_form_id
    and f.is_active = true
    and o.is_active = true
  limit 1;

  if v_organization_id is null then
    return false;
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.organization_id =
        v_organization_id
  ) then
    return false;
  end if;

  if public.is_org_admin(
    v_organization_id
  ) then
    return true;
  end if;

  if v_form_code not in (
    'OPENING_FOH',
    'OPENING_BOH',
    'CLOSING_FOH',
    'CLOSING_BOH'
  ) then
    return false;
  end if;

  return public.has_form_permission(
    p_outlet_id,
    p_form_id,
    'submit'
  );
end;
$function$;

revoke all on function
  public.can_submit_outlet_form(
    uuid,
    uuid
  )
from public;

revoke all on function
  public.can_submit_outlet_form(
    uuid,
    uuid
  )
from anon;

grant execute on function
  public.can_submit_outlet_form(
    uuid,
    uuid
  )
to authenticated;

commit;
