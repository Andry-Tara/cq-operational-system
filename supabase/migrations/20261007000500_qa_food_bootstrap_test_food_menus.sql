begin;

-- ============================================================
-- QA FOOD STANDARD
-- Bootstrap QA menu master from existing Test Food menu master.
--
-- This is runtime bootstrap data only.
-- Future hotpot.co.id sync will use its own source key.
-- ============================================================

insert into public.qa_food_menus (
  organization_id,
  source,
  source_menu_key,
  name,
  category,
  default_service_standard_seconds,
  is_active
)
select
  m.organization_id,
  'TEST_FOOD_V1',
  m.code,
  m.name,
  nullif(btrim(m.category), ''),
  780,
  true
from public.test_food_menus m
where m.is_active = true
on conflict (
  organization_id,
  source,
  source_menu_key
)
do update set
  name =
    excluded.name,
  category =
    excluded.category,
  default_service_standard_seconds =
    780,
  is_active =
    true,
  updated_at =
    now();


insert into public.qa_food_menu_outlets (
  menu_id,
  outlet_id,
  source_branch_id,
  qa_eligible,
  service_standard_seconds,
  is_active,
  last_synced_at
)
select
  qm.id,
  tmo.outlet_id,
  null,
  true,
  780,
  true,
  now()
from public.test_food_menus tm
join public.qa_food_menus qm
  on qm.organization_id =
      tm.organization_id
 and qm.source =
      'TEST_FOOD_V1'
 and qm.source_menu_key =
      tm.code
join public.test_food_menu_outlets tmo
  on tmo.menu_id =
      tm.id
 and tmo.is_active =
      true
where tm.is_active =
      true
on conflict (
  menu_id,
  outlet_id
)
do update set
  qa_eligible =
    true,
  service_standard_seconds =
    780,
  is_active =
    true,
  last_synced_at =
    now(),
  updated_at =
    now();


do $$
declare
  v_menu_count integer;
  v_mapping_count integer;
begin
  select count(*)
  into v_menu_count
  from public.qa_food_menus
  where source =
    'TEST_FOOD_V1'
    and is_active =
      true;

  select count(*)
  into v_mapping_count
  from public.qa_food_menu_outlets qmo
  join public.qa_food_menus qm
    on qm.id =
       qmo.menu_id
  where qm.source =
    'TEST_FOOD_V1'
    and qmo.is_active =
      true
    and qmo.qa_eligible =
      true;

  if v_menu_count = 0 then
    raise exception
      'QA FOOD BOOTSTRAP STOP: no active menus were imported.';
  end if;

  if v_mapping_count = 0 then
    raise exception
      'QA FOOD BOOTSTRAP STOP: no outlet mappings were imported.';
  end if;

  raise notice
    'QA Food bootstrap: % menus, % outlet mappings.',
    v_menu_count,
    v_mapping_count;
end;
$$;

commit;
