begin;

-- ============================================================
-- O3K-A — CREATE ALL-PHOTO DRAFTS FOR SPLIT CQ OUTLET FORMS
--
-- Scope:
--   OPENING_FOH
--   OPENING_BOH
--   CLOSING_FOH
--   CLOSING_BOH
--
-- CQ source outlets:
--   BDG, GS, HT, MOI, PIM, PL, PP, SP, TBZ
--
-- DOES NOT publish or activate.
-- DOES NOT change current assignments/history.
-- DOES NOT touch DD or CK.
-- ============================================================

create temporary table o3k_target_forms (
  form_code text primary key,
  expected_questions integer not null,
  expected_groups integer not null,
  expected_facility_questions integer not null
) on commit drop;

insert into o3k_target_forms values
  ('OPENING_FOH', 59, 6, 21),
  ('OPENING_BOH', 33, 0, 0),
  ('CLOSING_FOH', 12, 0, 1),
  ('CLOSING_BOH', 21, 0, 1);

create temporary table o3k_target_outlets (
  outlet_code text primary key
) on commit drop;

insert into o3k_target_outlets values
  ('BDG'), ('GS'), ('HT'), ('MOI'), ('PIM'),
  ('PL'), ('PP'), ('SP'), ('TBZ');

create temporary table o3k_version_map (
  form_code text primary key,
  form_id uuid not null unique,
  source_version_id uuid not null unique,
  source_version_number integer not null,
  draft_version_id uuid not null unique,
  draft_version_number integer not null
) on commit drop;


-- ============================================================
-- PRE-FLIGHT
-- ============================================================

do $$
declare
  v_org_id uuid;
  v_count integer;
  v_bad text;
