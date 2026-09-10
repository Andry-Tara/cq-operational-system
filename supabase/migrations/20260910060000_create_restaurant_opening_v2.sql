begin;

-- ============================================================
-- RESTAURANT OPENING V2
--
-- Creates:
--   - OPENING form version 2 as DRAFT
--   - 7 version sections
--   - 6 new section masters + reuse existing KITCHEN
--   - Kitchen question groups
--   - 53 questions
--   - evidence mode configuration
--   - applicability rules
--
-- Does NOT:
--   - publish V2
--   - change outlet assignments
--   - modify Opening V1
--   - modify historical reports
-- ============================================================


-- ============================================================
-- TEMP SEED: SECTIONS
-- ============================================================

create temporary table opening_v2_section_seed (
  code text primary key,
  name text not null,
  description text,
  sort_order integer not null
) on commit drop;

insert into opening_v2_section_seed (
  code,
  name,
  description,
  sort_order
)
values
  (
    'EXTERIOR',
    'Exterior / Entrance',
    'Opening readiness of storefront, entrance, access, parking and guest arrival areas.',
    1
  ),
  (
    'FOH',
    'FOH / Dining',
    'Front of house and guest dining readiness before service.',
    2
  ),
  (
    'CASHIER_POS',
    'Cashier / POS',
    'Cashier, POS, ordering, payment and connectivity readiness.',
    3
  ),
  (
    'TOILET',
    'Toilet / Guest Facilities',
    'Guest toilet cleanliness, supplies and facility readiness.',
    4
  ),
  (
    'KITCHEN',
    'Kitchen / BOH',
    'Kitchen, storage, preparation, equipment and BOH readiness.',
    5
  ),
  (
    'SAFETY',
    'Safety / Facility',
    'Operational safety, lighting, ventilation, emergency access and security systems.',
    6
  ),
  (
    'FINAL_READINESS',
    'Final Readiness',
    'Final operational confirmation before opening the outlet.',
    7
  );


-- ============================================================
-- TEMP SEED: KITCHEN GROUPS
-- ============================================================

create temporary table opening_v2_group_seed (
  section_code text not null,
  code text not null,
  name text not null,
  sort_order integer not null,
  primary key (
    section_code,
    code
  )
) on commit drop;

insert into opening_v2_group_seed (
  section_code,
  code,
  name,
  sort_order
)
values
  ('KITCHEN', 'CLEANING',    'Cleaning & Hygiene', 1),
  ('KITCHEN', 'STORAGE',     'Food Storage',       2),
  ('KITCHEN', 'TEMPERATURE', 'Temperature',        3),
  ('KITCHEN', 'PREPARATION', 'Preparation',        4),
  ('KITCHEN', 'EQUIPMENT',   'Equipment & Utility',5),
  ('KITCHEN', 'FINAL_CHECK', 'Final BOH Check',    6);


-- ============================================================
-- TEMP SEED: QUESTIONS
-- ============================================================

create temporary table opening_v2_question_seed (
  section_code text not null,
  group_code text null,
  code text not null,
  question_text text not null,
  question_type text not null,
  is_required boolean not null default true,
  unit text null,
  min_value numeric null,
  max_value numeric null,
  sort_order integer not null,
  evidence_mode text not null,
  applicability_type text not null,
  facility_key text null,
  primary key (
    section_code,
    code
  )
) on commit drop;


-- ============================================================
-- 1. EXTERIOR / ENTRANCE — 6
-- ============================================================

insert into opening_v2_question_seed values
(
  'EXTERIOR', null,
  'OPN_EXT_001',
  'Main entrance and storefront area are clean and ready for operation?',
  'yes_no', true,
  null, null, null,
  1,
  'always',
  'global',
  null
),
(
  'EXTERIOR', null,
  'OPN_EXT_002',
  'Signage and branding are clean, visible and properly positioned?',
  'yes_no', true,
  null, null, null,
  2,
  'on_issue',
  'global',
  null
),
(
  'EXTERIOR', null,
  'OPN_EXT_003',
  'Guest entrance and access path are clear, safe and unobstructed?',
  'yes_no', true,
  null, null, null,
  3,
  'on_issue',
  'global',
  null
),
(
  'EXTERIOR', null,
  'OPN_EXT_004',
  'Parking area is clean, organized and ready for operation?',
  'yes_no', true,
  null, null, null,
  4,
  'always',
  'facility',
  'PARKING'
),
(
  'EXTERIOR', null,
  'OPN_EXT_005',
  'Valet station is ready for operation?',
  'yes_no', true,
  null, null, null,
  5,
  'on_issue',
  'facility',
  'VALET'
),
(
  'EXTERIOR', null,
  'OPN_EXT_006',
  'Outdoor waiting / queue area is clean and ready for guests?',
  'yes_no', true,
  null, null, null,
  6,
  'on_issue',
  'facility',
  'OUTDOOR_WAITING'
);


