begin;

-- ============================================================
-- DD FACILITY CONFIG + SEMINYAK PUBLIC LIFT
-- ============================================================

create temporary table dd_facility_context (
  organization_id uuid not null,
  cgu_outlet_id uuid not null,
  smy_outlet_id uuid not null,
  opening_foh_v4_id uuid not null,
  opening_foh_section_id uuid not null
) on commit drop;

do $$
declare
  v_org_id uuid;
  v_cgu_id uuid;
  v_smy_id uuid;
  v_form_id uuid;
  v_version_id uuid;
  v_section_id uuid;
  v_count integer;
begin
  select o.id, o.organization_id
    into v_cgu_id, v_org_id
  from public.outlets o
  where upper(o.code) = 'CGU'
    and o.is_active = true
  limit 1;

  if v_cgu_id is null or v_org_id is null then
    raise exception 'DD FACILITY STOP: active CGU outlet not found.';
  end if;

  select o.id
    into v_smy_id
  from public.outlets o
  where upper(o.code) = 'SMY'
    and o.organization_id = v_org_id
    and o.is_active = true
  limit 1;

  if v_smy_id is null then
    raise exception 'DD FACILITY STOP: active SMY outlet not found.';
  end if;

  select f.id
    into v_form_id
  from public.forms f
  where f.organization_id = v_org_id
    and upper(f.code) = 'OPENING_FOH'
    and f.is_active = true
  limit 1;

  if v_form_id is null then
    raise exception 'DD FACILITY STOP: OPENING_FOH form not found.';
  end if;

  select fv.id
    into v_version_id
  from public.form_versions fv
  where fv.form_id = v_form_id
    and fv.version_number = 4
    and fv.status = 'draft'
  limit 1;

  if v_version_id is null then
    raise exception 'DD FACILITY STOP: DD OPENING_FOH v4 draft not found.';
  end if;

  select count(*)
    into v_count
  from public.form_version_sections fvs
  where fvs.form_version_id = v_version_id
    and fvs.is_active = true;

  if v_count <> 1 then
    raise exception
      'DD FACILITY STOP: expected 1 active OPENING_FOH v4 section, found %.',
      v_count;
  end if;

  select fvs.id
    into v_section_id
  from public.form_version_sections fvs
  where fvs.form_version_id = v_version_id
    and fvs.is_active = true
  order by fvs.id::text
  limit 1;

  select count(*)
    into v_count
  from public.questions q
  where q.version_section_id = v_section_id
    and q.is_active = true;

  if v_count <> 59 then
    raise exception
      'DD FACILITY STOP: expected 59 active OPENING_FOH v4 questions before lift addition, found %.',
      v_count;
  end if;

  if exists (
    select 1
    from public.questions q
    where q.version_section_id = v_section_id
      and upper(q.code) = 'OPN_FOH_060'
  ) then
    raise exception 'DD FACILITY STOP: OPN_FOH_060 already exists.';
  end if;

  insert into dd_facility_context values (
    v_org_id,
    v_cgu_id,
    v_smy_id,
    v_version_id,
    v_section_id
  );
end;
$$;

-- ============================================================
-- 1. FACILITY MASTER: LIFT
-- ============================================================

insert into public.facility_definitions (
  organization_id,
  code,
  name,
  description,
  is_active
)
select
  organization_id,
  'LIFT',
  'Lift / Elevator',
  'Guest/public lift or elevator available at the outlet.',
  true
from dd_facility_context
on conflict (organization_id, code)
do update set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  updated_at = now();

-- ============================================================
-- 2. CONFIRMED DD OUTLET FACILITY VALUES
-- ============================================================

create temporary table dd_facility_seed (
  outlet_code text not null,
  facility_code text not null,
  is_available boolean not null,
  primary key (outlet_code, facility_code)
) on commit drop;

insert into dd_facility_seed values
  ('CGU', 'GENSET', true),
  ('CGU', 'PLAYGROUND', true),
  ('CGU', 'KARAOKE', true),
  ('CGU', 'LIFT', false),
  ('SMY', 'GENSET', false),
  ('SMY', 'PLAYGROUND', true),
  ('SMY', 'KARAOKE', true),
  ('SMY', 'LIFT', true);

insert into public.outlet_facilities (
  outlet_id,
  facility_id,
  is_available
)
select
  o.id,
  fd.id,
  s.is_available
