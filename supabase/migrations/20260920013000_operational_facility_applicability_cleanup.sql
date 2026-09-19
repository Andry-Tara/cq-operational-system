begin;

-- ============================================================
-- OPERATIONAL FACILITY APPLICABILITY CLEANUP
--
-- FINAL SCOPE
--
-- Facility master:
--   SHAO_KAO
--   EMPLOYEE_TOILET
--   EMPLOYEE_LOCKER
--   ICE_CRUSHED
--   STAIRS
--
-- Matrix:
--   11 restaurant outlets x 5 facilities = 55 explicit rows.
--
-- Version strategy:
--
-- CQ:
--   OPENING_FOH v3 -> new draft -> publish -> rollout 9 CQ
--   OPENING_BOH v2 -> new draft -> publish -> rollout 9 CQ
--   CLOSING_FOH v2 -> new draft -> publish -> rollout 9 CQ
--
-- DD:
--   OPENING_FOH v4 -> new draft -> publish -> rollout CGU/SMY
--   CLOSING_FOH v3 -> new draft -> publish -> rollout CGU/SMY
--
-- DD OPENING_BOH v3 intentionally stays unchanged:
-- its 20-question DD checklist does not contain the CQ Shao Kao,
-- locker, or employee toilet questions.
--
-- Historical reports / applicability snapshots are untouched.
-- ============================================================


-- ============================================================
-- 0. CONTEXT
-- ============================================================

create temporary table facility_cleanup_context (
  organization_id uuid not null,
  admin_user_id uuid not null,
  reports_before bigint not null,
  applicability_before bigint not null
) on commit drop;


create temporary table facility_cleanup_matrix (
  outlet_code text primary key,
  shao_kao boolean not null,
  employee_toilet boolean not null,
  employee_locker boolean not null,
  ice_crushed boolean not null,
  stairs boolean not null
) on commit drop;


insert into facility_cleanup_matrix values
  ('CGU', true,  true,  true,  true,  false),
  ('SMY', true,  true,  true,  true,  true),
  ('MOI', true,  false, true,  true,  false),
  ('PL',  true,  true,  true,  true,  false),
  ('BDG', true,  true,  true,  true,  true),
  ('SP',  false, true,  true,  true,  true),
  ('PIM', false, false, false, true,  false),
  ('HT',  false, true,  true,  false, true),
  ('PP',  false, false, true,  true,  false),
  ('GS',  false, false, true,  true,  false),
  ('TBZ', false, false, true,  true,  false);


-- ============================================================
-- 1. PREFLIGHT — OUTLETS / ORG / ADMIN / RPC
-- ============================================================

do $$
declare
  v_org_id uuid;
  v_org_count integer;
  v_outlet_count integer;
  v_admin_id uuid;
  v_candidate record;
  v_reports bigint;
  v_app bigint;
begin
  if to_regprocedure(
    'public.clone_form_version_to_draft(uuid)'
  ) is null then
    raise exception
      'FACILITY CLEANUP STOP: clone_form_version_to_draft(uuid) missing.';
  end if;

  if to_regprocedure(
    'public.publish_form_version(uuid)'
  ) is null then
    raise exception
      'FACILITY CLEANUP STOP: publish_form_version(uuid) missing.';
  end if;

  if to_regprocedure(
    'public.activate_outlet_form_version(uuid,uuid)'
  ) is null then
    raise exception
      'FACILITY CLEANUP STOP: activate_outlet_form_version(uuid,uuid) missing.';
  end if;


  select
    count(*),
    count(distinct o.organization_id)
  into
    v_outlet_count,
    v_org_count
  from facility_cleanup_matrix m
  join public.outlets o
    on upper(o.code) = m.outlet_code
   and o.is_active = true;


  select o.organization_id
    into v_org_id
  from facility_cleanup_matrix m
  join public.outlets o
    on upper(o.code) = m.outlet_code
   and o.is_active = true
  order by o.organization_id::text
  limit 1;


  if v_outlet_count <> 11 then
    raise exception
      'FACILITY CLEANUP STOP: expected 11 active target outlets, found %.',
      v_outlet_count;
  end if;


  if v_org_count <> 1 or v_org_id is null then
    raise exception
      'FACILITY CLEANUP STOP: target outlets must belong to exactly one organization.';
  end if;


  if exists (
    select 1
    from facility_cleanup_matrix
    where outlet_code = 'CNT'
  ) then
    raise exception
      'FACILITY CLEANUP STOP: CNT must not be included.';
  end if;


  for v_candidate in
    select p.id
    from public.profiles p
    where p.organization_id = v_org_id
      and coalesce(p.is_active, true) = true
    order by p.id
  loop
    perform set_config(
      'request.jwt.claim.sub',
      v_candidate.id::text,
      true
    );

    perform set_config(
      'request.jwt.claim.role',
      'authenticated',
      true
    );

    if public.is_org_admin(v_org_id) then
      v_admin_id := v_candidate.id;
      exit;
    end if;
  end loop;


  if v_admin_id is null then
    raise exception
      'FACILITY CLEANUP STOP: active organization admin not found.';
  end if;


  select count(*)
    into v_reports
  from public.reports;


  select count(*)
    into v_app
  from public.report_question_applicability;


  insert into facility_cleanup_context (
    organization_id,
    admin_user_id,
    reports_before,
    applicability_before
  )
  values (
    v_org_id,
    v_admin_id,
    v_reports,
    v_app
  );


  perform set_config(
    'request.jwt.claim.sub',
    v_admin_id::text,
    true
  );

  perform set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );
end;
$$;


-- ============================================================
-- 2. FACILITY DEFINITIONS
-- ============================================================

create temporary table facility_cleanup_definition_seed (
  code text primary key,
  name text not null,
  description text not null
) on commit drop;


insert into facility_cleanup_definition_seed values
(
  'SHAO_KAO',
  'Shao Kao Area',
  'Outlet has a Shao Kao area / grill operation.'
),
(
  'EMPLOYEE_TOILET',
  'Employee Toilet',
  'Outlet has a dedicated employee toilet.'
),
(
  'EMPLOYEE_LOCKER',
  'Employee Locker',
  'Outlet has an employee locker / locker corridor area.'
),
(
  'ICE_CRUSHED',
  'Ice Crushed Station',
  'Outlet uses crushed ice at the sauce station.'
),
(
  'STAIRS',
  'Stairs',
  'Outlet has a stair area requiring operational inspection.'
);


insert into public.facility_definitions (
  organization_id,
  code,
  name,
  description,
  is_active
)
select
  ctx.organization_id,
  s.code,
  s.name,
  s.description,
  true
from facility_cleanup_context ctx
cross join facility_cleanup_definition_seed s
on conflict (
  organization_id,
  code
)
do update
set
  name = excluded.name,
  description = excluded.description,
  is_active = true;


-- ============================================================
-- 3. EXPAND EXACT 55-ROW FACILITY MATRIX
-- ============================================================

create temporary table facility_cleanup_expected (
  outlet_code text not null,
  facility_code text not null,
  is_available boolean not null,
  primary key (
    outlet_code,
    facility_code
  )
) on commit drop;


insert into facility_cleanup_expected
select outlet_code, 'SHAO_KAO', shao_kao
from facility_cleanup_matrix

union all

select outlet_code, 'EMPLOYEE_TOILET', employee_toilet
from facility_cleanup_matrix

union all

select outlet_code, 'EMPLOYEE_LOCKER', employee_locker
from facility_cleanup_matrix

union all

select outlet_code, 'ICE_CRUSHED', ice_crushed
from facility_cleanup_matrix

union all

select outlet_code, 'STAIRS', stairs
from facility_cleanup_matrix;


do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
  from facility_cleanup_expected;

  if v_count <> 55 then
    raise exception
      'FACILITY CLEANUP STOP: expected 55 facility matrix rows, found %.',
      v_count;
  end if;
end;
$$;


insert into public.outlet_facilities (
  outlet_id,
  facility_id,
  is_available
)
select
  o.id,
  fd.id,
  e.is_available
from facility_cleanup_expected e
join public.outlets o
  on upper(o.code) = e.outlet_code
 and o.is_active = true
join public.facility_definitions fd
  on fd.organization_id = o.organization_id
 and fd.code = e.facility_code
 and fd.is_active = true
on conflict (
  outlet_id,
  facility_id
)
do update
set
  is_available = excluded.is_available;


-- ============================================================
-- 4. EXACT LIVE SOURCE VERSIONS
-- ============================================================

