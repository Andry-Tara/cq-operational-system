begin;

-- ============================================================
-- O3C-1 - SPLIT OUTLET FORM READ ACCESS
--
-- Problem:
--   Runtime SELECT policies for forms / form_versions use the
--   legacy form-access helper, while section / question tables
--   use has_section_access_any_outlet().
--
--   Split Restaurant Outlet forms are authorized through
--   user_form_permissions, so users with valid Fill/Submit/
--   Review/Override access could still be unable to read the
--   form definition.
--
-- Safety:
--   - only applies to:
--       OPENING_FOH
--       OPENING_BOH
--       CLOSING_FOH
--       CLOSING_BOH
--   - requires active user_outlets membership
--   - requires an active outlet_form_assignment
--   - requires at least one form-level capability
--   - existing legacy OPENING/CLOSING access remains intact
--   - existing Central Kitchen section access remains intact
-- ============================================================


-- ------------------------------------------------------------
-- 1. Split-form read helper
-- ------------------------------------------------------------

create or replace function public.has_split_form_access_any_outlet(
  p_form_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from public.forms f
      join public.user_form_permissions ufp
        on ufp.form_id = f.id
       and ufp.user_id = auth.uid()
      join public.user_outlets uo
        on uo.user_id = ufp.user_id
       and uo.outlet_id = ufp.outlet_id
       and uo.is_active = true
      join public.outlet_form_assignments ofa
        on ofa.outlet_id = ufp.outlet_id
       and ofa.form_id = f.id
       and ofa.is_active = true
      where f.id = p_form_id
        and f.is_active = true
        and upper(f.code) in (
          'OPENING_FOH',
          'OPENING_BOH',
          'CLOSING_FOH',
          'CLOSING_BOH'
        )
        and (
          ufp.can_fill
          or ufp.can_submit
          or ufp.can_review
          or ufp.can_override
        )
    );
$function$;

revoke all on function
  public.has_split_form_access_any_outlet(uuid)
from public;

revoke all on function
  public.has_split_form_access_any_outlet(uuid)
from anon;

grant execute on function
  public.has_split_form_access_any_outlet(uuid)
to authenticated;


-- ------------------------------------------------------------
-- 2. Preserve existing section helper behavior, then add the
--    split form-level access bridge before section-level checks.
-- ------------------------------------------------------------

create or replace function public.has_section_access_any_outlet(
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
  v_form_id uuid;
  v_org_id uuid;
begin

  select
    s.form_id,
    f.organization_id
  into
    v_form_id,
    v_org_id
  from public.sections s
  join public.forms f
    on f.id = s.form_id
  where s.id = p_section_id
  limit 1;

  if v_form_id is null then
    return false;
  end if;

  if public.is_org_admin(v_org_id) then
    return true;
  end if;

  -- Split Restaurant Outlet forms are form-level authorized.
  -- The helper itself restricts access to the four split codes,
  -- so legacy Outlet and Central Kitchen behavior is unchanged.
  if public.has_split_form_access_any_outlet(
    v_form_id
  ) then
    return true;
  end if;

  -- Existing Central Kitchen / section-level behavior.
  return exists (
    select 1
    from public.user_outlets uo
    where
      uo.user_id = auth.uid()
      and uo.is_active = true
      and public.has_section_permission(
        uo.outlet_id,
        v_form_id,
        p_section_id,
        p_permission
      )
  );

end;
$function$;

revoke all on function
  public.has_section_access_any_outlet(uuid, text)
from public;

revoke all on function
  public.has_section_access_any_outlet(uuid, text)
from anon;

grant execute on function
  public.has_section_access_any_outlet(uuid, text)
to authenticated;


-- ------------------------------------------------------------
-- 3. Additional permissive SELECT policies for the two tables
--    that do not use has_section_access_any_outlet().
--
-- PostgreSQL permissive SELECT policies combine with OR, so the
-- existing forms_select / form_versions_select policies remain
-- untouched and continue protecting legacy + CK behavior.
-- ------------------------------------------------------------

drop policy if exists
  forms_select_split_form_access
on public.forms;

create policy
  forms_select_split_form_access
on public.forms
for select
to authenticated
using (
  public.has_split_form_access_any_outlet(id)
);


drop policy if exists
  form_versions_select_split_form_access
on public.form_versions;

create policy
  form_versions_select_split_form_access
on public.form_versions
for select
to authenticated
using (
  public.has_split_form_access_any_outlet(form_id)
);


commit;