from dd_facility_seed s
join public.outlets o
  on upper(o.code) = s.outlet_code
 and o.organization_id = (select organization_id from dd_facility_context limit 1)
 and o.is_active = true
join public.facility_definitions fd
  on fd.organization_id = o.organization_id
 and upper(fd.code) = s.facility_code
 and fd.is_active = true
on conflict (outlet_id, facility_id)
do update set
  is_available = excluded.is_available,
  updated_at = now();

-- ============================================================
-- 3. DD OPENING_FOH v4 — LIFT GROUP
-- ============================================================

create temporary table dd_lift_group (
  group_id uuid not null
) on commit drop;

insert into dd_lift_group values (gen_random_uuid());

insert into public.question_groups (
  id,
  version_section_id,
  code,
  name,
  sort_order,
  is_active
)
select
  g.group_id,
  ctx.opening_foh_section_id,
  'LIFT_AREA',
  'Lift / Elevator',
  18,
  true
from dd_lift_group g
cross join dd_facility_context ctx;

insert into public.question_group_translations (
  question_group_id,
  locale,
  display_name,
  description
)
select
  group_id,
  'en',
  'Lift / Elevator',
  'Guest lift condition, cleanliness and operational readiness.'
from dd_lift_group
union all
select
  group_id,
  'id-ID',
  'Lift / Elevator',
  'Kondisi, kebersihan, dan kesiapan operasional lift untuk tamu.'
from dd_lift_group;

-- ============================================================
-- 4. DD OPENING_FOH v4 — LIFT QUESTION
-- ============================================================

create temporary table dd_lift_question (
  question_id uuid not null
) on commit drop;

insert into dd_lift_question values (gen_random_uuid());

insert into public.questions (
  id,
  version_section_id,
  question_group_id,
  code,
  question_text,
  help_text,
  question_type,
  is_required,
  unit,
  min_value,
  max_value,
  placeholder,
  config,
  sort_order,
  is_active
)
select
  qid.question_id,
  ctx.opening_foh_section_id,
  grp.group_id,
  'OPN_FOH_060',
  'Lift is clean, operational, and ready for guest use.',
  null,
  'yes_no',
  true,
  null,
  null,
  null,
  null,
  jsonb_build_object(
    'evidence_mode', 'always',
    'applicability', jsonb_build_object(
      'type', 'facility',
      'facility_key', 'LIFT'
    )
  ),
  10,
  true
from dd_lift_question qid
cross join dd_lift_group grp
cross join dd_facility_context ctx;

insert into public.question_translations (
  question_id,
  locale,
  question_text,
  help_text
)
select
  question_id,
  'en',
  'Lift is clean, operational, and ready for guest use.',
  null
from dd_lift_question
union all
select
  question_id,
  'id-ID',
  'Lift bersih, berfungsi dengan baik, dan siap digunakan tamu.',
  null
from dd_lift_question;

-- ============================================================
-- 5. RULES
-- ============================================================

insert into public.question_rules (
  question_id,
  rule_type,
  condition,
  action_config,
  sort_order,
  is_active
)
select question_id, 'require_photo',
  jsonb_build_object('operator','always'),
  jsonb_build_object('required',true),
  5, true
from dd_lift_question
union all
select question_id, 'require_notes',
  jsonb_build_object('operator','equals','value',false),
  '{}'::jsonb,
  10, true
from dd_lift_question
union all
select question_id, 'flag_issue',
  jsonb_build_object('operator','equals','value',false),
  '{}'::jsonb,
  30, true
from dd_lift_question
union all
select question_id, 'require_corrective_action',
  jsonb_build_object('operator','equals','value',false),
  '{}'::jsonb,
  40, true
from dd_lift_question;

-- ============================================================
-- 6. POST-FLIGHT
-- ============================================================

do $$
declare
  v_count integer;
  v_bad text;