-- ============================================================
-- 2. FOH / DINING — 9
-- ============================================================

insert into opening_v2_question_seed values
(
  'FOH', null,
  'OPN_FOH_001',
  'Dining floor and guest areas are clean and ready for service?',
  'yes_no', true,
  null, null, null,
  1,
  'always',
  'global',
  null
),
(
  'FOH', null,
  'OPN_FOH_002',
  'Tables and chairs are clean, properly arranged and in good condition?',
  'yes_no', true,
  null, null, null,
  2,
  'on_issue',
  'global',
  null
),
(
  'FOH', null,
  'OPN_FOH_003',
  'Table settings are complete and ready for service?',
  'yes_no', true,
  null, null, null,
  3,
  'on_issue',
  'global',
  null
),
(
  'FOH', null,
  'OPN_FOH_004',
  'Menus / QR menu materials are clean, accessible and ready for guests?',
  'yes_no', true,
  null, null, null,
  4,
  'on_issue',
  'global',
  null
),
(
  'FOH', null,
  'OPN_FOH_005',
  'Tissue, condiments and required guest supplies are fully prepared?',
  'yes_no', true,
  null, null, null,
  5,
  'on_issue',
  'global',
  null
),
(
  'FOH', null,
  'OPN_FOH_006',
  'Service stations are clean, organized and sufficiently stocked?',
  'yes_no', true,
  null, null, null,
  6,
  'on_issue',
  'global',
  null
),
(
  'FOH', null,
  'OPN_FOH_007',
  'Guest-facing dining equipment used by the outlet is clean and functioning normally?',
  'yes_no', true,
  null, null, null,
  7,
  'on_issue',
  'global',
  null
),
(
  'FOH', null,
  'OPN_FOH_008',
  'VIP room is clean, properly set and ready for guests?',
  'yes_no', true,
  null, null, null,
  8,
  'always',
  'facility',
  'VIP_ROOM'
),
(
  'FOH', null,
  'OPN_FOH_009',
  'Outdoor dining area is clean, properly set and ready for guests?',
  'yes_no', true,
  null, null, null,
  9,
  'always',
  'facility',
  'OUTDOOR_DINING'
);


-- ============================================================
-- 3. CASHIER / POS — 5
-- ============================================================

insert into opening_v2_question_seed values
(
  'CASHIER_POS', null,
  'OPN_POS_001',
  'POS and ordering systems are online, logged in and ready for operation?',
  'yes_no', true,
  null, null, null,
  1,
  'on_issue',
  'global',
  null
),
(
  'CASHIER_POS', null,
  'OPN_POS_002',
  'Receipt and order printers are connected and functioning normally?',
  'yes_no', true,
  null, null, null,
  2,
  'on_issue',
  'global',
  null
),
(
  'CASHIER_POS', null,
  'OPN_POS_003',
  'Internet and network connectivity are available and stable for operation?',
  'yes_no', true,
  null, null, null,
  3,
  'on_issue',
  'global',
  null
),
(
  'CASHIER_POS', null,
  'OPN_POS_004',
  'Electronic payment / QR systems used by the outlet are ready and functioning normally?',
  'yes_no', true,
  null, null, null,
  4,
  'on_issue',
  'global',
  null
),
(
  'CASHIER_POS', null,
  'OPN_POS_005',
  'Cash drawer and opening float are prepared according to outlet procedure?',
  'yes_no', true,
  null, null, null,
  5,
  'on_issue',
  'facility',
  'CASH_PAYMENT'
);


-- ============================================================
-- 4. TOILET / GUEST FACILITIES — 5
-- ============================================================