begin
  select o.organization_id
  into v_org_id
  from public.outlets o
  where upper(o.code) = 'BDG'
    and o.is_active = true
  limit 1;

  if v_org_id is null then
    raise exception 'O3K-A STOP: active BDG outlet not found.';
  end if;

  select count(*)
  into v_count
  from o3k_target_outlets t
  join public.outlets o
    on upper(o.code) = t.outlet_code
   and o.organization_id = v_org_id
   and o.is_active = true;

  if v_count <> 9 then
    raise exception
      'O3K-A STOP: expected 9 active CQ outlets, found %.',
      v_count;
  end if;

  select count(*)
  into v_count
  from o3k_target_forms t
  join public.forms f
    on upper(f.code) = t.form_code
   and f.organization_id = v_org_id
   and f.operational_scope = 'restaurant'
   and f.is_active = true;

  if v_count <> 4 then
    raise exception
      'O3K-A STOP: expected 4 active split forms, found %.',
      v_count;
  end if;

  select string_agg(f.code, ', ' order by f.code)
  into v_bad
  from public.forms f
  where f.organization_id = v_org_id
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    )
    and exists (
      select 1
      from public.form_versions fv
      where fv.form_id = f.id
        and fv.status = 'draft'
    );

  if v_bad is not null then
    raise exception
      'O3K-A STOP: existing draft found for: %.',
      v_bad;
  end if;

  -- 9 outlets x 4 active published split assignments = 36.
  select count(*)
  into v_count
  from o3k_target_outlets ot
  join public.outlets o
    on upper(o.code) = ot.outlet_code
   and o.organization_id = v_org_id
   and o.is_active = true
  join public.outlet_form_assignments ofa
    on ofa.outlet_id = o.id
   and ofa.is_active = true
  join public.forms f
    on f.id = ofa.form_id
   and f.organization_id = v_org_id
  join o3k_target_forms tf
    on tf.form_code = upper(f.code)
  join public.form_versions fv
    on fv.id = ofa.form_version_id
   and fv.form_id = f.id
   and fv.status = 'published';

  if v_count <> 36 then
    raise exception
      'O3K-A STOP: expected 36 active published CQ split assignments, found %.',
      v_count;
  end if;

  -- One common source version per form across all 9 CQ outlets.
  select string_agg(x.form_code, ', ' order by x.form_code)
  into v_bad
  from (
    select
      upper(f.code) as form_code,
      count(distinct ofa.form_version_id) as version_count,
      count(distinct o.id) as outlet_count
    from o3k_target_outlets ot
    join public.outlets o
      on upper(o.code) = ot.outlet_code
     and o.organization_id = v_org_id
     and o.is_active = true
    join public.outlet_form_assignments ofa
      on ofa.outlet_id = o.id
     and ofa.is_active = true
    join public.forms f
      on f.id = ofa.form_id
     and f.organization_id = v_org_id
    join o3k_target_forms tf
      on tf.form_code = upper(f.code)
    join public.form_versions fv
      on fv.id = ofa.form_version_id
     and fv.form_id = f.id
     and fv.status = 'published'
    group by upper(f.code)
  ) x
  where x.version_count <> 1
     or x.outlet_count <> 9;

  if v_bad is not null then
    raise exception
      'O3K-A STOP: CQ source version mismatch for: %.',
      v_bad;
  end if;

  -- Proven checklist shape from BDG source assignment.
  select string_agg(
    f.code || '(q=' || x.question_count ||
    ',g=' || x.group_count ||
    ',facility=' || x.facility_count || ')',
    ', ' order by f.code
  )
  into v_bad
  from public.forms f
  join o3k_target_forms tf
    on tf.form_code = upper(f.code)
  join lateral (
    select
      (
        select count(*)
        from public.questions q
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where fvs.form_version_id = (
          select ofa.form_version_id
          from public.outlet_form_assignments ofa
          join public.outlets o
            on o.id = ofa.outlet_id
          where ofa.form_id = f.id
            and ofa.is_active = true
            and upper(o.code) = 'BDG'
          limit 1
        )
          and q.is_active = true
      ) as question_count,
      (
        select count(*)
        from public.question_groups qg
        join public.form_version_sections fvs
          on fvs.id = qg.version_section_id
        where fvs.form_version_id = (
          select ofa.form_version_id
          from public.outlet_form_assignments ofa
          join public.outlets o
            on o.id = ofa.outlet_id
          where ofa.form_id = f.id
            and ofa.is_active = true
            and upper(o.code) = 'BDG'
          limit 1
        )
          and qg.is_active = true
      ) as group_count,
      (
        select count(*)
        from public.questions q
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where fvs.form_version_id = (
          select ofa.form_version_id
          from public.outlet_form_assignments ofa
          join public.outlets o
            on o.id = ofa.outlet_id
          where ofa.form_id = f.id
            and ofa.is_active = true
            and upper(o.code) = 'BDG'
          limit 1
        )
          and q.is_active = true
          and q.config #>> '{applicability,type}' = 'facility'
      ) as facility_count
  ) x on true
  where f.organization_id = v_org_id
    and (
      x.question_count <> tf.expected_questions
      or x.group_count <> tf.expected_groups
      or x.facility_count <> tf.expected_facility_questions
    );

  if v_bad is not null then
    raise exception
      'O3K-A STOP: source graph differs from expected: %.',
      v_bad;
  end if;
end;
$$;


-- ============================================================
-- ALLOCATE FOUR DRAFT VERSIONS
-- ============================================================

do $$
declare
  v_row record;
  v_draft_id uuid;
  v_next_version integer;