create temporary table facility_cleanup_versions (
  variant text not null,
  form_code text not null,
  source_version_id uuid not null,
  source_version_number integer not null,
  expected_new_version_number integer not null,
  target_version_id uuid null,
  primary key (
    variant,
    form_code
  )
) on commit drop;


insert into facility_cleanup_versions (
  variant,
  form_code,
  source_version_id,
  source_version_number,
  expected_new_version_number
)
values

-- CQ
(
  'CQ',
  'OPENING_FOH',
  '37c3c67a-4153-4001-9331-31eb4015ebcc',
  3,
  5
),
(
  'CQ',
  'OPENING_BOH',
  '187e65ed-e86f-43e2-94b6-81f4802722b6',
  2,
  4
),
(
  'CQ',
  'CLOSING_FOH',
  'a36cfb7c-ae76-4fb2-98e0-52100b9a5aa7',
  2,
  4
),

-- DD
(
  'DD',
  'OPENING_FOH',
  '3535fe8b-38b1-4d58-b9d6-d4eaa2580305',
  4,
  6
),
(
  'DD',
  'CLOSING_FOH',
  '1a5de8b2-6eb2-44c1-950d-29cf20651335',
  3,
  5
);


-- ============================================================
-- 5. SOURCE VERSION SAFETY GATES
-- ============================================================

do $$
declare
  v_row record;
  v_form_code text;
  v_version_number integer;
  v_status text;
  v_max integer;
begin
  for v_row in
    select *
    from facility_cleanup_versions
    order by
      case form_code
        when 'OPENING_FOH' then 1
        when 'OPENING_BOH' then 2
        when 'CLOSING_FOH' then 3
        else 99
      end,
      case variant
        when 'CQ' then 1
        else 2
      end
  loop

    select
      upper(f.code),
      fv.version_number,
      fv.status
    into
      v_form_code,
      v_version_number,
      v_status
    from public.form_versions fv
    join public.forms f
      on f.id = fv.form_id
    where fv.id = v_row.source_version_id;


    if v_form_code is null then
      raise exception
        'FACILITY CLEANUP STOP: source version % missing.',
        v_row.source_version_id;
    end if;


    if v_form_code <> v_row.form_code
       or v_version_number <> v_row.source_version_number
       or v_status <> 'published' then
      raise exception
        'FACILITY CLEANUP STOP: source mismatch %/% expected v% published, found % v% %.',
        v_row.variant,
        v_row.form_code,
        v_row.source_version_number,
        coalesce(v_form_code, '-'),
        coalesce(v_version_number, -1),
        coalesce(v_status, '-');
    end if;


    select max(fv.version_number)
      into v_max
    from public.form_versions fv
    join public.forms f
      on f.id = fv.form_id
    where upper(f.code) = v_row.form_code
      and f.organization_id = (
        select organization_id
        from facility_cleanup_context
        limit 1
      );


    if v_row.variant = 'CQ' then
      case v_row.form_code
        when 'OPENING_FOH' then
          if v_max <> 4 then
            raise exception
              'FACILITY CLEANUP STOP: OPENING_FOH expected max v4 before clone, found v%.',
              v_max;
          end if;

        when 'OPENING_BOH' then
          if v_max <> 3 then
            raise exception
              'FACILITY CLEANUP STOP: OPENING_BOH expected max v3 before clone, found v%.',
              v_max;
          end if;

        when 'CLOSING_FOH' then
          if v_max <> 3 then
            raise exception
              'FACILITY CLEANUP STOP: CLOSING_FOH expected max v3 before clone, found v%.',
              v_max;
          end if;
      end case;
    end if;

  end loop;
end;
$$;


-- ============================================================
-- 6. QUESTION MAP PER VARIANT
-- ============================================================

create temporary table facility_cleanup_question_map (
  variant text not null,
  form_code text not null,
  question_code text not null,
  facility_code text not null,
  primary key (
    variant,
    form_code,
    question_code
  )
) on commit drop;


insert into facility_cleanup_question_map values

-- CQ OPENING FOH
('CQ', 'OPENING_FOH', 'OPN_FOH_019', 'STAIRS'),
('CQ', 'OPENING_FOH', 'OPN_FOH_032', 'ICE_CRUSHED'),