insert into opening_v2_question_seed values
(
  'TOILET', null,
  'OPN_TOI_001',
  'Guest toilet is clean, dry and ready for operation?',
  'yes_no', true,
  null, null, null,
  1,
  'always',
  'facility',
  'GUEST_TOILET'
),
(
  'TOILET', null,
  'OPN_TOI_002',
  'Toilet tissue, hand soap and required guest supplies are fully stocked?',
  'yes_no', true,
  null, null, null,
  2,
  'on_issue',
  'facility',
  'GUEST_TOILET'
),
(
  'TOILET', null,
  'OPN_TOI_003',
  'Sink, faucet, toilet and other guest toilet fixtures are functioning normally with no visible leak?',
  'yes_no', true,
  null, null, null,
  3,
  'on_issue',
  'facility',
  'GUEST_TOILET'
),
(
  'TOILET', null,
  'OPN_TOI_004',
  'Guest toilet has no unpleasant odor and ventilation is functioning properly?',
  'yes_no', true,
  null, null, null,
  4,
  'on_issue',
  'facility',
  'GUEST_TOILET'
),
(
  'TOILET', null,
  'OPN_TOI_005',
  'Guest toilet bins are clean and properly lined?',
  'yes_no', true,
  null, null, null,
  5,
  'on_issue',
  'facility',
  'GUEST_TOILET'
);


-- ============================================================
-- 5. KITCHEN / BOH — 21
-- Retains V1 intent and adds separate GAS_SYSTEM rule.
-- ============================================================

insert into opening_v2_question_seed values
(
  'KITCHEN', 'CLEANING',
  'OPN_CLEAN_01',
  'Kitchen floor and working areas are clean and ready for operation?',
  'yes_no', true,
  null, null, null,
  1,
  'always',
  'global',
  null
),
(
  'KITCHEN', 'CLEANING',
  'OPN_CLEAN_02',
  'Preparation tables and food-contact surfaces are clean and sanitized?',
  'yes_no', true,
  null, null, null,
  2,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'CLEANING',
  'OPN_CLEAN_03',
  'Hand washing station is clean, functional and fully supplied?',
  'yes_no', true,
  null, null, null,
  3,
  'on_issue',
  'global',
  null
),

(
  'KITCHEN', 'STORAGE',
  'OPN_STORE_01',
  'Raw and ready-to-eat food are stored separately and safely?',
  'yes_no', true,
  null, null, null,
  4,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'STORAGE',
  'OPN_STORE_02',
  'All prepared and opened food items have proper label and date?',
  'yes_no', true,
  null, null, null,
  5,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'STORAGE',
  'OPN_STORE_03',
  'FIFO / FEFO storage arrangement is properly implemented?',
  'yes_no', true,
  null, null, null,
  6,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'STORAGE',
  'OPN_STORE_04',
  'There are no expired, spoiled or unsafe food items in storage?',
  'yes_no', true,
  null, null, null,
  7,
  'on_issue',
  'global',
  null
),

(
  'KITCHEN', 'TEMPERATURE',
  'OPN_TEMP_01',
  'Chiller temperature',
  'temperature', true,
  '°C', 1, 4,
  8,
  'always',
  'global',
  null
),
(
  'KITCHEN', 'TEMPERATURE',
  'OPN_TEMP_02',
  'Freezer temperature',
  'temperature', true,
  '°C', null, -18,
  9,
  'always',
  'global',
  null
),

(
  'KITCHEN', 'PREPARATION',
  'OPN_PREP_01',
  'Required ingredients and mise en place are prepared for opening service?',
  'yes_no', true,
  null, null, null,
  10,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'PREPARATION',
  'OPN_PREP_02',
  'Sauces, condiments and kitchen preparation items are ready for service?',
  'yes_no', true,
  null, null, null,
  11,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'PREPARATION',
  'OPN_PREP_03',
  'Kitchen utensils and food containers are clean and ready to use?',
  'yes_no', true,
  null, null, null,
  12,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'PREPARATION',
  'OPN_PREP_04',
  'Opening stock quantity is sufficient for initial service?',
  'yes_no', true,
  null, null, null,
  13,
  'on_issue',
  'global',
  null
),

