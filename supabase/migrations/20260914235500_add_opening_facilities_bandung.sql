begin;

-- ============================================================
-- OUTLET OPENING FACILITIES
--
-- Adds reusable facility definitions required by the split
-- OPENING_FOH / OPENING_BOH forms.
--
-- Pilot configuration:
--   CQ Bandung (BDG)
--   GENSET      = available
--   PLAYGROUND  = available
--   KARAOKE     = available
--
-- Other outlets are intentionally NOT configured here.
-- They must be reviewed before rollout.
-- ============================================================

-- ------------------------------------------------------------
-- 1. FACILITY MASTER
-- ------------------------------------------------------------

with target_organizations as (
  select distinct f.organization_id
  from public.forms f
  where f.code in (
    'OPENING_FOH',
    'OPENING_BOH'
  )
    and f.operational_scope = 'restaurant'
),
facility_seed (
  code,
  name,
  description
) as (
  values
    (
      'GENSET',
      'Generator Set',
      'Outlet has a generator set or backup electrical generator relevant to daily operational checks.'
    ),
    (
      'PLAYGROUND',
      'Playground',
      'Outlet has a guest playground or children activity area managed by the outlet.'
    ),
    (
      'KARAOKE',
      'Karaoke',
      'Outlet has karaoke equipment or karaoke-enabled guest rooms relevant to operational checks.'
    )
)

insert into public.facility_definitions (
  organization_id,
  code,
  name,
  description,
  is_active
)
select
  org.organization_id,
  seed.code,
  seed.name,
  seed.description,
  true
from target_organizations org
cross join facility_seed seed

on conflict (
  organization_id,
  code
)
do update set
  name = excluded.name,
  description = excluded.description,
  is_active = true;

-- ------------------------------------------------------------
-- 2. CQ BANDUNG CONFIGURATION
-- ------------------------------------------------------------

insert into public.outlet_facilities (
  outlet_id,
  facility_id,
  is_available
)
select
  o.id,
  fd.id,
  true
from public.outlets o
join public.facility_definitions fd
  on fd.organization_id = o.organization_id
where
  o.code = 'BDG'
  and o.operational_scope = 'restaurant'
  and o.is_active = true
  and fd.code in (
    'GENSET',
    'PLAYGROUND',
    'KARAOKE'
  )
  and fd.is_active = true

on conflict (
  outlet_id,
  facility_id
)
do update set
  is_available = true;

-- ------------------------------------------------------------
-- 3. VALIDATION
-- ------------------------------------------------------------

do $$
declare
  v_outlet_id uuid;
  v_count integer;
begin
  select o.id
  into v_outlet_id
  from public.outlets o
  where
    o.code = 'BDG'
    and o.operational_scope = 'restaurant'
    and o.is_active = true
  limit 1;

  if v_outlet_id is null then
    raise exception
      'CQ Bandung restaurant outlet (BDG) was not found.';
  end if;

  select count(*)
  into v_count
  from public.outlet_facilities ofa
  join public.facility_definitions fd
    on fd.id = ofa.facility_id
  where
    ofa.outlet_id = v_outlet_id
    and fd.code in (
      'GENSET',
      'PLAYGROUND',
      'KARAOKE'
    )
    and ofa.is_available = true;

  if v_count <> 3 then
    raise exception
      'CQ Bandung must have GENSET, PLAYGROUND and KARAOKE configured as available. Found % of 3.',
      v_count;
  end if;
end;
$$;

commit;
