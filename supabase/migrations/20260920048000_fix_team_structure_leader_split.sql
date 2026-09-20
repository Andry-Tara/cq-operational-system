begin;

-- ============================================================
-- TEAM STRUCTURE
-- REPAIR LEADER FOH / BOH SPLIT
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
where not exists (
  select 1
  from public.staff_positions p
  where
    p.organization_id = o.id
    and p.outlet_id is null
    and lower(btrim(p.name)) =
        lower(btrim(seed.name))
);


-- Old generic Leader stays in history,
-- but is no longer selectable for new/current assignment.
update public.staff_positions
set
  is_active = false,
  updated_at = now()
where
  lower(btrim(name)) = 'leader'
  and area = 'BOTH';


notify pgrst, 'reload schema';

commit;