(
  'KITCHEN', 'EQUIPMENT',
  'OPN_EQUIP_01',
  'Cooking equipment required for operation is functioning normally?',
  'yes_no', true,
  null, null, null,
  14,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'EQUIPMENT',
  'OPN_EQUIP_02',
  'Chiller and freezer units are operating normally?',
  'yes_no', true,
  null, null, null,
  15,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'EQUIPMENT',
  'OPN_EQUIP_03',
  'Exhaust hood and ventilation system are functioning normally?',
  'yes_no', true,
  null, null, null,
  16,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'EQUIPMENT',
  'OPN_EQUIP_04',
  'Electrical and water supply are available with no visible safety issue?',
  'yes_no', true,
  null, null, null,
  17,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'EQUIPMENT',
  'OPN_EQUIP_05',
  'Gas supply and gas installation are ready for operation with no visible safety issue?',
  'yes_no', true,
  null, null, null,
  18,
  'on_issue',
  'facility',
  'GAS_SYSTEM'
),

(
  'KITCHEN', 'FINAL_CHECK',
  'OPN_FINAL_01',
  'Fire extinguisher and emergency access are unobstructed and ready?',
  'yes_no', true,
  null, null, null,
  19,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'FINAL_CHECK',
  'OPN_FINAL_02',
  'There are no visible signs of pest activity in the kitchen?',
  'yes_no', true,
  null, null, null,
  20,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'FINAL_CHECK',
  'OPN_FINAL_03',
  'Kitchen / BOH is fully ready to begin restaurant operations?',
  'yes_no', true,
  null, null, null,
  21,
  'always',
  'global',
  null
);


-- ============================================================
-- 6. SAFETY / FACILITY — 4
-- ============================================================

insert into opening_v2_question_seed values
(
  'SAFETY', null,
  'OPN_SAFE_001',
  'Guest-area lighting required for operation is functioning normally?',
  'yes_no', true,
  null, null, null,
  1,
  'on_issue',
  'global',
  null
),
(
  'SAFETY', null,
  'OPN_SAFE_002',
  'Air conditioning and ventilation required for operation are functioning normally?',
  'yes_no', true,
  null, null, null,
  2,
  'on_issue',
  'global',
  null
),
(
  'SAFETY', null,
  'OPN_SAFE_003',
  'Emergency access and required fire safety equipment are unobstructed and ready?',
  'yes_no', true,
  null, null, null,
  3,
  'on_issue',
  'global',
  null
),
(
  'SAFETY', null,
  'OPN_SAFE_004',
  'CCTV / security monitoring equipment is functioning normally?',
  'yes_no', true,
  null, null, null,
  4,
  'on_issue',
  'facility',
  'CCTV'
);


-- ============================================================
-- 7. FINAL READINESS — 3
-- ============================================================

insert into opening_v2_question_seed values
(
  'FINAL_READINESS', null,
  'OPN_READY_001',
  'Opening briefing / pre-service briefing has been completed by the responsible team?',
  'yes_no', true,
  null, null, null,
  1,
  'on_issue',
  'global',
  null
),
(
  'FINAL_READINESS', null,
  'OPN_READY_002',
  'There are no unresolved critical operational or safety issues before opening?',
  'yes_no', true,
  null, null, null,
  2,
  'on_issue',
  'global',
  null
),
(
  'FINAL_READINESS', null,
  'OPN_READY_003',
  'Outlet is fully ready to begin restaurant operations?',
  'yes_no', true,
  null, null, null,
  3,
  'always',
  'global',
  null
);


-- ============================================================
-- PRE-CREATION VALIDATION
-- ============================================================

do $$
declare
  v_form_count integer;
  v_form_id uuid;
  v_org_id uuid;
  v_v1_question_count integer;
