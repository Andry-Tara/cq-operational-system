begin;

-- ============================================================
-- RESTAURANT CLOSING V2
--
-- Creates:
--   - CLOSING form version 2 as DRAFT
--   - 7 version sections
--   - 6 new section masters + reuse existing KITCHEN
--   - 5 Kitchen question groups
--   - 52 questions
--   - evidence mode configuration
--   - outlet facility applicability rules
--
-- Does NOT:
--   - publish V2
--   - change outlet assignments
--   - modify Closing V1
--   - modify historical reports
-- ============================================================


-- ============================================================
-- SECTION SEED
-- ============================================================

create temporary table closing_v2_section_seed (
  code text primary key,
  name text not null,
  description text,
  sort_order integer not null
) on commit drop;

insert into closing_v2_section_seed (
  code,
  name,
  description,
  sort_order
)
values
  (
    'EXTERIOR',
    'Exterior / Entrance',
    'Closing condition of storefront, entrance, access and guest arrival areas.',
    1
  ),
  (
    'FOH',
    'FOH / Dining',
    'Front of house and dining-area closing condition after service.',
    2
  ),
  (
    'CASHIER_POS',
    'Cashier / POS',
    'Cashier, POS, payment and settlement closing checks.',
    3
  ),
  (
    'TOILET',
    'Toilet / Guest Facilities',
    'Guest toilet cleaning and closing condition.',
    4
  ),
  (
    'KITCHEN',
    'Kitchen / BOH',
    'Kitchen, storage, cleaning, equipment and BOH closing checks.',
    5
  ),
  (
    'SAFETY',
    'Safety / Security',
    'Utility, emergency access, security and outlet securing checks.',
    6
  ),
  (
    'FINAL_CLOSING',
    'Final Closing',
    'Final operational confirmation before leaving the outlet.',
    7
  );


-- ============================================================
-- KITCHEN GROUP SEED
-- ============================================================

create temporary table closing_v2_group_seed (
  section_code text not null,
  code text not null,
  name text not null,
  sort_order integer not null,
  primary key (
    section_code,
    code
  )
) on commit drop;

insert into closing_v2_group_seed (
  section_code,
  code,
  name,
  sort_order
)
values
  ('KITCHEN', 'CLEANING',     'Cleaning & Waste',    1),
  ('KITCHEN', 'STORAGE',      'Food Storage',        2),
  ('KITCHEN', 'TEMPERATURE',  'Temperature',         3),
  ('KITCHEN', 'EQUIPMENT',    'Equipment & Utility', 4),
  ('KITCHEN', 'PEST_CONTROL', 'Pest Control',        5);


-- ============================================================
-- QUESTION SEED
-- ============================================================