begin
  select string_agg(
    s.outlet_code || ':' || s.facility_code,
    ', ' order by s.outlet_code, s.facility_code
  )
  into v_bad
  from dd_facility_seed s
  join public.outlets o
    on upper(o.code) = s.outlet_code
   and o.organization_id = (select organization_id from dd_facility_context limit 1)
  join public.facility_definitions fd
    on fd.organization_id = o.organization_id
   and upper(fd.code) = s.facility_code
  left join public.outlet_facilities ofc
    on ofc.outlet_id = o.id
   and ofc.facility_id = fd.id
  where ofc.id is null
     or ofc.is_available is distinct from s.is_available;

  if v_bad is not null then
    raise exception
      'DD FACILITY POSTFLIGHT: facility values mismatch: %.',
      v_bad;
  end if;

  select string_agg(o.code, ', ' order by o.code)
    into v_bad
  from public.outlets o
  where upper(o.code) in ('CGU', 'SMY')
    and o.organization_id = (select organization_id from dd_facility_context limit 1)
    and (
      select count(distinct fd.code)
      from public.outlet_facilities ofc
      join public.facility_definitions fd
        on fd.id = ofc.facility_id
       and fd.organization_id = o.organization_id
       and fd.is_active = true
      where ofc.outlet_id = o.id
        and upper(fd.code) in (
          'PARKING',
          'VALET',
          'VIP_ROOM',
          'GENSET',
          'CCTV',
          'PLAYGROUND',
          'KARAOKE',
          'GUEST_TOILET',
          'GAS_SYSTEM'
        )
    ) <> 9;

  if v_bad is not null then
    raise exception
      'DD FACILITY POSTFLIGHT: incomplete original 9-facility config for: %.',
      v_bad;
  end if;

  select count(*)
    into v_count
  from public.outlets o
  join public.facility_definitions fd
    on fd.organization_id = o.organization_id
   and upper(fd.code) = 'LIFT'
   and fd.is_active = true
  join public.outlet_facilities ofc
    on ofc.outlet_id = o.id
   and ofc.facility_id = fd.id
  where upper(o.code) in ('CGU', 'SMY')
    and o.organization_id = (select organization_id from dd_facility_context limit 1);

  if v_count <> 2 then
    raise exception
      'DD FACILITY POSTFLIGHT: LIFT must be configured for both DD outlets, found %.',
      v_count;
  end if;

  select count(*)
    into v_count
  from public.questions q
  join dd_facility_context ctx
    on q.version_section_id = ctx.opening_foh_section_id
  where q.is_active = true;

  if v_count <> 60 then
    raise exception
      'DD FACILITY POSTFLIGHT: expected 60 active OPENING_FOH v4 questions, found %.',
      v_count;
  end if;

  select count(*)
    into v_count
  from public.question_groups qg
  join dd_facility_context ctx
    on qg.version_section_id = ctx.opening_foh_section_id
  where qg.is_active = true;

  if v_count <> 8 then
    raise exception
      'DD FACILITY POSTFLIGHT: expected 8 active OPENING_FOH v4 groups, found %.',
      v_count;
  end if;

  select count(*)
    into v_count
  from public.questions q
  join dd_facility_context ctx
    on q.version_section_id = ctx.opening_foh_section_id
  where q.is_active = true
    and q.config #>> '{applicability,type}' = 'facility';

  if v_count <> 22 then
    raise exception
      'DD FACILITY POSTFLIGHT: expected 22 facility-scoped OPENING_FOH v4 questions, found %.',
      v_count;
  end if;

  select count(*)
    into v_count
  from public.questions q
  join dd_facility_context ctx
    on q.version_section_id = ctx.opening_foh_section_id
  where q.is_active = true
    and q.config ->> 'evidence_mode' = 'always';

  if v_count <> 60 then
    raise exception
      'DD FACILITY POSTFLIGHT: expected all 60 OPENING_FOH v4 questions all-photo, found %.',
      v_count;
  end if;

  select count(distinct qt.locale)
    into v_count
  from public.question_translations qt
  join public.questions q on q.id = qt.question_id
  join dd_facility_context ctx
    on q.version_section_id = ctx.opening_foh_section_id
  where q.code = 'OPN_FOH_060'
    and qt.locale in ('en', 'id-ID');

  if v_count <> 2 then
    raise exception
      'DD FACILITY POSTFLIGHT: lift question is not bilingual.';
  end if;

  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o on o.id = ofa.outlet_id
  join public.forms f on f.id = ofa.form_id
  where upper(o.code) in ('CGU', 'SMY')
    and ofa.is_active = true
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    );

  if v_count <> 0 then
    raise exception
      'DD FACILITY POSTFLIGHT: split DD assignments changed unexpectedly.';
  end if;
end;
$$;

commit;