-- CQ OPENING BOH
('CQ', 'OPENING_BOH', 'OPN_BOH_011', 'SHAO_KAO'),
('CQ', 'OPENING_BOH', 'OPN_BOH_012', 'SHAO_KAO'),
('CQ', 'OPENING_BOH', 'OPN_BOH_032', 'EMPLOYEE_LOCKER'),
('CQ', 'OPENING_BOH', 'OPN_BOH_033', 'EMPLOYEE_TOILET'),

-- CQ CLOSING FOH
('CQ', 'CLOSING_FOH', 'CLS_FOH_005', 'ICE_CRUSHED'),

-- DD OPENING FOH
('DD', 'OPENING_FOH', 'OPN_FOH_019', 'STAIRS'),
('DD', 'OPENING_FOH', 'OPN_FOH_032', 'ICE_CRUSHED'),

-- DD CLOSING FOH
('DD', 'CLOSING_FOH', 'CLS_FOH_005', 'ICE_CRUSHED');


-- Verify each mapped question exists exactly once in its exact source.

do $$
declare
  v_row record;
  v_count integer;
begin
  for v_row in
    select
      qm.*,
      vm.source_version_id
    from facility_cleanup_question_map qm
    join facility_cleanup_versions vm
      on vm.variant = qm.variant
     and vm.form_code = qm.form_code
  loop

    select count(*)
      into v_count
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where fvs.form_version_id = v_row.source_version_id
      and q.code = v_row.question_code
      and q.is_active = true;


    if v_count <> 1 then
      raise exception
        'FACILITY CLEANUP STOP: %/%/% expected exactly 1 source question, found %.',
        v_row.variant,
        v_row.form_code,
        v_row.question_code,
        v_count;
    end if;

  end loop;
end;
$$;


-- ============================================================
-- 7. CLONE EXACT LIVE SOURCES
--
-- clone_form_version_to_draft creates pg_temp mapping tables.
-- Drop them after each clone so the RPC can safely run again in
-- the same transaction.
-- ============================================================

do $$
declare
  v_row record;
  v_new_id uuid;
  v_new_number integer;
begin

  for v_row in
    select *
    from facility_cleanup_versions
    order by
      case form_code
        when 'OPENING_FOH' then 1
        when 'OPENING_BOH' then 2
        when 'CLOSING_FOH' then 3
        else 99
      end,
      case variant
        when 'CQ' then 1
        else 2
      end
  loop

    v_new_id :=
      public.clone_form_version_to_draft(
        v_row.source_version_id
      );


    select fv.version_number
      into v_new_number
    from public.form_versions fv
    where fv.id = v_new_id;


    if v_new_number <> v_row.expected_new_version_number then
      raise exception
        'FACILITY CLEANUP STOP: %/% clone allocated v%, expected v%.',
        v_row.variant,
        v_row.form_code,
        v_new_number,
        v_row.expected_new_version_number;
    end if;


    update facility_cleanup_versions
    set target_version_id = v_new_id
    where variant = v_row.variant
      and form_code = v_row.form_code;


    drop table if exists pg_temp.tmp_option_map;
    drop table if exists pg_temp.tmp_question_map;
    drop table if exists pg_temp.tmp_group_map;
    drop table if exists pg_temp.tmp_version_section_map;

  end loop;

end;
$$;


-- ============================================================
-- 8. PATCH ONLY DRAFT QUESTIONS
-- ============================================================

update public.questions q
set config =
  (
    coalesce(
      q.config,
      '{}'::jsonb
    )
    - 'applicability'
  )
  ||
  jsonb_build_object(
    'applicability',
    jsonb_build_object(
      'type',
      'facility',
      'facility_key',
      qm.facility_code
    )
  )
from facility_cleanup_question_map qm
join facility_cleanup_versions vm
  on vm.variant = qm.variant
 and vm.form_code = qm.form_code
join public.form_version_sections fvs
  on fvs.form_version_id = vm.target_version_id
where q.version_section_id = fvs.id
  and q.code = qm.question_code
  and q.is_active = true;


-- ============================================================
-- 9. DRAFT POSTCHECK
-- ============================================================

do $$
declare
  v_bad text;