create temporary table closing_v2_question_seed (
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
-- 1. EXTERIOR / ENTRANCE — 5
-- ============================================================

insert into closing_v2_question_seed values
(
  'EXTERIOR', null,
  'CLS_EXT_001',
  'Main entrance and storefront area are clean before the outlet is secured?',
  'yes_no', true,
  null, null, null,
  1,
  'always',
  'global',
  null
),
(
  'EXTERIOR', null,
  'CLS_EXT_002',
  'Guest entrance and access path are clear and free from operational items or waste?',
  'yes_no', true,
  null, null, null,
  2,
  'on_issue',
  'global',
  null
),
(
  'EXTERIOR', null,
  'CLS_EXT_003',
  'Parking area is clear, clean and properly secured after operation?',
  'yes_no', true,
  null, null, null,
  3,
  'on_issue',
  'facility',
  'PARKING'
),
(
  'EXTERIOR', null,
  'CLS_EXT_004',
  'Valet operation has been properly closed and related items have been secured?',
  'yes_no', true,
  null, null, null,
  4,
  'on_issue',
  'facility',
  'VALET'
),
(
  'EXTERIOR', null,
  'CLS_EXT_005',
  'Outdoor waiting / queue area has been cleaned and secured?',
  'yes_no', true,
  null, null, null,
  5,
  'on_issue',
  'facility',
  'OUTDOOR_WAITING'
);


-- ============================================================
-- 2. FOH / DINING — 8
-- ============================================================

insert into closing_v2_question_seed values
(
  'FOH', null,
  'CLS_FOH_001',
  'Dining floor and guest-facing areas are clean after service?',
  'yes_no', true,
  null, null, null,
  1,
  'always',
  'global',
  null
),
(
  'FOH', null,
  'CLS_FOH_002',
  'Tables and chairs are clean and properly arranged for the next operation?',
  'yes_no', true,
  null, null, null,
  2,
  'on_issue',
  'global',
  null
),
(
  'FOH', null,
  'CLS_FOH_003',
  'Menus / QR menu stands and guest-facing materials are clean and properly stored?',
  'yes_no', true,
  null, null, null,
  3,
  'on_issue',
  'global',
  null
),
(
  'FOH', null,
  'CLS_FOH_004',
  'Condiments, tissue and service items are cleaned, covered or stored correctly?',
  'yes_no', true,
  null, null, null,
  4,
  'on_issue',
  'global',
  null
),
(
  'FOH', null,
  'CLS_FOH_005',
  'Service stations are clean, organized and free from leftover food or waste?',
  'yes_no', true,
  null, null, null,
  5,
  'on_issue',
  'global',
  null
),
(
  'FOH', null,
  'CLS_FOH_006',
  'No foreign, personal or unnecessary operational items remain visible in guest areas?',
  'yes_no', true,
  null, null, null,
  6,
  'on_issue',
  'global',
  null
),
(
  'FOH', null,
  'CLS_FOH_007',
  'VIP room has been cleaned, reset and secured?',
  'yes_no', true,
  null, null, null,
  7,
  'always',
  'facility',
  'VIP_ROOM'
),
(
  'FOH', null,
  'CLS_FOH_008',
  'Outdoor dining area has been cleaned and secured?',
  'yes_no', true,
  null, null, null,
  8,
  'always',
  'facility',
  'OUTDOOR_DINING'
);


-- ============================================================
-- 3. CASHIER / POS — 6
-- ============================================================

insert into closing_v2_question_seed values
(
  'CASHIER_POS', null,
  'CLS_POS_001',
  'All POS transactions have been closed according to outlet procedure?',
  'yes_no', true,
  null, null, null,
  1,
  'on_issue',
  'global',
  null
),
(
  'CASHIER_POS', null,
  'CLS_POS_002',
  'Electronic payment / EDC settlement has been completed according to outlet procedure?',
  'yes_no', true,
  null, null, null,
  2,
  'on_issue',
  'global',
  null
),
(
  'CASHIER_POS', null,
  'CLS_POS_003',
  'Cash closing procedure has been completed and cash has been properly secured?',
  'yes_no', true,
  null, null, null,
  3,
  'on_issue',
  'facility',
  'CASH_PAYMENT'
),
(
  'CASHIER_POS', null,
  'CLS_POS_004',
  'POS terminals, printers and cashier devices have been left in the correct closing condition?',
  'yes_no', true,
  null, null, null,
  4,
  'on_issue',
  'global',
  null
),
(
  'CASHIER_POS', null,
  'CLS_POS_005',
  'Sensitive documents, payment devices and cashier equipment have been secured?',
  'yes_no', true,
  null, null, null,
  5,
  'on_issue',
  'global',
  null
),
(
  'CASHIER_POS', null,
  'CLS_POS_006',
  'No unresolved cashier or payment discrepancy remains before closing?',
  'yes_no', true,
  null, null, null,
  6,
  'on_issue',
  'global',
  null
);


-- ============================================================
-- 4. TOILET / GUEST FACILITIES — 5
-- ============================================================

insert into closing_v2_question_seed values
(
  'TOILET', null,
  'CLS_TOI_001',
  'Guest toilet has been cleaned and left dry after operation?',
  'yes_no', true,
  null, null, null,
  1,
  'always',
  'facility',
  'GUEST_TOILET'
),
(
  'TOILET', null,
  'CLS_TOI_002',
  'Toilet waste has been removed and bins have been cleaned and relined?',
  'yes_no', true,
  null, null, null,
  2,
  'on_issue',
  'facility',
  'GUEST_TOILET'
),
(
  'TOILET', null,
  'CLS_TOI_003',
  'Sink, faucet, toilet and other fixtures show no visible leak or operational issue?',
  'yes_no', true,
  null, null, null,
  3,
  'on_issue',
  'facility',
  'GUEST_TOILET'
),
(
  'TOILET', null,
  'CLS_TOI_004',
  'Toilet supplies have been prepared for the next operation?',
  'yes_no', true,
  null, null, null,
  4,
  'on_issue',
  'facility',
  'GUEST_TOILET'
),
(
  'TOILET', null,
  'CLS_TOI_005',
  'Toilet ventilation and odor condition are acceptable before closing?',
  'yes_no', true,
  null, null, null,
  5,
  'on_issue',
  'facility',
  'GUEST_TOILET'
);


-- ============================================================
-- 5. KITCHEN / BOH — 20
-- ============================================================

insert into closing_v2_question_seed values
(
  'KITCHEN', 'CLEANING',
  'CLS_KIT_001',
  'All preparation and working tables are clean and sanitized?',
  'yes_no', true,
  null, null, null,
  1,
  'always',
  'global',
  null
),
(
  'KITCHEN', 'CLEANING',
  'CLS_KIT_002',
  'Kitchen floor is clean and free from food residue, grease and standing water?',
  'yes_no', true,
  null, null, null,
  2,
  'always',
  'global',
  null
),
(
  'KITCHEN', 'CLEANING',
  'CLS_KIT_003',
  'All kitchen utensils and food containers are clean and properly stored?',
  'yes_no', true,
  null, null, null,
  3,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'CLEANING',
  'CLS_KIT_004',
  'Kitchen machines and food-contact equipment have been cleaned after use?',
  'yes_no', true,
  null, null, null,
  4,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'CLEANING',
  'CLS_KIT_005',
  'Grease trap has been cleaned according to closing procedure?',
  'yes_no', true,
  null, null, null,
  5,
  'always',
  'global',
  null
),
(
  'KITCHEN', 'CLEANING',
  'CLS_KIT_006',
  'Gutter / floor drain area is clean and free from excessive residue?',
  'yes_no', true,
  null, null, null,
  6,
  'always',
  'global',
  null
),
(
  'KITCHEN', 'CLEANING',
  'CLS_KIT_007',
  'All kitchen waste has been transferred to the designated disposal area?',
  'yes_no', true,
  null, null, null,
  7,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'CLEANING',
  'CLS_KIT_008',
  'Kitchen waste bins are clean and relined with new bags?',
  'yes_no', true,
  null, null, null,
  8,
  'on_issue',
  'global',
  null
),

(
  'KITCHEN', 'STORAGE',
  'CLS_STORE_001',
  'Chilled and frozen food is hygienically stored, covered and properly labeled and date-marked?',
  'yes_no', true,
  null, null, null,
  9,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'STORAGE',
  'CLS_STORE_002',
  'Raw and ready-to-eat products are stored separately and safely?',
  'yes_no', true,
  null, null, null,
  10,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'STORAGE',
  'CLS_STORE_003',
  'FIFO / FEFO arrangement is maintained before closing storage?',
  'yes_no', true,
  null, null, null,
  11,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'STORAGE',
  'CLS_STORE_004',
  'No expired, spoiled or unsafe food remains in storage?',
  'yes_no', true,
  null, null, null,
  12,
  'on_issue',
  'global',
  null
),

(
  'KITCHEN', 'TEMPERATURE',
  'CLS_TEMP_001',
  'Chiller temperature',
  'temperature', true,
  '°C', 1, 4,
  13,
  'always',
  'global',
  null
),
(
  'KITCHEN', 'TEMPERATURE',
  'CLS_TEMP_002',
  'Freezer temperature',
  'temperature', true,
  '°C', null, -18,
  14,
  'always',
  'global',
  null
),

(
  'KITCHEN', 'EQUIPMENT',
  'CLS_EQUIP_001',
  'Fryer, oven, soup warmer, rice cooker and other cooking equipment are left in the correct closing condition?',
  'yes_no', true,
  null, null, null,
  15,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'EQUIPMENT',
  'CLS_EQUIP_002',
  'Cooking equipment that must be switched off has been safely switched off?',
  'yes_no', true,
  null, null, null,
  16,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'EQUIPMENT',
  'CLS_EQUIP_003',
  'Gas supply and gas installation have been safely shut down according to procedure?',
  'yes_no', true,
  null, null, null,
  17,
  'always',
  'facility',
  'GAS_SYSTEM'
),
(
  'KITCHEN', 'EQUIPMENT',
  'CLS_EQUIP_004',
  'Chiller and freezer units that must remain operational are running normally?',
  'yes_no', true,
  null, null, null,
  18,
  'on_issue',
  'global',
  null
),

(
  'KITCHEN', 'PEST_CONTROL',
  'CLS_PEST_001',
  'Pest traps have been inspected according to closing procedure?',
  'yes_no', true,
  null, null, null,
  19,
  'on_issue',
  'global',
  null
),
(
  'KITCHEN', 'PEST_CONTROL',
  'CLS_PEST_002',
  'There are no visible signs of pest activity in the Kitchen / BOH area?',
  'yes_no', true,
  null, null, null,
  20,
  'on_issue',
  'global',
  null
);


-- ============================================================
-- 6. SAFETY / SECURITY — 5
-- ============================================================

insert into closing_v2_question_seed values
(
  'SAFETY', null,
  'CLS_SAFE_001',
  'Non-essential electrical equipment and lighting have been switched off?',
  'yes_no', true,
  null, null, null,
  1,
  'on_issue',
  'global',
  null
),
(
  'SAFETY', null,
  'CLS_SAFE_002',
  'Required fire safety equipment and emergency access remain unobstructed?',
  'yes_no', true,
  null, null, null,
  2,
  'on_issue',
  'global',
  null
),
(
  'SAFETY', null,
  'CLS_SAFE_003',
  'CCTV / security monitoring equipment that must remain active is functioning normally?',
  'yes_no', true,
  null, null, null,
  3,
  'on_issue',
  'facility',
  'CCTV'
),
(
  'SAFETY', null,
  'CLS_SAFE_004',
  'Water, electrical and utility areas show no visible safety issue before the outlet is secured?',
  'yes_no', true,
  null, null, null,
  4,
  'on_issue',
  'global',
  null
),
(
  'SAFETY', null,
  'CLS_SAFE_005',
  'All required doors, access points and restricted areas have been secured?',
  'yes_no', true,
  null, null, null,
  5,
  'always',
  'global',
  null
);


-- ============================================================
-- 7. FINAL CLOSING — 3
-- ============================================================

insert into closing_v2_question_seed values
(
  'FINAL_CLOSING', null,
  'CLS_FINAL_001',
  'There are no unresolved critical operational or safety issues before leaving the outlet?',
  'yes_no', true,
  null, null, null,
  1,
  'on_issue',
  'global',
  null
),
(
  'FINAL_CLOSING', null,
  'CLS_FINAL_002',
  'All required closing procedures have been completed by the responsible team?',
  'yes_no', true,
  null, null, null,
  2,
  'on_issue',
  'global',
  null
),
(
  'FINAL_CLOSING', null,
  'CLS_FINAL_003',
  'Outlet is fully closed, secured and ready to be left unattended?',
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
  where code = 'CLOSING';

  if v_form_count <> 1 then
    raise exception
      'Expected exactly 1 CLOSING form, found %.',
      v_form_count;
  end if;

  select
    id,
    organization_id
  into
    v_form_id,
    v_org_id
  from public.forms
  where code = 'CLOSING';

  if exists (
    select 1
    from public.form_versions
    where form_id = v_form_id
      and version_number = 2
  ) then
    raise exception
      'CLOSING version 2 already exists. Migration stopped.';
  end if;

  if (
    select count(*)
    from closing_v2_section_seed
  ) <> 7 then
    raise exception
      'Closing V2 section seed must contain exactly 7 sections.';
  end if;

  if (
    select count(*)
    from closing_v2_question_seed
  ) <> 52 then
    raise exception
      'Closing V2 question seed must contain exactly 52 questions.';
  end if;

  if (
    select count(*)
    from closing_v2_question_seed
    where evidence_mode = 'always'
  ) <> 14 then
    raise exception
      'Closing V2 must contain exactly 14 always-evidence questions.';
  end if;

  if (
    select count(*)
    from closing_v2_question_seed
    where evidence_mode = 'on_issue'
  ) <> 38 then
    raise exception
      'Closing V2 must contain exactly 38 on-issue evidence questions.';
  end if;

  if (
    select count(*)
    from closing_v2_question_seed
    where applicability_type = 'facility'
  ) <> 13 then
    raise exception
      'Closing V2 must contain exactly 13 facility-dependent questions.';
  end if;

  if (
    select count(*)
    from closing_v2_question_seed
    where applicability_type = 'global'
  ) <> 39 then
    raise exception
      'Closing V2 must contain exactly 39 global questions.';
  end if;

  if exists (
    select 1
    from closing_v2_question_seed
    where evidence_mode not in (
      'always',
      'on_issue'
    )
  ) then
    raise exception
      'Invalid evidence mode found in Closing V2 seed.';
  end if;

  if exists (
    select 1
    from closing_v2_question_seed
    where applicability_type not in (
      'global',
      'facility'
    )
  ) then
    raise exception
      'Invalid applicability type found in Closing V2 seed.';
  end if;

  if exists (
    select 1
    from closing_v2_question_seed
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
      'Invalid applicability source shape found in Closing V2 seed.';
  end if;

  if exists (
    select 1
    from closing_v2_question_seed q
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
      'Closing V2 references an undefined or inactive facility key.';
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
      'Closing V1 expected 20 questions, found %. Historical baseline changed.',
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
      'Existing active CLOSING KITCHEN section was not found.';
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
  'Restaurant Closing V2 - 7-section closing checklist with evidence and outlet facility applicability.'
from public.forms f
where f.code = 'CLOSING';


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
  seed.code,
  seed.name,
  seed.description,
  true,
  null
from public.forms f
cross join closing_v2_section_seed seed
where f.code = 'CLOSING'
  and seed.code <> 'KITCHEN';


-- ============================================================
-- ATTACH 7 SECTIONS TO CLOSING V2
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
join closing_v2_section_seed seed
  on true
join public.sections s
  on s.form_id = f.id
 and s.code = seed.code
where f.code = 'CLOSING'
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
from closing_v2_group_seed gs
join public.forms f
  on f.code = 'CLOSING'
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
-- CREATE 52 QUESTIONS
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
    'RESTAURANT_CLOSING_V2',

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

from closing_v2_question_seed qs

join public.forms f
  on f.code = 'CLOSING'

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
  v_on_issue_count integer;
  v_facility_count integer;
  v_global_count integer;
begin

  select id
    into v_form_id
  from public.forms
  where code = 'CLOSING';

  select id
    into v_v2_id
  from public.form_versions
  where form_id = v_form_id
    and version_number = 2
    and status = 'draft';

  if v_v2_id is null then
    raise exception
      'Closing V2 draft was not created.';
  end if;

  select count(*)
    into v_section_count
  from public.form_version_sections
  where form_version_id = v_v2_id
    and is_active = true;

  if v_section_count <> 7 then
    raise exception
      'Closing V2 expected 7 active sections, found %.',
      v_section_count;
  end if;

  select count(*)
    into v_question_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_v2_id
    and q.is_active = true;

  if v_question_count <> 52 then
    raise exception
      'Closing V2 expected 52 active questions, found %.',
      v_question_count;
  end if;

  select count(*)
    into v_group_count
  from public.question_groups qg
  join public.form_version_sections fvs
    on fvs.id = qg.version_section_id
  where fvs.form_version_id = v_v2_id
    and qg.is_active = true;

  if v_group_count <> 5 then
    raise exception
      'Closing V2 expected 5 Kitchen groups, found %.',
      v_group_count;
  end if;

  select count(*)
    into v_always_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_v2_id
    and q.config ->> 'evidence_mode' = 'always';

  if v_always_count <> 14 then
    raise exception
      'Closing V2 expected 14 always-evidence questions, found %.',
      v_always_count;
  end if;

  select count(*)
    into v_on_issue_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_v2_id
    and q.config ->> 'evidence_mode' = 'on_issue';

  if v_on_issue_count <> 38 then
    raise exception
      'Closing V2 expected 38 on-issue evidence questions, found %.',
      v_on_issue_count;
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
      'Closing V2 expected 13 facility-dependent questions, found %.',
      v_facility_count;
  end if;

  select count(*)
    into v_global_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_v2_id
    and q.config #>> '{applicability,type}' = 'global';

  if v_global_count <> 39 then
    raise exception
      'Closing V2 expected 39 global questions, found %.',
      v_global_count;
  end if;

  select count(*)
    into v_assignment_count
  from public.outlet_form_assignments
  where form_version_id = v_v2_id;

  if v_assignment_count <> 0 then
    raise exception
      'Closing V2 must not have outlet assignments yet.';
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
      'Closing V1 changed unexpectedly. Expected 20 questions, found %.',
      v_v1_question_count;
  end if;

end;
$$;

commit;