begin

  select count(*)
    into v_form_count
  from public.forms
  where code = 'OPENING';

  if v_form_count <> 1 then
    raise exception
      'Expected exactly 1 OPENING form, found %.',
      v_form_count;
  end if;

  select
    id,
    organization_id
  into
    v_form_id,
    v_org_id
  from public.forms
  where code = 'OPENING';

  if exists (
    select 1
    from public.form_versions
    where form_id = v_form_id
      and version_number = 2
  ) then
    raise exception
      'OPENING version 2 already exists. Migration stopped.';
  end if;

  if (
    select count(*)
    from opening_v2_section_seed
  ) <> 7 then
    raise exception
      'Opening V2 section seed must contain exactly 7 sections.';
  end if;

  if (
    select count(*)
    from opening_v2_question_seed
  ) <> 53 then
    raise exception
      'Opening V2 question seed must contain exactly 53 questions.';
  end if;

  if (
    select count(*)
    from opening_v2_question_seed
    where evidence_mode = 'always'
  ) <> 11 then
    raise exception
      'Opening V2 must contain exactly 11 always-evidence questions.';
  end if;

  if (
    select count(*)
    from opening_v2_question_seed
    where applicability_type = 'facility'
  ) <> 13 then
    raise exception
      'Opening V2 must contain exactly 13 facility-dependent questions.';
  end if;

  if (
    select count(*)
    from opening_v2_question_seed
    where applicability_type = 'global'
  ) <> 40 then
    raise exception
      'Opening V2 must contain exactly 40 global questions.';
  end if;

  if exists (
    select 1
    from opening_v2_question_seed
    where applicability_type not in (
      'global',
      'facility'
    )
  ) then
    raise exception
      'Invalid applicability type found in Opening V2 seed.';
  end if;

  if exists (
    select 1
    from opening_v2_question_seed
    where
      (
        applicability_type = 'global'
        and facility_key is not null
      )
      or
      (
        applicability_type = 'facility'
        and nullif(
          btrim(facility_key),
          ''
        ) is null
      )
  ) then
    raise exception
      'Invalid applicability source shape found in Opening V2 seed.';
  end if;

  if exists (
    select 1
    from opening_v2_question_seed q
    where q.facility_key is not null
      and not exists (
        select 1
        from public.facility_definitions fd
        where fd.organization_id = v_org_id
          and fd.code = q.facility_key
          and fd.is_active = true
      )
  ) then
    raise exception
      'Opening V2 references an undefined or inactive facility key.';
  end if;

  select count(*)
    into v_v1_question_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  join public.form_versions fv
    on fv.id = fvs.form_version_id
  where fv.form_id = v_form_id
    and fv.version_number = 1;

  if v_v1_question_count <> 20 then
    raise exception
      'Opening V1 expected 20 questions, found %. Historical baseline changed.',
      v_v1_question_count;
  end if;

  if not exists (
    select 1
    from public.sections
    where form_id = v_form_id
      and code = 'KITCHEN'
      and is_active = true
  ) then
    raise exception
      'Existing active OPENING KITCHEN section was not found.';
  end if;

end;
$$;


-- ============================================================
-- CREATE FORM VERSION 2
-- ============================================================

insert into public.form_versions (
  form_id,
  version_number,
  status,
  notes
)
select
  f.id,
  2,
  'draft',
  'Restaurant Opening V2 - 7-section operational checklist with evidence and outlet facility applicability.'
from public.forms f
where f.code = 'OPENING';


-- ============================================================
-- CREATE 6 NEW SECTION MASTERS
-- KITCHEN IS REUSED FROM V1
-- ============================================================

insert into public.sections (
  form_id,
  code,
  name,
  description,
  is_active,
  area_code
)
select
  f.id,
  s.code,
  s.name,
  s.description,
  true,
  null
from public.forms f
cross join opening_v2_section_seed s
where f.code = 'OPENING'
  and s.code <> 'KITCHEN';


-- ============================================================
-- ATTACH 7 SECTIONS TO OPENING V2
-- ============================================================

insert into public.form_version_sections (
  form_version_id,
  section_id,
  display_name,
  description,
  sort_order,
  is_required,
  is_active
)
select
  fv.id,
  s.id,
  seed.name,
  seed.description,
  seed.sort_order,
  true,
  true
from public.form_versions fv
join public.forms f
  on f.id = fv.form_id
join opening_v2_section_seed seed
  on true
join public.sections s
  on s.form_id = f.id
 and s.code = seed.code
where f.code = 'OPENING'
  and fv.version_number = 2;


-- ============================================================
-- CREATE KITCHEN QUESTION GROUPS
-- ============================================================

insert into public.question_groups (
  version_section_id,
  code,
  name,
  sort_order,
  is_active
)
select
  fvs.id,
  gs.code,
  gs.name,
  gs.sort_order,
  true
from opening_v2_group_seed gs
join public.forms f
  on f.code = 'OPENING'
join public.form_versions fv
  on fv.form_id = f.id
 and fv.version_number = 2
join public.sections s
  on s.form_id = f.id
 and s.code = gs.section_code
join public.form_version_sections fvs
  on fvs.form_version_id = fv.id
 and fvs.section_id = s.id;