begin

  select string_agg(
    concat(
      qm.variant,
      '/',
      qm.form_code,
      '/',
      qm.question_code
    ),
    ', '
    order by
      qm.variant,
      qm.form_code,
      qm.question_code
  )
  into v_bad
  from facility_cleanup_question_map qm
  join facility_cleanup_versions vm
    on vm.variant = qm.variant
   and vm.form_code = qm.form_code
  where (
    select count(*)
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where fvs.form_version_id = vm.target_version_id
      and q.code = qm.question_code
      and q.is_active = true
      and q.config #>> '{applicability,type}' = 'facility'
      and q.config #>> '{applicability,facility_key}' = qm.facility_code
  ) <> 1;


  if v_bad is not null then
    raise exception
      'FACILITY CLEANUP STOP: draft applicability verification failed: %.',
      v_bad;
  end if;

end;
$$;


-- ============================================================
-- 10. PUBLISH NEW TARGET VERSIONS
-- ============================================================

do $$
declare
  v_row record;
begin

  for v_row in
    select *
    from facility_cleanup_versions
    order by
      case form_code
        when 'OPENING_FOH' then 1
        when 'OPENING_BOH' then 2
        when 'CLOSING_FOH' then 3
        else 99
      end,
      case variant
        when 'CQ' then 1
        else 2
      end
  loop

    perform public.publish_form_version(
      v_row.target_version_id
    );

  end loop;

end;
$$;


do $$
declare
  v_count integer;
begin

  select count(*)
    into v_count
  from facility_cleanup_versions vm
  join public.form_versions fv
    on fv.id = vm.target_version_id
  where fv.status = 'published'
    and fv.published_at is not null;


  if v_count <> 5 then
    raise exception
      'FACILITY CLEANUP STOP: expected 5 published targets, found %.',
      v_count;
  end if;

end;
$$;


-- ============================================================
-- 11. TARGET OUTLET SETS
-- ============================================================

create temporary table facility_cleanup_rollout (
  outlet_code text not null,
  variant text not null,
  form_code text not null,
  primary key (
    outlet_code,
    form_code
  )
) on commit drop;


-- Nine CQ outlets / three corrected forms.
insert into facility_cleanup_rollout
select
  o.outlet_code,
  'CQ',
  f.form_code
from (
  values
    ('BDG'),
    ('GS'),
    ('HT'),
    ('MOI'),
    ('PIM'),
    ('PL'),
    ('PP'),
    ('SP'),
    ('TBZ')
) as o(outlet_code)
cross join (
  values
    ('OPENING_FOH'),
    ('OPENING_BOH'),
    ('CLOSING_FOH')
) as f(form_code);


-- DD only uses corrected OPENING_FOH + CLOSING_FOH.
-- OPENING_BOH stays on dedicated DD v3.
insert into facility_cleanup_rollout
select
  o.outlet_code,
  'DD',
  f.form_code
from (
  values
    ('CGU'),
    ('SMY')
) as o(outlet_code)
cross join (
  values
    ('OPENING_FOH'),
    ('CLOSING_FOH')
) as f(form_code);


do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
  from facility_cleanup_rollout;

  if v_count <> 31 then
    raise exception
      'FACILITY CLEANUP STOP: expected 31 rollout assignments, found %.',
      v_count;
  end if;
end;
$$;


-- ============================================================
-- 12. CONTROLLED ROLLOUT
-- ============================================================

do $$
declare
  v_row record;
  v_outlet_id uuid;
  v_target_version_id uuid;
begin

  for v_row in
    select *
    from facility_cleanup_rollout
    order by outlet_code, form_code
  loop

    select o.id
      into v_outlet_id
    from public.outlets o
    where upper(o.code) = v_row.outlet_code
      and o.is_active = true;


    if v_outlet_id is null then
      raise exception
        'FACILITY CLEANUP STOP: rollout outlet % missing.',
        v_row.outlet_code;
    end if;


    select vm.target_version_id
      into v_target_version_id
    from facility_cleanup_versions vm
    where vm.variant = v_row.variant
      and vm.form_code = v_row.form_code;


    if v_target_version_id is null then
      raise exception
        'FACILITY CLEANUP STOP: target version missing for %/%.',
        v_row.variant,
        v_row.form_code;
    end if;


    perform public.activate_outlet_form_version(
      v_outlet_id,
      v_target_version_id
    );

  end loop;

