begin;

-- ============================================================
-- O3D - SEED SPLIT CLOSING CHECKLISTS
--
-- Source:
--   Form Operational - CQ Hangtuah.xlsx
--   - Closing FOH Checklist: 12 questions
--   - Closing BOH Checklist: 21 questions
--
-- Important:
--   - Wording is preserved from the workbook source.
--   - No source groups exist in either Closing sheet.
--   - Initial evidence mode is "on_issue".
--   - Facility applicability is only assigned where the
--     workbook item clearly depends on an outlet facility.
--   - This migration does NOT publish or activate any form.
-- ============================================================


create temporary table split_closing_section_seed (
  form_code text primary key,
  section_code text not null,
  section_name text not null,
  description text null,
  sort_order integer not null
) on commit drop;

insert into split_closing_section_seed values
  (
    'CLOSING_FOH',
    'FOH',
    'FOH',
    'Closing FOH operational checklist.',
    10
  ),
  (
    'CLOSING_BOH',
    'BOH',
    'BOH / Kitchen',
    'Closing BOH operational checklist.',
    10
  );


create temporary table split_closing_question_seed (
  form_code text not null,
  section_code text not null,
  code text not null,
  question_text text not null,
  question_type text not null,
  is_required boolean not null,
  sort_order integer not null,
  evidence_mode text not null,
  applicability_type text not null,
  facility_key text null,
  primary key (form_code, code)
) on commit drop;


insert into split_closing_question_seed values

  -- CLOSING FOH - exact workbook wording
  (
    'CLOSING_FOH','FOH','CLS_FOH_001',
    'Lantai Bersih','yes_no',true,10,
    'on_issue','global',null
  ),
  (
    'CLOSING_FOH','FOH','CLS_FOH_002',
    'Meja Bersih','yes_no',true,20,
    'on_issue','global',null
  ),
  (
    'CLOSING_FOH','FOH','CLS_FOH_003',
    'Kursi Bersih','yes_no',true,30,
    'on_issue','global',null
  ),
  (
    'CLOSING_FOH','FOH','CLS_FOH_004',
    'Perlengkapan Kerja Bersih','yes_no',true,40,
    'on_issue','global',null
  ),
  (
    'CLOSING_FOH','FOH','CLS_FOH_005',
    'Sauce Station Bersih (Ice Crushed sudah diangkat)',
    'yes_no',true,50,
    'on_issue','global',null
  ),
  (
    'CLOSING_FOH','FOH','CLS_FOH_006',
    'Condiment sudah tersimpan dengan baik',
    'yes_no',true,60,
    'on_issue','global',null
  ),
  (
    'CLOSING_FOH','FOH','CLS_FOH_007',
    'Toilet sudah bersih','yes_no',true,70,
    'on_issue','facility','GUEST_TOILET'
  ),
  (
    'CLOSING_FOH','FOH','CLS_FOH_008',
    'Tidak ada kotoran hama / hama di seluruh area',
    'yes_no',true,80,
    'on_issue','global',null
  ),
  (
    'CLOSING_FOH','FOH','CLS_FOH_009',
    'Tidak ada barang asing yg terlihat oleh tamu',
    'yes_no',true,90,
    'on_issue','global',null
  ),
  (
    'CLOSING_FOH','FOH','CLS_FOH_010',
    'Seluruh sampah sudah ditaruh di tempat pembuangan',
    'yes_no',true,100,
    'on_issue','global',null
  ),
  (
    'CLOSING_FOH','FOH','CLS_FOH_011',
    'Seluruh tempat sampah sudah bersih dan terlapisi dengan plastik yang baru dan bersih',
    'yes_no',true,110,
    'on_issue','global',null
  ),
  (
    'CLOSING_FOH','FOH','CLS_FOH_012',
    'Pintu Outlet telah terkunci dengan baik',
    'yes_no',true,120,
    'on_issue','global',null
  ),

  -- CLOSING BOH - exact workbook wording
  (
    'CLOSING_BOH','BOH','CLS_BOH_001',
    'Seluruh meja bersih','yes_no',true,10,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_002',
    'Seluruh lantai bersih','yes_no',true,20,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_003',
    'Seluruh peralatan bersih dan tersimpan tertutup pada tempatnya',
    'yes_no',true,30,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_004',
    'Seluruh mesin bersih dan tersimpan tertutup pada tempatnya',
    'yes_no',true,40,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_005',
    'Grease Trap bersih','yes_no',true,50,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_006',
    'Seluruh sampah sudah ditaruh di tempat pembuangan',
    'yes_no',true,60,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_007',
    'Seluruh tempat sampah sudah bersih dan terlapisi dengan plastik yang baru dan bersih',
    'yes_no',true,70,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_008',
    'Gutter/Gorong-Gorong bersih','yes_no',true,80,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_009',
    'Seluruh stock basah disimpan dgn suhu tepat serta higienis dan tertutup (diberi label nama dan tgl)',
    'yes_no',true,90,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_010',
    'Suhu Chiller berada di antara 1-4°C',
    'yes_no',true,100,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_011',
    'Suhu Freezer berada di -18°C atau lebih rendah',
    'yes_no',true,110,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_012',
    'Pintu chiller, freezer dan gudang tertutup & terkunci',
    'yes_no',true,120,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_013',
    'Fryer & oven sudah dingin, soupwarmer & ricecooker bersih',
    'yes_no',true,130,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_014',
    'Kompor BOH dalam kondisi aman seluruhnya',
    'yes_no',true,140,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_015',
    'Kondisi gas dan kompor BOH sudah dalam keadaan mati (pipa gas sentral)',
    'yes_no',true,150,
    'on_issue','facility','GAS_SYSTEM'
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_016',
    'Fixer & area sudut dinding, sogemerner & recooker bersih',
    'yes_no',true,160,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_017',
    'Seluruh lampu telah dipadamkan',
    'yes_no',true,170,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_018',
    'Pest Trap sudah diperiksa',
    'yes_no',true,180,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_019',
    'Tidak ada kotoran hama / hama di serluruh area',
    'yes_no',true,190,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_020',
    'Tidak ada barang asing yg terlihat oleh tamu',
    'yes_no',true,200,
    'on_issue','global',null
  ),
  (
    'CLOSING_BOH','BOH','CLS_BOH_021',
    'Outlet sudah terkunci dengan baik',
    'yes_no',true,210,
    'on_issue','global',null
  );