-- ============================================================
-- CREATE 53 QUESTIONS
-- ============================================================

insert into public.questions (
  version_section_id,
  code,
  question_text,
  question_type,
  is_required,
  unit,
  min_value,
  max_value,
  config,
  sort_order,
  is_active,
  question_group_id
)
select
  fvs.id,
  qs.code,
  qs.question_text,
  qs.question_type,
  qs.is_required,
  qs.unit,
  qs.min_value,
  qs.max_value,

  jsonb_build_object(
    'source',
    'RESTAURANT_OPENING_V2',

    'evidence_mode',
    qs.evidence_mode,

    'applicability',
    case
      when qs.applicability_type = 'global'
      then jsonb_build_object(
        'type',
        'global'
      )

      when qs.applicability_type = 'facility'
      then jsonb_build_object(
        'type',
        'facility',
        'facility_key',
        qs.facility_key
      )
    end
  ),

  qs.sort_order,
  true,
  qg.id

from opening_v2_question_seed qs

join public.forms f
  on f.code = 'OPENING'

join public.form_versions fv
  on fv.form_id = f.id
 and fv.version_number = 2

join public.sections s
  on s.form_id = f.id
 and s.code = qs.section_code

join public.form_version_sections fvs
  on fvs.form_version_id = fv.id
 and fvs.section_id = s.id

left join public.question_groups qg
  on qg.version_section_id = fvs.id
 and qg.code = qs.group_code;


-- ============================================================
-- FINAL VALIDATION
-- ============================================================

do $$
declare
  v_form_id uuid;
  v_v2_id uuid;
  v_section_count integer;
  v_question_count integer;
  v_group_count integer;
  v_assignment_count integer;
  v_v1_question_count integer;
  v_always_count integer;
  v_facility_count integer;
  v_global_count integer;
begin

  select id
    into v_form_id
  from public.forms
  where code = 'OPENING';

  select id
    into v_v2_id
  from public.form_versions
  where form_id = v_form_id
    and version_number = 2
    and status = 'draft';

  if v_v2_id is null then
    raise exception
      'Opening V2 draft was not created.';
  end if;

  select count(*)
    into v_section_count
  from public.form_version_sections
  where form_version_id = v_v2_id
    and is_active = true;

  if v_section_count <> 7 then
    raise exception
      'Opening V2 expected 7 active sections, found %.',
      v_section_count;
  end if;

  select count(*)
    into v_question_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_v2_id
    and q.is_active = true;

  if v_question_count <> 53 then
    raise exception
      'Opening V2 expected 53 active questions, found %.',
      v_question_count;
  end if;

  select count(*)
    into v_group_count
  from public.question_groups qg
  join public.form_version_sections fvs
    on fvs.id = qg.version_section_id
  where fvs.form_version_id = v_v2_id
    and qg.is_active = true;

  if v_group_count <> 6 then
    raise exception
      'Opening V2 expected 6 Kitchen groups, found %.',
      v_group_count;
  end if;

  select count(*)
    into v_always_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_v2_id
    and q.config ->> 'evidence_mode' = 'always';

  if v_always_count <> 11 then
    raise exception
      'Opening V2 expected 11 always-evidence questions, found %.',
      v_always_count;
  end if;

  select count(*)
    into v_facility_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_v2_id
    and q.config #>> '{applicability,type}' = 'facility';

  if v_facility_count <> 13 then
    raise exception
      'Opening V2 expected 13 facility-dependent questions, found %.',
      v_facility_count;
  end if;

  select count(*)
    into v_global_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_v2_id
    and q.config #>> '{applicability,type}' = 'global';

  if v_global_count <> 40 then
    raise exception
      'Opening V2 expected 40 global questions, found %.',
      v_global_count;
  end if;

  select count(*)
    into v_assignment_count
  from public.outlet_form_assignments
  where form_version_id = v_v2_id;

  if v_assignment_count <> 0 then
    raise exception
      'Opening V2 must not have outlet assignments yet.';
  end if;

  select count(*)
    into v_v1_question_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  join public.form_versions fv
    on fv.id = fvs.form_version_id
  where fv.form_id = v_form_id
    and fv.version_number = 1;

  if v_v1_question_count <> 20 then
    raise exception
      'Opening V1 changed unexpectedly. Expected 20 questions, found %.',
      v_v1_question_count;
  end if;

end;
$$;

commit;
