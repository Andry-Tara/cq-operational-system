begin;

-- ============================================================
-- FLOOR MAPPING V1
-- CQ BANDUNG FLOOR PLAN V1 SEED
--
-- 20 Regular zones
--  6 VIP zones
--
-- Existing manually configured markers are preserved.
-- ============================================================

do $$
declare
  v_template_id uuid;
  v_expected_count integer;
begin

  select
    t.id
  into
    v_template_id
  from public.floor_mapping_templates t
  join public.outlets o
    on o.id = t.outlet_id
  where
    t.is_active = true
    and lower(
      btrim(t.name)
    ) =
    lower(
      'CQ Bandung Floor Plan'
    )
    and o.name ilike '%Bandung%'
  order by
    t.version_number desc
  limit 1;


  if v_template_id is null then
    raise exception
      'CQ Bandung active Floor Mapping template not found.';
  end if;


  insert into public.floor_mapping_zones (
    template_id,
    zone_code,
    zone_name,
    zone_type,
    x_pct,
    y_pct,
    shape,
    display_label,
    capacity,
    sort_order,
    is_active
  )
  values

    -- ========================================================
    -- REGULAR TABLES
    -- ========================================================

    (
      v_template_id,
      'R1',
      'Regular 1',
      'TABLE',
      22.226,
      42.337,
      'CIRCLE',
      'R1',
      4,
      1,
      true
    ),

    (
      v_template_id,
      'R2',
      'Regular 2',
      'TABLE',
      29.193,
      42.415,
      'CIRCLE',
      'R2',
      4,
      2,
      true
    ),

    (
      v_template_id,
      'R3',
      'Regular 3',
      'TABLE',
      22.371,
      77.739,
      'CIRCLE',
      'R3',
      4,
      3,
      true
    ),

    (
      v_template_id,
      'R5',
      'Regular 5',
      'TABLE',
      29.157,
      77.707,
      'CIRCLE',
      'R5',
      4,
      5,
      true
    ),

    (
      v_template_id,
      'R6',
      'Regular 6',
      'TABLE',
      25.891,
      64.348,
      'CIRCLE',
      'R6',
      6,
      6,
      true
    ),

    (
      v_template_id,
      'R7',
      'Regular 7',
      'TABLE',
      35.153,
      18.065,
      'CIRCLE',
      'R7',
      2,
      7,
      true
    ),

    (
      v_template_id,
      'R8',
      'Regular 8',
      'TABLE',
      29.578,
      15.942,
      'CIRCLE',
      'R8',
      4,
      8,
      true
    ),

    (
      v_template_id,
      'R9',
      'Regular 9',
      'TABLE',
      21.306,
      13.517,
      'CIRCLE',
      'R9',
      2,
      9,
      true
    ),

    (
      v_template_id,
      'R10',
      'Regular 10',
      'TABLE',
      14.492,
      11.460,
      'CIRCLE',
      'R10',
      4,
      10,
      true
    ),

    (
      v_template_id,
      'R15',
      'Regular 15',
      'TABLE',
      14.058,
      47.429,
      'CIRCLE',
      'R15',
      4,
      15,
      true
    ),

    (
      v_template_id,
      'R16',
      'Regular 16',
      'TABLE',
      14.012,
      81.212,
      'CIRCLE',
      'R16',
      4,
      16,
      true
    ),

    (
      v_template_id,
      'R17',
      'Regular 17',
      'TABLE',
      43.913,
      15.874,
      'CIRCLE',
      'R17',
      5,
      17,
      true
    ),

    (
      v_template_id,
      'R18',
      'Regular 18',
      'TABLE',
      57.527,
      20.799,
      'CIRCLE',
      'R18',
      5,
      18,
      true
    ),

    (
      v_template_id,
      'R19',
      'Regular 19',
      'TABLE',
      70.442,
      24.931,
      'CIRCLE',
      'R19',
      5,
      19,
      true
    ),

    (
      v_template_id,
      'R21',
      'Regular 21',
      'TABLE',
      59.052,
      66.305,
      'CIRCLE',
      'R21',
      8,
      21,
      true
    ),

    (
      v_template_id,
      'R22',
      'Regular 22',
      'TABLE',
      14.166,
      35.800,
      'CIRCLE',
      'R22',
      5,
      22,
      true
    ),

    (
      v_template_id,
      'R23',
      'Regular 23',
      'TABLE',
      14.118,
      69.255,
      'CIRCLE',
      'R23',
      5,
      23,
      true
    ),

    (
      v_template_id,
      'R24',
      'Regular 24',
      'TABLE',
      50.621,
      18.425,
      'CIRCLE',
      'R24',
      5,
      24,
      true
    ),

    (
      v_template_id,
      'R25',
      'Regular 25',
      'TABLE',
      63.645,
      22.878,
      'CIRCLE',
      'R25',
      5,
      25,
      true
    ),

    (
      v_template_id,
      'R26',
      'Regular 26',
      'TABLE',
      76.190,
      27.273,
      'CIRCLE',
      'R26',
      5,
      26,
      true
    ),


    -- ========================================================
    -- VIP
    -- ========================================================

    (
      v_template_id,
      'V1',
      'VIP 1',
      'VIP',
      5.223,
      42.343,
      'RECT',
      'V1',
      9,
      101,
      true
    ),

    (
      v_template_id,
      'V2',
      'VIP 2',
      'VIP',
      5.195,
      76.338,
      'RECT',
      'V2',
      9,
      102,
      true
    ),

    (
      v_template_id,
      'V3',
      'VIP 3',
      'VIP',
      44.406,
      32.917,
      'RECT',
      'V3',
      10,
      103,
      true
    ),

    (
      v_template_id,
      'V4',
      'VIP 4',
      'VIP',
      57.714,
      38.605,
      'RECT',
      'V4',
      10,
      104,
      true
    ),

    (
      v_template_id,
      'V5',
      'VIP 5',
      'VIP',
      70.362,
      41.906,
      'RECT',
      'V5',
      10,
      105,
      true
    ),

    (
      v_template_id,
      'V6',
      'VIP 6',
      'VIP',
      90.970,
      59.020,
      'RECT',
      'V6',
      10,
      106,
      true
    )

  on conflict (
    template_id,
    zone_code
  )
  do nothing;


  select
    count(*)
  into
    v_expected_count
  from public.floor_mapping_zones
  where
    template_id =
      v_template_id
    and is_active =
      true
    and zone_code =
      any(
        array[
          'R1',
          'R2',
          'R3',
          'R5',
          'R6',
          'R7',
          'R8',
          'R9',
          'R10',
          'R15',
          'R16',
          'R17',
          'R18',
          'R19',
          'R21',
          'R22',
          'R23',
          'R24',
          'R25',
          'R26',
          'V1',
          'V2',
          'V3',
          'V4',
          'V5',
          'V6'
        ]
      );


  if v_expected_count <> 26 then
    raise exception
      'CQ Bandung seed postcheck failed. Expected 26 zones, found %.',
      v_expected_count;
  end if;


  raise notice
    'CQ Bandung Floor Mapping seed OK: % zones.',
    v_expected_count;

end;
$$;


commit;
