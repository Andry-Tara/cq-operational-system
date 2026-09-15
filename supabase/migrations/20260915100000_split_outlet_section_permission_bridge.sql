begin;

-- ============================================================
-- O3C-2 - SPLIT OUTLET SECTION PERMISSION BRIDGE
--
-- Current runtime RLS for report_sections / report_answers /
-- report_photos is built around has_section_permission() and
-- can_access_report_section().
--
-- Split Restaurant Outlet forms intentionally use
-- user_form_permissions instead of CK-style section permissions.
--
-- This migration adds a narrow bridge inside
-- has_section_permission() for exactly four split Outlet forms:
--
--   OPENING_FOH
--   OPENING_BOH
--   CLOSING_FOH
--   CLOSING_BOH
--
-- Legacy OPENING / CLOSING behavior remains unchanged.
-- Central Kitchen section behavior remains unchanged.
-- ============================================================


create or replace function public.has_section_permission(
  p_outlet_id uuid,
  p_form_id uuid,
  p_section_id uuid,
  p_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$

declare
  v_org_id uuid;
  v_form_code text;
  v_override boolean;
  v_app_permission text;

begin

  -- ==========================================================
  -- 1. VALIDATE OUTLET + FORM + SECTION
  -- ==========================================================

  select
    o.organization_id,
    upper(f.code)
  into
    v_org_id,
    v_form_code
  from public.outlets o

  join public.forms f
    on f.organization_id = o.organization_id

  join public.sections s
    on s.form_id = f.id

  where o.id = p_outlet_id
    and f.id = p_form_id
    and s.id = p_section_id
    and o.is_active = true
    and f.is_active = true
    and s.is_active = true

  limit 1;


  if v_org_id is null then
    return false;
  end if;


  -- ==========================================================
  -- 2. ORGANIZATION ADMIN
  -- ==========================================================

  if public.is_org_admin(v_org_id) then
    return true;
  end if;


  -- ==========================================================
  -- 3. USER MUST HAVE OUTLET ACCESS
  -- ==========================================================

  if not public.has_outlet_access(
    p_outlet_id
  ) then
    return false;
  end if;


  -- ==========================================================
  -- 4. SPLIT RESTAURANT OUTLET FORM BRIDGE
  --
  -- These forms are intentionally authorized at FORM level,
  -- not through user_section_permissions.
  --
  -- Permission mapping:
  --   view   -> any operational capability
  --   fill   -> can_fill
  --   submit -> can_submit
  --   review -> can_review OR can_override
  --   reopen -> can_override
  --
  -- edit_template stays admin-only through existing admin paths.
  -- ==========================================================

  if v_form_code in (
    'OPENING_FOH',
    'OPENING_BOH',
    'CLOSING_FOH',
    'CLOSING_BOH'
  ) then

    case lower(trim(coalesce(p_permission, '')))

      when 'view' then
        return (
          public.has_form_permission(
            p_outlet_id,
            p_form_id,
            'fill'
          )
          or
          public.has_form_permission(
            p_outlet_id,
            p_form_id,
            'submit'
          )
          or
          public.has_form_permission(
            p_outlet_id,
            p_form_id,
            'review'
          )
          or
          public.has_form_permission(
            p_outlet_id,
            p_form_id,
            'override'
          )
        );

      when 'fill' then
        return public.has_form_permission(
          p_outlet_id,
          p_form_id,
          'fill'
        );

      when 'submit' then
        return public.has_form_permission(
          p_outlet_id,
          p_form_id,
          'submit'
        );

      when 'review' then
        return (
          public.has_form_permission(
            p_outlet_id,
            p_form_id,
            'review'
          )
          or
          public.has_form_permission(
            p_outlet_id,
            p_form_id,
            'override'
          )
        );

      when 'reopen' then
        return public.has_form_permission(
          p_outlet_id,
          p_form_id,
          'override'
        );

      else
        return false;

    end case;

  end if;


  -- ==========================================================
  -- 5. EXISTING USER-SPECIFIC SECTION OVERRIDE
  --
  -- Preserved for Central Kitchen and any existing
  -- section-scoped workflows.
  -- ==========================================================

  select
    case p_permission

      when 'view' then
        (
          usp.can_view
          or usp.can_fill
          or usp.can_submit
          or usp.can_review
          or usp.can_reopen
          or usp.can_edit_template
        )

      when 'fill'
        then usp.can_fill

      when 'submit'
        then usp.can_submit

      when 'review'
        then usp.can_review

      when 'reopen'
        then usp.can_reopen

      when 'edit_template'
        then usp.can_edit_template

      else false

    end

  into v_override

  from public.user_section_permissions usp

  where usp.user_id = auth.uid()
    and usp.outlet_id = p_outlet_id
    and usp.form_id = p_form_id
    and usp.section_id = p_section_id

  limit 1;


  if found then
    return coalesce(v_override, false);
  end if;


  -- ==========================================================
  -- 6. EXISTING LEGACY OUTLET FORM BRIDGE
  --
  -- OPENING -> opening.submit
  -- CLOSING -> closing.submit
  --
  -- Preserved exactly for view / fill / submit.
  -- ==========================================================

  v_app_permission :=
    case v_form_code
      when 'OPENING'
        then 'opening.submit'

      when 'CLOSING'
        then 'closing.submit'

      else null
    end;


  if
    v_app_permission is not null
    and p_permission in (
      'view',
      'fill',
      'submit'
    )
  then

    if exists (

      select 1

      from public.user_roles ur

      join public.roles r
        on r.id = ur.role_id

      join public.role_permissions rp
        on rp.role_id = r.id

      join public.permissions perm
        on perm.id = rp.permission_id

      join public.profiles prof
        on prof.id = ur.user_id

      where ur.user_id = auth.uid()

        and prof.is_active = true
        and prof.organization_id = v_org_id

        and r.organization_id = v_org_id
        and r.is_active = true

        and (
          ur.outlet_id is null
          or ur.outlet_id = p_outlet_id
        )

        and perm.code = v_app_permission

    ) then

      return true;

    end if;

  end if;


  -- ==========================================================
  -- 7. EXISTING STANDARD ROLE SECTION PERMISSION
  -- ==========================================================

  return exists (

    select 1

    from public.user_roles ur

    join public.roles r
      on r.id = ur.role_id

    join public.role_section_permissions rsp
      on rsp.role_id = r.id

    where ur.user_id = auth.uid()

      and r.organization_id = v_org_id
      and r.is_active = true

      and (
        ur.outlet_id is null
        or ur.outlet_id = p_outlet_id
      )

      and (
        rsp.outlet_id is null
        or rsp.outlet_id = p_outlet_id
      )

      and rsp.form_id = p_form_id
      and rsp.section_id = p_section_id

      and (

        case p_permission

          when 'view' then
            (
              rsp.can_view
              or rsp.can_fill
              or rsp.can_submit
              or rsp.can_review
              or rsp.can_reopen
              or rsp.can_edit_template
            )

          when 'fill'
            then rsp.can_fill

          when 'submit'
            then rsp.can_submit

          when 'review'
            then rsp.can_review

          when 'reopen'
            then rsp.can_reopen

          when 'edit_template'
            then rsp.can_edit_template

          else false

        end

      )

  );

end;

$function$;


revoke all on function
  public.has_section_permission(
    uuid,
    uuid,
    uuid,
    text
  )
from public;

revoke all on function
  public.has_section_permission(
    uuid,
    uuid,
    uuid,
    text
  )
from anon;

grant execute on function
  public.has_section_permission(
    uuid,
    uuid,
    uuid,
    text
  )
to authenticated;


commit;