begin
  for v_row in
    select
      upper(f.code) as form_code,
      f.id as form_id,
      fv.id as source_version_id,
      fv.version_number as source_version_number
    from public.forms f
    join o3k_target_forms tf
      on tf.form_code = upper(f.code)
    join public.outlet_form_assignments ofa
      on ofa.form_id = f.id
     and ofa.is_active = true
    join public.outlets o
      on o.id = ofa.outlet_id
     and upper(o.code) = 'BDG'
    join public.form_versions fv
      on fv.id = ofa.form_version_id
     and fv.form_id = f.id
     and fv.status = 'published'
    order by f.code
  loop
    select coalesce(max(x.version_number), 0) + 1
    into v_next_version
    from public.form_versions x
    where x.form_id = v_row.form_id;

    insert into public.form_versions (
      form_id,
      version_number,
      status,
      notes
    )
    values (
      v_row.form_id,
      v_next_version,
      'draft',
      'O3K all-photo policy: every operational question requires photo evidence.'
    )
    returning id into v_draft_id;

    insert into o3k_version_map values (
      v_row.form_code,
      v_row.form_id,
      v_row.source_version_id,
      v_row.source_version_number,
      v_draft_id,
      v_next_version
    );
  end loop;
end;
$$;


-- ============================================================
-- CLONE VERSION GRAPH
-- ============================================================

create temporary table o3k_fvs_map (
  old_id uuid primary key,
  new_id uuid not null unique
) on commit drop;

insert into o3k_fvs_map
select fvs.id, gen_random_uuid()
from public.form_version_sections fvs
join o3k_version_map vm
  on vm.source_version_id = fvs.form_version_id;

insert into public.form_version_sections (
  id,
  form_version_id,
  section_id,
  display_name,
  description,
  sort_order,
  is_required,
  is_active
)
select
  m.new_id,
  vm.draft_version_id,
  fvs.section_id,
  fvs.display_name,
  fvs.description,
  fvs.sort_order,
  fvs.is_required,
  fvs.is_active
from public.form_version_sections fvs
join o3k_fvs_map m
  on m.old_id = fvs.id
join o3k_version_map vm
  on vm.source_version_id = fvs.form_version_id;

insert into public.form_version_section_translations (
  version_section_id,
  locale,
  display_name,
  description
)
select
  m.new_id,
  t.locale,
  t.display_name,
  t.description
from public.form_version_section_translations t
join o3k_fvs_map m
  on m.old_id = t.version_section_id;


create temporary table o3k_group_map (
  old_id uuid primary key,
  new_id uuid not null unique
) on commit drop;

insert into o3k_group_map
select qg.id, gen_random_uuid()
from public.question_groups qg
join public.form_version_sections fvs
  on fvs.id = qg.version_section_id
join o3k_version_map vm
  on vm.source_version_id = fvs.form_version_id;

insert into public.question_groups (
  id,
  version_section_id,
  code,
  name,
  sort_order,
  is_active
)
select
  gm.new_id,
  fm.new_id,
  qg.code,
  qg.name,
  qg.sort_order,
  qg.is_active
from public.question_groups qg
join o3k_group_map gm
  on gm.old_id = qg.id
join o3k_fvs_map fm
  on fm.old_id = qg.version_section_id;

insert into public.question_group_translations (
  question_group_id,
  locale,
  display_name,
  description
)
select
  gm.new_id,
  t.locale,
  t.display_name,
  t.description
from public.question_group_translations t
join o3k_group_map gm
  on gm.old_id = t.question_group_id;


create temporary table o3k_question_map (
  old_id uuid primary key,
  new_id uuid not null unique
) on commit drop;

insert into o3k_question_map
select q.id, gen_random_uuid()
from public.questions q
join public.form_version_sections fvs
  on fvs.id = q.version_section_id
join o3k_version_map vm
  on vm.source_version_id = fvs.form_version_id;

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
  qm.new_id,
  fm.new_id,
  gm.new_id,
  q.code,
  q.question_text,
  q.help_text,
  q.question_type,
  q.is_required,
  q.unit,
  q.min_value,
  q.max_value,
  q.placeholder,
  (
    coalesce(q.config, '{}'::jsonb)
    - 'evidence_mode'
  ) || jsonb_build_object(
    'evidence_mode',
    'always'
  ),
  q.sort_order,
  q.is_active
from public.questions q
join o3k_question_map qm
  on qm.old_id = q.id
join o3k_fvs_map fm
  on fm.old_id = q.version_section_id
