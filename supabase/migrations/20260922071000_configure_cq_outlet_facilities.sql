begin;

create temporary table cq_facility_targets (
  outlet_code text not null,
  facility_code text not null,
  is_available boolean not null,
  primary key (outlet_code, facility_code)
) on commit drop;

insert into cq_facility_targets (
  outlet_code,
  facility_code,
  is_available
)
values
  ('PIM', 'HOUSEKEEPING', false),
  ('SP',  'GENSET', false),
  ('PP',  'PARKING', false),
  ('PP',  'VALET', false),
  ('PP',  'GENSET', false),
  ('MOI', 'HOUSEKEEPING', false);

do $$
declare
  v_outlet_count integer;
  v_org_count integer;
begin
  select
    count(*),
    count(distinct organization_id)
  into
    v_outlet_count,
    v_org_count
  from public.outlets
  where code in ('PIM', 'SP', 'PP', 'MOI')
    and is_active = true;

  if v_outlet_count <> 4 then
    raise exception
      'CQ FACILITY STOP: expected 4 active target outlets, found %.',
      v_outlet_count;
  end if;

  if v_org_count <> 1 then
    raise exception
      'CQ FACILITY STOP: target outlets must belong to exactly one organization, found %.',
      v_org_count;
  end if;
end;
$$;

create temporary table cq_facility_context
on commit drop
as
select distinct
  organization_id
from public.outlets
where code in ('PIM', 'SP', 'PP', 'MOI')
  and is_active = true;

insert into public.facility_definitions (
  organization_id,
  code,
  name,
  description,
  is_active
)
select
  ctx.organization_id,
  'HOUSEKEEPING',
  'Housekeeping',
  'Dedicated housekeeping / toilet attendant availability at outlet.',
  true
from cq_facility_context ctx
on conflict (
  organization_id,
  code
)
do update set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  updated_at = now();

do $$
declare
  v_missing text;
begin
  select string_agg(
    required.code,
    ', '
    order by required.code
  )
  into v_missing
  from (
    values
      ('PARKING'),
      ('VALET'),
      ('GENSET'),
      ('HOUSEKEEPING')
  ) as required(code)
  where not exists (
    select 1
    from public.facility_definitions fd
    join cq_facility_context ctx
      on ctx.organization_id = fd.organization_id
    where fd.code = required.code
      and fd.is_active = true
  );

  if v_missing is not null then
    raise exception
      'CQ FACILITY STOP: missing active facility definitions: %.',
      v_missing;
  end if;
end;
$$;

insert into public.outlet_facilities (
  outlet_id,
  facility_id,
  is_available,
  notes
)
select
  o.id,
  fd.id,
  target.is_available,
  'Confirmed outlet facility configuration 2026-09-22'
from cq_facility_targets target
join public.outlets o
  on o.code = target.outlet_code
 and o.is_active = true
join public.facility_definitions fd
  on fd.organization_id = o.organization_id
 and fd.code = target.facility_code
 and fd.is_active = true
on conflict (
  outlet_id,
  facility_id
)
do update set
  is_available = excluded.is_available,
  notes = excluded.notes,
  updated_at = now();

do $$
declare
  v_bad text;
begin
  select string_agg(
    target.outlet_code || ':' || target.facility_code,
    ', '
    order by target.outlet_code, target.facility_code
  )
  into v_bad
  from cq_facility_targets target
  join public.outlets o
    on o.code = target.outlet_code
   and o.is_active = true
  join public.facility_definitions fd
    on fd.organization_id = o.organization_id
   and fd.code = target.facility_code
   and fd.is_active = true
  left join public.outlet_facilities ofa
    on ofa.outlet_id = o.id
   and ofa.facility_id = fd.id
  where ofa.id is null
     or ofa.is_available is distinct from target.is_available;

  if v_bad is not null then
    raise exception
      'CQ FACILITY POSTFLIGHT FAILED: %.',
      v_bad;
  end if;
end;
$$;

commit;
