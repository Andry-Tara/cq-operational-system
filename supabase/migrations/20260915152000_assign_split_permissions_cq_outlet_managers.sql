begin;

-- ============================================================
-- O3G - SPLIT FORM PERMISSIONS FOR CQ OUTLET MANAGERS
--
-- Targets:
--   GS, HT, MOI, PIM, PL, PP, SP, TBZ
--
-- Each target Outlet Manager receives on all 4 split forms:
--   can_fill     = true
--   can_submit   = true
--   can_review   = true
--   can_override = true
--
-- Intentionally NOT changed:
--   Management account
--   Area Manager account
--   System Administrator
--   Leader FOH / BOH (not present in current target outlet audit)
--   Bandung
--   DD Canggu / Seminyak
--   Central Kitchen
-- ============================================================

create temporary table o3g_target_outlets (
  outlet_code text primary key
) on commit drop;

insert into o3g_target_outlets (outlet_code)
values
  ('GS'),
  ('HT'),
  ('MOI'),
  ('PIM'),
  ('PL'),
  ('PP'),
  ('SP'),
  ('TBZ');


create temporary table o3g_manager_map (
  outlet_id uuid primary key,
  outlet_code text not null,
  user_id uuid not null unique
) on commit drop;


insert into o3g_manager_map (
  outlet_id,
  outlet_code,
  user_id
)
select distinct
  o.id,
  upper(o.code),
  p.id
from o3g_target_outlets t
join public.outlets o
  on upper(o.code) = t.outlet_code
 and o.is_active = true
join public.user_outlets uo
  on uo.outlet_id = o.id
 and uo.is_active = true
join public.profiles p
  on p.id = uo.user_id
 and p.organization_id = o.organization_id
 and coalesce(p.is_active, true) = true
join public.user_roles ur
  on ur.user_id = p.id
 and (
   ur.outlet_id is null
   or ur.outlet_id = o.id
 )
join public.roles r
  on r.id = ur.role_id
 and r.organization_id = o.organization_id
 and r.is_active = true
 and lower(trim(r.name)) = 'outlet manager';


do $$
declare
  v_count integer;
  v_bad text;
begin
  select count(*)
    into v_count
  from o3g_manager_map;

  if v_count <> 8 then
    raise exception
      'O3G STOP: expected exactly 8 target Outlet Managers, found %.',
      v_count;
  end if;

  select string_agg(
           t.outlet_code,
           ', '
           order by t.outlet_code
         )
    into v_bad
  from o3g_target_outlets t
  where not exists (
    select 1
    from o3g_manager_map m
    where m.outlet_code = t.outlet_code
  );

  if v_bad is not null then
    raise exception
      'O3G STOP: missing Outlet Manager for: %.',
      v_bad;
  end if;

  select string_agg(
           o.code,
           ', '
           order by o.code
         )
    into v_bad
  from o3g_manager_map m
  join public.outlets o
    on o.id = m.outlet_id
  where (
    select count(*)
    from public.outlet_form_assignments ofa
    join public.forms f
      on f.id = ofa.form_id
    join public.form_versions fv
      on fv.id = ofa.form_version_id
     and fv.form_id = f.id
    where ofa.outlet_id = o.id
      and ofa.is_active = true
      and fv.status = 'published'
      and upper(f.code) in (
        'OPENING_FOH',
        'OPENING_BOH',
        'CLOSING_FOH',
        'CLOSING_BOH'
      )
  ) <> 4;

  if v_bad is not null then
    raise exception
      'O3G STOP: target outlet missing 4 active published split assignments: %.',
      v_bad;
  end if;
end;
$$;


-- Reset only the target managers' split-form permissions.
delete from public.user_form_permissions ufp
using o3g_manager_map m,
      public.forms f
where ufp.user_id = m.user_id
  and ufp.outlet_id = m.outlet_id
  and ufp.form_id = f.id
  and f.organization_id = (
    select o.organization_id
    from public.outlets o
    where o.id = m.outlet_id
  )
  and upper(f.code) in (
    'OPENING_FOH',
    'OPENING_BOH',
    'CLOSING_FOH',
    'CLOSING_BOH'
  );


insert into public.user_form_permissions (
  user_id,
  outlet_id,
  form_id,
  can_fill,
  can_submit,
  can_review,
  can_override
)
select
  m.user_id,
  m.outlet_id,
  f.id,
  true,
  true,
  true,
  true
from o3g_manager_map m
join public.outlets o
  on o.id = m.outlet_id
join public.forms f
  on f.organization_id = o.organization_id
 and f.is_active = true
 and upper(f.code) in (
   'OPENING_FOH',
   'OPENING_BOH',
   'CLOSING_FOH',
   'CLOSING_BOH'
 );


do $$
declare
  v_count integer;
  v_bad text;
begin
  select count(*)
    into v_count
  from public.user_form_permissions ufp
  join o3g_manager_map m
    on m.user_id = ufp.user_id
   and m.outlet_id = ufp.outlet_id
  join public.forms f
    on f.id = ufp.form_id
  where upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    )
    and ufp.can_fill = true
    and ufp.can_submit = true
    and ufp.can_review = true
    and ufp.can_override = true;

  if v_count <> 32 then
    raise exception
      'O3G STOP: expected 32 full manager permission rows, found %.',
      v_count;
  end if;

  select string_agg(
           m.outlet_code,
           ', '
           order by m.outlet_code
         )
    into v_bad
  from o3g_manager_map m
  where (
    select count(*)
    from public.user_form_permissions ufp
    join public.forms f
      on f.id = ufp.form_id
    where ufp.user_id = m.user_id
      and ufp.outlet_id = m.outlet_id
      and upper(f.code) in (
        'OPENING_FOH',
        'OPENING_BOH',
        'CLOSING_FOH',
        'CLOSING_BOH'
      )
      and ufp.can_fill = true
      and ufp.can_submit = true
      and ufp.can_review = true
      and ufp.can_override = true
  ) <> 4;

  if v_bad is not null then
    raise exception
      'O3G STOP: manager permission coverage incomplete for: %.',
      v_bad;
  end if;
end;
$$;

commit;