left join o3k_group_map gm
  on gm.old_id = q.question_group_id;

insert into public.question_translations (
  question_id,
  locale,
  question_text,
  help_text
)
select
  qm.new_id,
  t.locale,
  t.question_text,
  t.help_text
from public.question_translations t
join o3k_question_map qm
  on qm.old_id = t.question_id;


-- Preserve non-photo behavior, then normalize photo requirement.
insert into public.question_rules (
  question_id,
  rule_type,
  condition,
  action_config,
  sort_order,
  is_active
)
select
  qm.new_id,
  qr.rule_type,
  qr.condition,
  qr.action_config,
  qr.sort_order,
  qr.is_active
from public.question_rules qr
join o3k_question_map qm
  on qm.old_id = qr.question_id;

delete from public.question_rules qr
using o3k_question_map qm
where qr.question_id = qm.new_id
  and qr.rule_type = 'require_photo';

insert into public.question_rules (
  question_id,
  rule_type,
  condition,
  action_config,
  sort_order,
  is_active
)
select
  qm.new_id,
  'require_photo',
  jsonb_build_object('operator', 'always'),
  jsonb_build_object('required', true),
  5,
  true
from o3k_question_map qm;


create temporary table o3k_option_map (
  old_id uuid primary key,
  new_id uuid not null unique
) on commit drop;

insert into o3k_option_map
select qo.id, gen_random_uuid()
from public.question_options qo
join o3k_question_map qm
  on qm.old_id = qo.question_id;

insert into public.question_options (
  id,
  question_id,
  value,
  label,
  sort_order,
  is_failure,
  updated_at
)
select
  om.new_id,
  qm.new_id,
  qo.value,
  qo.label,
  qo.sort_order,
  qo.is_failure,
  now()
from public.question_options qo
join o3k_option_map om
  on om.old_id = qo.id
join o3k_question_map qm
  on qm.old_id = qo.question_id;

insert into public.question_option_translations (
  option_id,
  locale,
  label
)
select
  om.new_id,
  t.locale,
  t.label
from public.question_option_translations t
join o3k_option_map om
  on om.old_id = t.option_id;


-- ============================================================
-- POST-FLIGHT
-- ============================================================

do $$
declare
  v_count integer;
  v_bad text;