-- ============================================================
-- SEED INVARIANTS
-- ============================================================

do $$
begin

  if (
    select count(*)
    from split_closing_question_seed
    where form_code = 'CLOSING_FOH'
  ) <> 12 then
    raise exception
      'CLOSING_FOH seed must contain exactly 12 questions.';
  end if;

  if (
    select count(*)
    from split_closing_question_seed
    where form_code = 'CLOSING_BOH'
  ) <> 21 then
    raise exception
      'CLOSING_BOH seed must contain exactly 21 questions.';
  end if;

  if (
    select count(*)
    from split_closing_question_seed
    where form_code = 'CLOSING_FOH'
      and applicability_type = 'facility'
  ) <> 1 then
    raise exception
      'CLOSING_FOH seed must contain exactly 1 facility-dependent question.';
  end if;

  if (
    select count(*)
    from split_closing_question_seed
    where form_code = 'CLOSING_BOH'
      and applicability_type = 'facility'
  ) <> 1 then
    raise exception
      'CLOSING_BOH seed must contain exactly 1 facility-dependent question.';
  end if;

end;
$$;


-- ============================================================
-- TARGET FORM SAFETY
-- ============================================================

do $$
declare
  v_missing text;
begin

  select string_agg(
    concat(f.organization_id, ':', f.code),
    ', '
    order by f.organization_id, f.code
  )
  into v_missing
  from public.forms f
  where f.code in (
    'CLOSING_FOH',
    'CLOSING_BOH'
  )
    and f.operational_scope = 'restaurant'
    and not exists (
      select 1
      from public.form_versions fv
      where fv.form_id = f.id
        and fv.version_number = 1
        and fv.status = 'draft'
    );

  if v_missing is not null then
    raise exception
      'Split Closing v1 DRAFT missing for: %',
      v_missing;
  end if;

  if exists (
    select 1
    from public.forms f
    join public.form_versions fv
      on fv.form_id = f.id
     and fv.version_number = 1
     and fv.status = 'draft'
    join public.form_version_sections fvs
      on fvs.form_version_id = fv.id
    where f.code in (
      'CLOSING_FOH',
      'CLOSING_BOH'
    )
      and f.operational_scope = 'restaurant'
  ) then
    raise exception
      'Split Closing v1 DRAFT already contains section content. Seed stopped.';
  end if;

end;
$$;


-- ============================================================
-- FACILITY DEFINITION SAFETY
-- ============================================================

do $$
declare
  v_missing text;
begin

  select string_agg(
    concat(
      org.organization_id,
      ':',
      seed.facility_key
    ),
    ', '
    order by org.organization_id, seed.facility_key
  )
  into v_missing
  from (
    select distinct organization_id
    from public.forms
    where code in (
      'CLOSING_FOH',
      'CLOSING_BOH'
    )
      and operational_scope = 'restaurant'
  ) org
  cross join (
    select distinct facility_key
    from split_closing_question_seed
    where applicability_type = 'facility'
  ) seed
  where not exists (
    select 1
    from public.facility_definitions fd
    where fd.organization_id = org.organization_id
      and fd.code = seed.facility_key
      and fd.is_active = true
  );

  if v_missing is not null then
    raise exception
      'Required facility definitions missing/inactive: %',
      v_missing;
  end if;

end;
$$;


-- ============================================================
-- SECTION MASTER + VERSION SECTIONS
-- ============================================================

insert into public.sections (
  form_id,
  code,
  name,
  description,
  is_active
)
select
  f.id,
  ss.section_code,
  ss.section_name,
  ss.description,
  true