end;
$$;


-- ============================================================
-- 13. FACILITY MATRIX POSTCHECK
-- ============================================================

do $$
declare
  v_bad integer;
begin

  select count(*)
    into v_bad
  from facility_cleanup_expected e
  join public.outlets o
    on upper(o.code) = e.outlet_code
   and o.is_active = true
  join public.facility_definitions fd
    on fd.organization_id = o.organization_id
   and fd.code = e.facility_code
   and fd.is_active = true
  left join public.outlet_facilities ofa
    on ofa.outlet_id = o.id
   and ofa.facility_id = fd.id
  where ofa.id is null
     or ofa.is_available
        is distinct from
        e.is_available;


  if v_bad <> 0 then
    raise exception
      'FACILITY CLEANUP POSTCHECK: % facility matrix values mismatch.',
      v_bad;
  end if;

end;
$$;


-- ============================================================
-- 14. ACTIVE ASSIGNMENT POSTCHECK
-- ============================================================

do $$
declare
  v_bad text;
  v_dd_boh_version uuid :=
    'e789c256-16ba-4425-a7a1-4885cd6a61b3';
begin

  select string_agg(
    concat(
      r.outlet_code,
      '/',
      r.form_code
    ),
    ', '
    order by
      r.outlet_code,
      r.form_code
  )
  into v_bad
  from facility_cleanup_rollout r
  join public.outlets o
    on upper(o.code) = r.outlet_code
   and o.is_active = true
  join public.forms f
    on f.organization_id = o.organization_id
   and upper(f.code) = r.form_code
   and f.is_active = true
  join facility_cleanup_versions vm
    on vm.variant = r.variant
   and vm.form_code = r.form_code
  where (
    select count(*)
    from public.outlet_form_assignments ofa
    where ofa.outlet_id = o.id
      and ofa.form_id = f.id
      and ofa.form_version_id = vm.target_version_id
      and ofa.is_active = true
  ) <> 1;


  if v_bad is not null then
    raise exception
      'FACILITY CLEANUP POSTCHECK: rollout assignment mismatch: %.',
      v_bad;
  end if;


  -- DD OPENING_BOH must stay on exact dedicated v3.
  select string_agg(
    upper(o.code),
    ', '
    order by upper(o.code)
  )
  into v_bad
  from public.outlets o
  join public.forms f
    on f.organization_id = o.organization_id
   and upper(f.code) = 'OPENING_BOH'
   and f.is_active = true
  where upper(o.code) in ('CGU','SMY')
    and o.is_active = true
    and (
      select count(*)
      from public.outlet_form_assignments ofa
      where ofa.outlet_id = o.id
        and ofa.form_id = f.id
        and ofa.form_version_id = v_dd_boh_version
        and ofa.is_active = true
    ) <> 1;


  if v_bad is not null then
    raise exception
      'FACILITY CLEANUP POSTCHECK: DD OPENING_BOH v3 changed unexpectedly: %.',
      v_bad;
  end if;

end;
$$;


-- ============================================================
-- 15. HISTORICAL DATA POSTCHECK
-- ============================================================

do $$
declare
  v_reports_after bigint;
  v_app_after bigint;
  v_reports_before bigint;
  v_app_before bigint;
begin

  select
    reports_before,
    applicability_before
  into
    v_reports_before,
    v_app_before
  from facility_cleanup_context
  limit 1;


  select count(*)
    into v_reports_after
  from public.reports;


  select count(*)
    into v_app_after
  from public.report_question_applicability;


  if v_reports_after <> v_reports_before then
    raise exception
      'FACILITY CLEANUP POSTCHECK: report count changed from % to %.',
      v_reports_before,
      v_reports_after;
  end if;


  if v_app_after <> v_app_before then
    raise exception
      'FACILITY CLEANUP POSTCHECK: historical applicability count changed from % to %.',
      v_app_before,
      v_app_after;
  end if;

end;
$$;


-- ============================================================
-- 16. CQ CENTRAL EXCLUSION
-- ============================================================

do $$
begin

  if exists (
    select 1
    from facility_cleanup_expected
    where outlet_code = 'CNT'
  ) then
    raise exception
      'FACILITY CLEANUP POSTCHECK: CNT was unexpectedly included.';
  end if;

end;
$$;


commit;