begin
  if (select count(*) from o3k_version_map) <> 4 then
    raise exception
      'O3K-A STOP: expected 4 newly allocated drafts.';
  end if;

  if exists (
    select 1
    from o3k_version_map vm
    join public.form_versions fv
      on fv.id = vm.draft_version_id
    where fv.status <> 'draft'
       or fv.form_id <> vm.form_id
       or fv.version_number <> vm.draft_version_number
  ) then
    raise exception
      'O3K-A STOP: draft identity/status validation failed.';
  end if;

  select string_agg(
    vm.form_code ||
    '(q=' || x.question_count ||
    ',g=' || x.group_count ||
    ',facility=' || x.facility_count ||
    ',always=' || x.always_count ||
    ',photo_rules=' || x.photo_rule_count || ')',
    ', ' order by vm.form_code
  )
  into v_bad
  from o3k_version_map vm
  join o3k_target_forms tf
    on tf.form_code = vm.form_code
  join lateral (
    select
      (
        select count(*)
        from public.questions q
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where fvs.form_version_id = vm.draft_version_id
          and q.is_active = true
      ) as question_count,
      (
        select count(*)
        from public.question_groups qg
        join public.form_version_sections fvs
          on fvs.id = qg.version_section_id
        where fvs.form_version_id = vm.draft_version_id
          and qg.is_active = true
      ) as group_count,
      (
        select count(*)
        from public.questions q
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where fvs.form_version_id = vm.draft_version_id
          and q.is_active = true
          and q.config #>> '{applicability,type}' = 'facility'
      ) as facility_count,
      (
        select count(*)
        from public.questions q
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where fvs.form_version_id = vm.draft_version_id
          and q.is_active = true
          and q.config ->> 'evidence_mode' = 'always'
      ) as always_count,
      (
        select count(*)
        from public.question_rules qr
        join public.questions q
          on q.id = qr.question_id
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where fvs.form_version_id = vm.draft_version_id
          and q.is_active = true
          and qr.rule_type = 'require_photo'
          and qr.is_active = true
          and qr.condition ->> 'operator' = 'always'
          and coalesce(
            (qr.action_config ->> 'required')::boolean,
            false
          ) = true
      ) as photo_rule_count
  ) x on true
  where x.question_count <> tf.expected_questions
     or x.group_count <> tf.expected_groups
     or x.facility_count <> tf.expected_facility_questions
     or x.always_count <> tf.expected_questions
     or x.photo_rule_count <> tf.expected_questions;

  if v_bad is not null then
    raise exception
      'O3K-A STOP: draft graph/photo verification failed: %.',
      v_bad;
  end if;

  select count(*)
  into v_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  join o3k_version_map vm
    on vm.draft_version_id = fvs.form_version_id
  where q.is_active = true;

  if v_count <> 125 then
    raise exception
      'O3K-A STOP: expected 125 active questions, found %.',
      v_count;
  end if;

  -- Non-photo rules preserved one-for-one.
  if exists (
    select 1
    from o3k_version_map vm
    where (
      select count(*)
      from public.question_rules qr
      join public.questions q
        on q.id = qr.question_id
      join public.form_version_sections fvs
        on fvs.id = q.version_section_id
      where fvs.form_version_id = vm.source_version_id
        and qr.rule_type <> 'require_photo'
    ) <> (
      select count(*)
      from public.question_rules qr
      join public.questions q
        on q.id = qr.question_id
      join public.form_version_sections fvs
        on fvs.id = q.version_section_id
      where fvs.form_version_id = vm.draft_version_id
        and qr.rule_type <> 'require_photo'
    )
  ) then
    raise exception
      'O3K-A STOP: non-photo rule count changed.';
  end if;

  if exists (
    select 1
    from o3k_version_map vm
    join public.form_versions fv
      on fv.id = vm.source_version_id
    where fv.status <> 'published'
  ) then
    raise exception
      'O3K-A STOP: source version status changed.';
  end if;

  if exists (
    select 1
    from o3k_version_map vm
    join public.outlet_form_assignments ofa
      on ofa.form_version_id = vm.draft_version_id
  ) then
    raise exception
      'O3K-A STOP: draft unexpectedly assigned to an outlet.';
  end if;

  if exists (
    select 1
    from o3k_version_map vm
    join public.reports r
      on r.form_version_id = vm.draft_version_id
  ) then
    raise exception
      'O3K-A STOP: draft unexpectedly referenced by a report.';
  end if;

  if (
    select count(*)
    from o3k_target_outlets ot
    join public.outlets o
      on upper(o.code) = ot.outlet_code
     and o.is_active = true
    join public.outlet_form_assignments ofa
      on ofa.outlet_id = o.id
     and ofa.is_active = true
    join o3k_version_map vm
      on vm.form_id = ofa.form_id
     and vm.source_version_id = ofa.form_version_id
  ) <> 36 then
    raise exception
      'O3K-A STOP: current CQ assignments changed unexpectedly.';
  end if;

  if exists (
    select 1
    from public.outlets o
    join public.outlet_form_assignments ofa
      on ofa.outlet_id = o.id
     and ofa.is_active = true
    join public.forms f
      on f.id = ofa.form_id
    where upper(o.code) in ('CGU', 'SMY')
      and upper(f.code) in (
        'OPENING_FOH',
        'OPENING_BOH',
        'CLOSING_FOH',
        'CLOSING_BOH'
      )
  ) then
    raise exception
      'O3K-A STOP: DD unexpectedly has split assignments.';
  end if;
end;
$$;

commit;
