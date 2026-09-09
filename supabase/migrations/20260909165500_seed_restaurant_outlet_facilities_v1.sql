begin;

-- ============================================================
-- RESTAURANT OUTLET FACILITY CONFIGURATION V1
--
-- 11 Restaurant outlets x 9 facilities = 99 rows
--
-- TRUE  = applicable
-- FALSE = N/A
--
-- Does NOT:
--   - activate Opening V2
--   - activate Closing V2
--   - modify historical reports
-- ============================================================

with facility_matrix (
  outlet_code,
  facility_code,
  is_available
) as (
  values

    -- BDG
    ('BDG', 'PARKING', true),
    ('BDG', 'VALET', true),
    ('BDG', 'OUTDOOR_WAITING', true),
    ('BDG', 'VIP_ROOM', true),
    ('BDG', 'OUTDOOR_DINING', true),
    ('BDG', 'GUEST_TOILET', true),
    ('BDG', 'CASH_PAYMENT', true),
    ('BDG', 'GAS_SYSTEM', true),
    ('BDG', 'CCTV', true),

    -- GS
    ('GS', 'PARKING', false),
    ('GS', 'VALET', false),
    ('GS', 'OUTDOOR_WAITING', true),
    ('GS', 'VIP_ROOM', true),
    ('GS', 'OUTDOOR_DINING', true),
    ('GS', 'GUEST_TOILET', true),
    ('GS', 'CASH_PAYMENT', true),
    ('GS', 'GAS_SYSTEM', true),
    ('GS', 'CCTV', true),

    -- HT
    ('HT', 'PARKING', true),
    ('HT', 'VALET', true),
    ('HT', 'OUTDOOR_WAITING', false),
    ('HT', 'VIP_ROOM', true),
    ('HT', 'OUTDOOR_DINING', false),
    ('HT', 'GUEST_TOILET', true),
    ('HT', 'CASH_PAYMENT', true),
    ('HT', 'GAS_SYSTEM', true),
    ('HT', 'CCTV', true),

    -- MOI
    ('MOI', 'PARKING', false),
    ('MOI', 'VALET', false),
    ('MOI', 'OUTDOOR_WAITING', true),
    ('MOI', 'VIP_ROOM', true),
    ('MOI', 'OUTDOOR_DINING', true),
    ('MOI', 'GUEST_TOILET', false),
    ('MOI', 'CASH_PAYMENT', true),
    ('MOI', 'GAS_SYSTEM', true),
    ('MOI', 'CCTV', true),

    -- PIM
    ('PIM', 'PARKING', false),
    ('PIM', 'VALET', false),
    ('PIM', 'OUTDOOR_WAITING', true),
    ('PIM', 'VIP_ROOM', true),
    ('PIM', 'OUTDOOR_DINING', false),
    ('PIM', 'GUEST_TOILET', false),
    ('PIM', 'CASH_PAYMENT', true),
    ('PIM', 'GAS_SYSTEM', true),
    ('PIM', 'CCTV', true),

    -- PL
    ('PL', 'PARKING', true),
    ('PL', 'VALET', true),
    ('PL', 'OUTDOOR_WAITING', false),
    ('PL', 'VIP_ROOM', true),
    ('PL', 'OUTDOOR_DINING', false),
    ('PL', 'GUEST_TOILET', true),
    ('PL', 'CASH_PAYMENT', true),
    ('PL', 'GAS_SYSTEM', true),
    ('PL', 'CCTV', true),

    -- PP
    ('PP', 'PARKING', true),
    ('PP', 'VALET', true),
    ('PP', 'OUTDOOR_WAITING', false),
    ('PP', 'VIP_ROOM', true),
    ('PP', 'OUTDOOR_DINING', false),
    ('PP', 'GUEST_TOILET', true),
    ('PP', 'CASH_PAYMENT', true),
    ('PP', 'GAS_SYSTEM', true),
    ('PP', 'CCTV', true),

    -- SP
    ('SP', 'PARKING', true),
    ('SP', 'VALET', true),
    ('SP', 'OUTDOOR_WAITING', false),
    ('SP', 'VIP_ROOM', true),
    ('SP', 'OUTDOOR_DINING', false),
    ('SP', 'GUEST_TOILET', true),
    ('SP', 'CASH_PAYMENT', true),
    ('SP', 'GAS_SYSTEM', true),
    ('SP', 'CCTV', true),

    -- TBZ
    ('TBZ', 'PARKING', false),
    ('TBZ', 'VALET', false),
    ('TBZ', 'OUTDOOR_WAITING', false),
    ('TBZ', 'VIP_ROOM', true),
    ('TBZ', 'OUTDOOR_DINING', false),
    ('TBZ', 'GUEST_TOILET', false),
    ('TBZ', 'CASH_PAYMENT', true),
    ('TBZ', 'GAS_SYSTEM', true),
    ('TBZ', 'CCTV', true),

    -- CGU
    ('CGU', 'PARKING', true),
    ('CGU', 'VALET', true),
    ('CGU', 'OUTDOOR_WAITING', true),
    ('CGU', 'VIP_ROOM', true),
    ('CGU', 'OUTDOOR_DINING', true),
    ('CGU', 'GUEST_TOILET', true),
    ('CGU', 'CASH_PAYMENT', true),
    ('CGU', 'GAS_SYSTEM', true),
    ('CGU', 'CCTV', true),

    -- SMY
    ('SMY', 'PARKING', false),
    ('SMY', 'VALET', false),
    ('SMY', 'OUTDOOR_WAITING', true),
    ('SMY', 'VIP_ROOM', true),
    ('SMY', 'OUTDOOR_DINING', true),
    ('SMY', 'GUEST_TOILET', true),
    ('SMY', 'CASH_PAYMENT', true),
    ('SMY', 'GAS_SYSTEM', true),
    ('SMY', 'CCTV', true)
),

resolved_matrix as (
  select
    fm.outlet_code,
    fm.facility_code,
    fm.is_available,
    o.id as outlet_id,
    fd.id as facility_id
  from facility_matrix fm
  join public.outlets o
    on o.code = fm.outlet_code
   and o.is_active = true
  join public.facility_definitions fd
    on fd.organization_id = o.organization_id
   and fd.code = fm.facility_code
   and fd.is_active = true
),

validation as (
  select
    (select count(*) from facility_matrix) as expected_rows,
    (select count(*) from resolved_matrix) as resolved_rows,
    (select count(distinct outlet_code) from facility_matrix) as expected_outlets,
    (select count(distinct outlet_id) from resolved_matrix) as resolved_outlets,
    (select count(distinct facility_code) from facility_matrix) as expected_facilities,
    (select count(distinct facility_id) from resolved_matrix) as resolved_facilities,
    (select count(*) from facility_matrix where is_available = true) as yes_rows,
    (select count(*) from facility_matrix where is_available = false) as no_rows
)

insert into public.outlet_facilities (
  outlet_id,
  facility_id,
  is_available
)
select
  rm.outlet_id,
  rm.facility_id,
  rm.is_available
from resolved_matrix rm
cross join validation v
where
  v.expected_rows = 99
  and v.resolved_rows = v.expected_rows
  and v.expected_outlets = 11
  and v.resolved_outlets = v.expected_outlets
  and v.expected_facilities = 9
  and v.resolved_facilities = v.expected_facilities
  and v.yes_rows = 75
  and v.no_rows = 24

on conflict (
  outlet_id,
  facility_id
)
do update set
  is_available = excluded.is_available;

commit;
