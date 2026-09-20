begin;

-- ============================================================
-- TEAM STRUCTURE V1-F
-- LOGIN IDENTITY LINK + FOH / BOH LEADER SPLIT
-- ============================================================


-- One login account may represent at most one operational
-- staff identity.
create unique index
if not exists team_staff_app_user_unique_idx
on public.team_staff (
  app_user_id
)
where app_user_id is not null;


-- ============================================================
-- LEADER SPLIT
-- ============================================================

insert into public.staff_positions (
  organization_id,
  outlet_id,
  name,
  category,
  area,
  sort_order,
  is_active
)
select
  o.id,
  null,
  seed.name,
  'LEADER',
  seed.area,
  seed.sort_order,
  true
from public.organizations o
cross join (
  values
    (
      'Leader FOH',
      'FOH',
      30
    ),
    (
      'Leader BOH',
      'BOH',
      35
    )
) as seed(
  name,
  area,
  sort_order
)
on conflict do nothing;


-- Generic Leader is no longer selectable for new assignments.
-- Existing assignment history is intentionally preserved.
update public.staff_positions
set
  is_active =
    false,

  updated_at =
    now()
where
  outlet_id is null
  and lower(
    btrim(name)
  ) =
    'leader';


notify pgrst, 'reload schema';

commit;
