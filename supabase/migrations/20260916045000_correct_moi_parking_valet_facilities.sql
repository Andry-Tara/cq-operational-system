begin;

-- ============================================================
-- MOI FACILITY CORRECTION
--
-- CQ Mall Of Indonesia does not have:
--   - PARKING
--   - VALET
--
-- This changes outlet master facility configuration only.
-- Existing report applicability snapshots remain unchanged.
-- Fresh reports created after this migration will use the new values.
-- ============================================================

do $$
declare
  v_outlet_id uuid;
  v_org_id uuid;
  v_count integer;
begin
  select
    o.id,
    o.organization_id
  into
    v_outlet_id,
    v_org_id
  from public.outlets o
  where upper(o.code) = 'MOI'
    and o.is_active = true
  limit 1;

  if v_outlet_id is null then
    raise exception
      'MOI facility correction failed: active MOI outlet not found.';
  end if;

  select count(*)
  into v_count
  from public.facility_definitions fd
  where fd.organization_id = v_org_id
    and fd.is_active = true
    and upper(fd.code) in ('PARKING', 'VALET');

  if v_count <> 2 then
    raise exception
      'MOI facility correction failed: expected PARKING and VALET definitions, found %.',
      v_count;
  end if;

  insert into public.outlet_facilities (
    outlet_id,
    facility_id,
    is_available
  )
  select
    v_outlet_id,
    fd.id,
    false
  from public.facility_definitions fd
  where fd.organization_id = v_org_id
    and fd.is_active = true
    and upper(fd.code) in ('PARKING', 'VALET')
  on conflict (
    outlet_id,
    facility_id
  )
  do update set
    is_available = false,
    updated_at = now();

  select count(*)
  into v_count
  from public.outlet_facilities ofc
  join public.facility_definitions fd
    on fd.id = ofc.facility_id
  where ofc.outlet_id = v_outlet_id
    and fd.organization_id = v_org_id
    and fd.is_active = true
    and upper(fd.code) in ('PARKING', 'VALET')
    and ofc.is_available = false;

  if v_count <> 2 then
    raise exception
      'MOI facility correction failed postflight: PARKING/VALET are not both false.';
  end if;
end;
$$;

commit;