from split_closing_section_seed ss
join public.forms f
  on f.code = ss.form_code
 and f.operational_scope = 'restaurant'
on conflict (form_id, code)
do update set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  updated_at = now();


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
  ss.section_name,
  ss.description,
  ss.sort_order,
  true,
  true
from split_closing_section_seed ss
join public.forms f
  on f.code = ss.form_code
 and f.operational_scope = 'restaurant'
join public.form_versions fv
  on fv.form_id = f.id
 and fv.version_number = 1
 and fv.status = 'draft'
join public.sections s
  on s.form_id = f.id
 and s.code = ss.section_code;


-- ============================================================
-- QUESTIONS
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
  null,
  null,
  null,
  jsonb_build_object(
    'source',
    'FORM_OPERATIONAL_CQ_HANGTUAH',
    'evidence_mode',
    qs.evidence_mode,
    'applicability',
      case
        when qs.applicability_type = 'facility'
        then jsonb_build_object(
          'type',
          'facility',
          'facility_key',
          qs.facility_key
        )
        else jsonb_build_object('type', 'global')
      end
  ),
  qs.sort_order,
  true,
  null
from split_closing_question_seed qs
join public.forms f
  on f.code = qs.form_code
 and f.operational_scope = 'restaurant'
join public.form_versions fv
  on fv.form_id = f.id
 and fv.version_number = 1
 and fv.status = 'draft'
join public.sections s
  on s.form_id = f.id
 and s.code = qs.section_code
join public.form_version_sections fvs
  on fvs.form_version_id = fv.id
 and fvs.section_id = s.id;


-- ============================================================
-- YES / NO ISSUE RULES
-- ============================================================

insert into public.question_rules (
  question_id,
  rule_type,
  condition,
  action_config,
  sort_order,
  is_active
)
select
  q.id,
  r.rule_type,
  jsonb_build_object(
    'operator',
    'equals',
    'value',
    false
  ),
  '{}'::jsonb,
  r.sort_order,
  true
from public.questions q
join public.form_version_sections fvs
  on fvs.id = q.version_section_id
join public.form_versions fv
  on fv.id = fvs.form_version_id
join public.forms f
  on f.id = fv.form_id
cross join (
  values
    ('require_notes'::text, 10),
    ('flag_issue'::text, 30),
    ('require_corrective_action'::text, 40)
) r(rule_type, sort_order)
where f.code in (
  'CLOSING_FOH',
  'CLOSING_BOH'
)
  and f.operational_scope = 'restaurant'
  and fv.version_number = 1
  and fv.status = 'draft';


-- ============================================================
-- POST-SEED VERIFICATION
-- ============================================================

do $$
declare
  v_target record;
  v_questions integer;
  v_groups integer;
  v_facility integer;
  v_on_issue integer;
  v_expected integer;
begin

  for v_target in
    select
      f.id,
      f.organization_id,
      f.code
    from public.forms f
    where f.code in (
      'CLOSING_FOH',
      'CLOSING_BOH'
    )
      and f.operational_scope = 'restaurant'
    order by f.organization_id, f.code
  loop

    v_expected :=
      case
        when v_target.code = 'CLOSING_FOH'
        then 12
        else 21
      end;

    select count(*)
    into v_questions
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    where fv.form_id = v_target.id
      and fv.version_number = 1
      and fv.status = 'draft'
      and q.is_active = true;

    select count(*)
    into v_groups
    from public.question_groups qg
    join public.form_version_sections fvs
      on fvs.id = qg.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    where fv.form_id = v_target.id
      and fv.version_number = 1
      and fv.status = 'draft'
      and qg.is_active = true;

    select count(*)
    into v_facility
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    where fv.form_id = v_target.id
      and fv.version_number = 1
      and fv.status = 'draft'
      and q.config #>> '{applicability,type}' = 'facility';

    select count(*)
    into v_on_issue
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    join public.form_versions fv
      on fv.id = fvs.form_version_id
    where fv.form_id = v_target.id
      and fv.version_number = 1
      and fv.status = 'draft'
      and q.config ->> 'evidence_mode' = 'on_issue';

    if v_questions <> v_expected then
      raise exception
        '% / % expected % questions, found %.',
        v_target.organization_id,
        v_target.code,
        v_expected,
        v_questions;
    end if;

    if v_groups <> 0 then
      raise exception
        '% / % expected 0 source groups, found %.',
        v_target.organization_id,
        v_target.code,
        v_groups;
    end if;

    if v_facility <> 1 then
      raise exception
        '% / % expected 1 facility-dependent question, found %.',
        v_target.organization_id,
        v_target.code,
        v_facility;
    end if;

    if v_on_issue <> v_expected then
      raise exception
        '% / % expected % on_issue questions, found %.',
        v_target.organization_id,
        v_target.code,
        v_expected,
        v_on_issue;
    end if;

  end loop;

end;
$$;


commit;
