begin;

-- ============================================================
-- FACILITY MASTER V1
--
-- Seeds reusable facility/capability definitions.
--
-- IMPORTANT:
--   - Does NOT configure availability per outlet.
--   - Does NOT activate N/A behavior.
--   - Does NOT modify historical reports.
-- ============================================================

with facility_seed (
  code,
  name,
  description
) as (
  values

    (
      'PARKING',
      'Parking',
      'Outlet has a parking area that is operationally managed or checked by the outlet.'
    ),

    (
      'VALET',
      'Valet',
      'Outlet has a valet operation or valet station relevant to daily operations.'
    ),

    (
      'OUTDOOR_WAITING',
      'Outdoor Waiting / Queue Area',
      'Outlet has an outdoor guest waiting or queue area.'
    ),

    (
      'VIP_ROOM',
      'VIP Room',
      'Outlet has one or more VIP or private dining rooms.'
    ),

    (
      'OUTDOOR_DINING',
      'Outdoor Dining Area',
      'Outlet has an outdoor dining or guest seating area.'
    ),

    (
      'GUEST_TOILET',
      'Guest Toilet',
      'Outlet directly operates or is responsible for a guest toilet.'
    ),

    (
      'CASH_PAYMENT',
      'Cash Payment',
      'Outlet accepts and operationally manages cash payment and cash closing.'
    ),

    (
      'GAS_SYSTEM',
      'Gas System',
      'Outlet uses a gas supply or gas installation as part of its operation.'
    ),

    (
      'CCTV',
      'CCTV / Security Monitoring',
      'Outlet has CCTV or security monitoring equipment relevant to operational checks.'
    )
),

target_organizations as (
  select distinct
    o.organization_id
  from public.outlets o
  where o.organization_id is not null
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
  fs.code,
  fs.name,
  fs.description,
  true
from target_organizations org
cross join facility_seed fs

on conflict (
  organization_id,
  code
)
do update set
  name = excluded.name,
  description = excluded.description,
  is_active = true;

commit;
