begin;

-- ============================================================
-- DD SPLIT — PUBLISH 4 DEDICATED VERSIONS + ACTIVATE CGU PILOT
--
-- Publish:
--   OPENING_FOH v4  = 60 q / 8 groups / 22 facility / all-photo
--   OPENING_BOH v3  = 20 q / 6 groups / 0 facility / all-photo
--   CLOSING_FOH v3  = 12 q / 0 groups / 1 facility / all-photo
--   CLOSING_BOH v3  = 20 q / 6 groups / 1 facility / all-photo
--
-- Activate:
--   CGU / DD Canggu only
--
-- Preserve:
--   SMY has 0 active split assignments
--   DD legacy OPENING/CLOSING stay active
--   CQ exact 36 active split assignments stay unchanged/published
--   no permission/report mutation
-- ============================================================

create temporary table dd_pilot_target_versions (
  form_code text primary key,
  form_id uuid not null,
  form_version_id uuid not null,
  version_number integer not null,
  expected_questions integer not null,
  expected_groups integer not null,
  expected_facility_questions integer not null
) on commit drop;

create temporary table dd_pilot_context (
  organization_id uuid not null,
  cgu_outlet_id uuid not null,
  smy_outlet_id uuid not null,
  admin_user_id uuid not null
) on commit drop;

create temporary table dd_pilot_cq_assignment_snapshot (
  outlet_code text not null,
  form_code text not null,
  assignment_id uuid not null,
  form_version_id uuid not null,
  primary key (outlet_code, form_code)
) on commit drop;


-- ============================================================
-- 1. CONTEXT + RPC GUARDS
-- ============================================================

do $$
declare
  v_org_id uuid;
  v_cgu_id uuid;
  v_smy_id uuid;
  v_admin_id uuid;
  v_count integer;
begin
  if to_regprocedure('public.publish_form_version(uuid)') is null then
    raise exception
      'DD PILOT STOP: publish_form_version(uuid) RPC is missing.';
  end if;

  if to_regprocedure('public.activate_outlet_form_version(uuid,uuid)') is null then
    raise exception
      'DD PILOT STOP: activate_outlet_form_version(uuid,uuid) RPC is missing.';
  end if;

  select o.id, o.organization_id
    into v_cgu_id, v_org_id
  from public.outlets o
  where upper(o.code) = 'CGU'
    and o.is_active = true
  limit 1;

  if v_cgu_id is null or v_org_id is null then
    raise exception
      'DD PILOT STOP: active CGU outlet was not found.';
  end if;

  select o.id
    into v_smy_id
  from public.outlets o
  where upper(o.code) = 'SMY'
    and o.organization_id = v_org_id
    and o.is_active = true
  limit 1;

  if v_smy_id is null then
    raise exception
      'DD PILOT STOP: active SMY outlet was not found in the same organization.';
  end if;

  select count(*)
    into v_count
  from public.outlets o
  where o.id in (v_cgu_id, v_smy_id)
    and o.default_locale = 'en';

  if v_count <> 2 then
    raise exception
      'DD PILOT STOP: CGU/SMY default_locale must both be en.';
  end if;

  select p.id
    into v_admin_id
  from public.profiles p
  join public.user_roles ur
    on ur.user_id = p.id
  join public.roles r
    on r.id = ur.role_id
   and r.organization_id = v_org_id
   and r.is_active = true
   and r.is_admin = true
  where p.organization_id = v_org_id
    and coalesce(p.is_active, true) = true
  order by p.id::text
  limit 1;

  if v_admin_id is null then
    raise exception
      'DD PILOT STOP: no active organization admin is available for publish/activation.';
  end if;

  insert into dd_pilot_context (
    organization_id,
    cgu_outlet_id,
    smy_outlet_id,
    admin_user_id
  )
  values (
    v_org_id,
    v_cgu_id,
    v_smy_id,
    v_admin_id
  );
end;
$$;


insert into dd_pilot_target_versions (
  form_code,
  form_id,
  form_version_id,
  version_number,
  expected_questions,
  expected_groups,
  expected_facility_questions
)
select
  seed.form_code,
  f.id,
  fv.id,
  seed.version_number,
  seed.expected_questions,
  seed.expected_groups,
  seed.expected_facility_questions
from (
  values
    ('OPENING_FOH'::text, 4, 60, 8, 22),
    ('OPENING_BOH'::text, 3, 20, 6, 0),
    ('CLOSING_FOH'::text, 3, 12, 0, 1),
    ('CLOSING_BOH'::text, 3, 20, 6, 1)
) as seed(
  form_code,
  version_number,
  expected_questions,
  expected_groups,
  expected_facility_questions
)
join public.forms f
  on f.organization_id = (
    select organization_id
    from dd_pilot_context
    limit 1
  )
 and upper(f.code) = seed.form_code
 and f.is_active = true
join public.form_versions fv
  on fv.form_id = f.id
 and fv.version_number = seed.version_number;


-- ============================================================
-- 2. EXACT DD VERSION STRUCTURE GUARDS
-- ============================================================

do $$
declare
  v_count integer;
  v_bad text;
  v_row record;
  v_section_count integer;
  v_question_count integer;
  v_group_count integer;
  v_facility_count integer;
  v_photo_count integer;
  v_photo_rule_count integer;
  v_bilingual_question_count integer;
  v_bilingual_group_count integer;
  v_bilingual_section_count integer;
begin
  select count(*)
    into v_count
  from dd_pilot_target_versions;

  if v_count <> 4 then
    raise exception
      'DD PILOT STOP: expected 4 exact DD target versions, found %.',
      v_count;
  end if;

  select string_agg(
    tv.form_code || ':v' || tv.version_number::text ||
    ':' || fv.status ||
    ':' || coalesce(fv.notes, ''),
    ' | ' order by tv.form_code
  )
  into v_bad
  from dd_pilot_target_versions tv
  join public.form_versions fv
    on fv.id = tv.form_version_id
  where fv.status <> 'draft'
     or coalesce(fv.notes, '') not ilike 'DD dedicated bilingual draft%';

  if v_bad is not null then
    raise exception
      'DD PILOT STOP: target version identity/status mismatch: %.',
      v_bad;
  end if;

  for v_row in
    select *
    from dd_pilot_target_versions
    order by form_code
  loop
    select count(*)
      into v_section_count
    from public.form_version_sections fvs
    where fvs.form_version_id = v_row.form_version_id
      and fvs.is_active = true;

    if v_section_count <> 1 then
      raise exception
        'DD PILOT STOP: % v% expected 1 active section, found %.',
        v_row.form_code,
        v_row.version_number,
        v_section_count;
    end if;

    select count(*)
      into v_question_count
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where fvs.form_version_id = v_row.form_version_id
      and q.is_active = true;

    if v_question_count <> v_row.expected_questions then
      raise exception
        'DD PILOT STOP: % v% expected % questions, found %.',
        v_row.form_code,
        v_row.version_number,
        v_row.expected_questions,
        v_question_count;
    end if;

    select count(*)
      into v_group_count
    from public.question_groups qg
    join public.form_version_sections fvs
      on fvs.id = qg.version_section_id
    where fvs.form_version_id = v_row.form_version_id
      and qg.is_active = true;

    if v_group_count <> v_row.expected_groups then
      raise exception
        'DD PILOT STOP: % v% expected % groups, found %.',
        v_row.form_code,
        v_row.version_number,
        v_row.expected_groups,
        v_group_count;
    end if;

    select count(*)
      into v_facility_count
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where fvs.form_version_id = v_row.form_version_id
      and q.is_active = true
      and q.config #>> '{applicability,type}' = 'facility';

    if v_facility_count <> v_row.expected_facility_questions then
      raise exception
        'DD PILOT STOP: % v% expected % facility questions, found %.',
        v_row.form_code,
        v_row.version_number,
        v_row.expected_facility_questions,
        v_facility_count;
    end if;

    select count(*)
      into v_photo_count
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where fvs.form_version_id = v_row.form_version_id
      and q.is_active = true
      and q.config ->> 'evidence_mode' = 'always';

    if v_photo_count <> v_row.expected_questions then
      raise exception
        'DD PILOT STOP: % v% all-photo expected %/% found %.',
        v_row.form_code,
        v_row.version_number,
        v_row.expected_questions,
        v_row.expected_questions,
        v_photo_count;
    end if;

    select count(*)
      into v_photo_rule_count
    from public.question_rules qr
    join public.questions q
      on q.id = qr.question_id
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where fvs.form_version_id = v_row.form_version_id
      and q.is_active = true
      and qr.is_active = true
      and qr.rule_type = 'require_photo';

    if v_photo_rule_count <> v_row.expected_questions then
      raise exception
        'DD PILOT STOP: % v% expected % active require_photo rules, found %.',
        v_row.form_code,
        v_row.version_number,
        v_row.expected_questions,
        v_photo_rule_count;
    end if;

    select count(*)
      into v_bilingual_question_count
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where fvs.form_version_id = v_row.form_version_id
      and q.is_active = true
      and exists (
        select 1
        from public.question_translations qt
        where qt.question_id = q.id
          and qt.locale = 'en'
      )
      and exists (
        select 1
        from public.question_translations qt
        where qt.question_id = q.id
          and qt.locale = 'id-ID'
      );

    if v_bilingual_question_count <> v_row.expected_questions then
      raise exception
        'DD PILOT STOP: % v% bilingual questions expected %/% found %.',
        v_row.form_code,
        v_row.version_number,
        v_row.expected_questions,
        v_row.expected_questions,
        v_bilingual_question_count;
    end if;

    select count(*)
      into v_bilingual_group_count
    from public.question_groups qg
    join public.form_version_sections fvs
      on fvs.id = qg.version_section_id
    where fvs.form_version_id = v_row.form_version_id
      and qg.is_active = true
      and exists (
        select 1
        from public.question_group_translations qgt
        where qgt.question_group_id = qg.id
          and qgt.locale = 'en'
      )
      and exists (
        select 1
        from public.question_group_translations qgt
        where qgt.question_group_id = qg.id
          and qgt.locale = 'id-ID'
      );

    if v_bilingual_group_count <> v_row.expected_groups then
      raise exception
        'DD PILOT STOP: % v% bilingual groups expected %/% found %.',
        v_row.form_code,
        v_row.version_number,
        v_row.expected_groups,
        v_row.expected_groups,
        v_bilingual_group_count;
    end if;

    select count(*)
      into v_bilingual_section_count
    from public.form_version_sections fvs
    where fvs.form_version_id = v_row.form_version_id
      and fvs.is_active = true
      and exists (
        select 1
        from public.form_version_section_translations fvst
        where fvst.version_section_id = fvs.id
          and fvst.locale = 'en'
      )
      and exists (
        select 1
        from public.form_version_section_translations fvst
        where fvst.version_section_id = fvs.id
          and fvst.locale = 'id-ID'
      );

    if v_bilingual_section_count <> 1 then
      raise exception
        'DD PILOT STOP: % v% section is not bilingual EN + id-ID.',
        v_row.form_code,
        v_row.version_number;
    end if;
  end loop;

  select string_agg(q.code, ', ' order by q.code)
    into v_bad
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  join dd_pilot_target_versions tv
    on tv.form_version_id = fvs.form_version_id
   and tv.form_code = 'OPENING_FOH'
  where q.is_active = true
    and (
      q.question_text ilike '%CQ%'
      or exists (
        select 1
        from public.question_translations qt
        where qt.question_id = q.id
          and qt.question_text ilike '%CQ%'
      )
    );

  if v_bad is not null then
    raise exception
      'DD PILOT STOP: CQ branding remains in DD OPENING_FOH: %.',
      v_bad;
  end if;

  select count(*)
    into v_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  join dd_pilot_target_versions tv
    on tv.form_version_id = fvs.form_version_id
   and tv.form_code = 'OPENING_FOH'
  where q.code in (
    'OPN_FOH_015',
    'OPN_FOH_026',
    'OPN_FOH_042',
    'OPN_FOH_044',
    'OPN_FOH_058'
  )
    and q.question_text ilike '%DD%';

  if v_count <> 5 then
    raise exception
      'DD PILOT STOP: expected all 5 DD-branded OPENING_FOH questions.';
  end if;

  select count(*)
    into v_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  join dd_pilot_target_versions tv
    on tv.form_version_id = fvs.form_version_id
   and tv.form_code = 'OPENING_FOH'
  where q.code = 'OPN_FOH_060'
    and q.is_active = true
    and q.config ->> 'evidence_mode' = 'always'
    and q.config #>> '{applicability,type}' = 'facility'
    and q.config #>> '{applicability,facility_key}' = 'LIFT';

  if v_count <> 1 then
    raise exception
      'DD PILOT STOP: exact lift question/applicability is missing.';
  end if;
end;
$$;


-- ============================================================
-- 3. ASSIGNMENT / REPORT / FACILITY SAFETY
-- ============================================================

do $$
declare
  v_count integer;
  v_bad text;
begin
  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o
    on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
  where o.id in (
      select cgu_outlet_id from dd_pilot_context
      union all
      select smy_outlet_id from dd_pilot_context
    )
    and ofa.is_active = true
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    );

  if v_count <> 0 then
    raise exception
      'DD PILOT STOP: expected 0 active DD split assignments before pilot, found %.',
      v_count;
  end if;

  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o
    on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
  where o.id in (
      select cgu_outlet_id from dd_pilot_context
      union all
      select smy_outlet_id from dd_pilot_context
    )
    and ofa.is_active = true
    and upper(f.code) in ('OPENING', 'CLOSING');

  if v_count <> 4 then
    raise exception
      'DD PILOT STOP: expected 4 active DD legacy assignments, found %.',
      v_count;
  end if;

  select count(*)
    into v_count
  from public.reports r
  where r.form_version_id in (
    select form_version_id
    from dd_pilot_target_versions
  );

  if v_count <> 0 then
    raise exception
      'DD PILOT STOP: draft target versions unexpectedly have % report(s).',
      v_count;
  end if;

  with required_keys as (
    select distinct
      q.config #>> '{applicability,facility_key}' as facility_key
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    join dd_pilot_target_versions tv
      on tv.form_version_id = fvs.form_version_id
    where q.is_active = true
      and q.config #>> '{applicability,type}' = 'facility'
  ),
  dd_outlets as (
    select cgu_outlet_id as outlet_id, 'CGU'::text as outlet_code
    from dd_pilot_context
    union all
    select smy_outlet_id, 'SMY'
    from dd_pilot_context
  )
  select string_agg(
    d.outlet_code || ':' || rk.facility_key,
    ', ' order by d.outlet_code, rk.facility_key
  )
  into v_bad
  from required_keys rk
  cross join dd_outlets d
  left join public.facility_definitions fd
    on fd.organization_id = (
      select organization_id
      from dd_pilot_context
      limit 1
    )
   and fd.code = rk.facility_key
   and fd.is_active = true
  left join public.outlet_facilities ofc
    on ofc.outlet_id = d.outlet_id
   and ofc.facility_id = fd.id
  where fd.id is null
     or ofc.facility_id is null;

  if v_bad is not null then
    raise exception
      'DD PILOT STOP: missing DD facility configuration: %.',
      v_bad;
  end if;

  select count(*)
    into v_count
  from public.facility_definitions fd
  join public.outlet_facilities ofc
    on ofc.facility_id = fd.id
  join dd_pilot_context ctx
    on fd.organization_id = ctx.organization_id
  where fd.code = 'LIFT'
    and fd.is_active = true
    and (
      (ofc.outlet_id = ctx.cgu_outlet_id and ofc.is_available = false)
      or
      (ofc.outlet_id = ctx.smy_outlet_id and ofc.is_available = true)
    );

  if v_count <> 2 then
    raise exception
      'DD PILOT STOP: expected CGU LIFT=false and SMY LIFT=true.';
  end if;
end;
$$;


-- ============================================================
-- 4. SNAPSHOT / PROTECT CURRENT CQ ACTIVE SPLIT ASSIGNMENTS
-- ============================================================

insert into dd_pilot_cq_assignment_snapshot (
  outlet_code,
  form_code,
  assignment_id,
  form_version_id
)
select
  upper(o.code),
  upper(f.code),
  ofa.id,
  ofa.form_version_id
from public.outlet_form_assignments ofa
join public.outlets o
  on o.id = ofa.outlet_id
join public.forms f
  on f.id = ofa.form_id
join public.form_versions fv
  on fv.id = ofa.form_version_id
where o.organization_id = (
    select organization_id
    from dd_pilot_context
    limit 1
  )
  and upper(o.code) in (
    'BDG',
    'GS',
    'HT',
    'MOI',
    'PIM',
    'PL',
    'PP',
    'SP',
    'TBZ'
  )
  and upper(f.code) in (
    'OPENING_FOH',
    'OPENING_BOH',
    'CLOSING_FOH',
    'CLOSING_BOH'
  )
  and ofa.is_active = true
  and fv.status = 'published';


do $$
declare
  v_count integer;
begin
  select count(*)
    into v_count
  from dd_pilot_cq_assignment_snapshot;

  if v_count <> 36 then
    raise exception
      'DD PILOT STOP: expected exact 36 active published CQ split assignments, found %.',
      v_count;
  end if;
end;
$$;


-- ============================================================
-- 5. TEMP TABLE READ ACCESS FOR AUTHENTICATED ROLE
--
-- The lifecycle RPC calls are intentionally executed under
-- SET LOCAL ROLE authenticated. PostgreSQL temporary tables are
-- owned by the migration/session role, so authenticated must be
-- granted explicit SELECT access before the role switch.
-- ============================================================

grant select
on dd_pilot_target_versions,
   dd_pilot_context
to authenticated;


-- ============================================================
-- 6. AUTHENTICATED ADMIN CONTEXT
-- ============================================================

do $$
declare
  v_admin_id uuid;
begin
  select admin_user_id
    into v_admin_id
  from dd_pilot_context
  limit 1;

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
-- 7. CONTROLLED PUBLISH
-- ============================================================

set local role authenticated;

do $$
declare
  v_row record;
begin
  for v_row in
    select form_code, form_version_id
    from dd_pilot_target_versions
    order by
      case form_code
        when 'OPENING_FOH' then 1
        when 'OPENING_BOH' then 2
        when 'CLOSING_FOH' then 3
        when 'CLOSING_BOH' then 4
        else 99
      end
  loop
    perform public.publish_form_version(
      v_row.form_version_id
    );
  end loop;
end;
$$;

reset role;


-- ============================================================
-- 8. POST-PUBLISH CQ GUARD BEFORE ACTIVATING CGU
-- ============================================================

do $$
declare
  v_count integer;
  v_bad text;
begin
  select count(*)
    into v_count
  from dd_pilot_target_versions tv
  join public.form_versions fv
    on fv.id = tv.form_version_id
  where fv.status = 'published'
    and fv.published_at is not null;

  if v_count <> 4 then
    raise exception
      'DD PILOT STOP: expected all 4 DD targets published with published_at, found %.',
      v_count;
  end if;

  select string_agg(
    snap.outlet_code || ':' || snap.form_code ||
    ':status=' || coalesce(fv.status, 'MISSING'),
    ', ' order by snap.outlet_code, snap.form_code
  )
  into v_bad
  from dd_pilot_cq_assignment_snapshot snap
  left join public.outlet_form_assignments ofa
    on ofa.id = snap.assignment_id
   and ofa.is_active = true
   and ofa.form_version_id = snap.form_version_id
  left join public.form_versions fv
    on fv.id = snap.form_version_id
  where ofa.id is null
     or fv.id is null
     or fv.status <> 'published';

  if v_bad is not null then
    raise exception
      'DD PILOT STOP: DD publish changed an active CQ assignment/version: %.',
      v_bad;
  end if;
end;
$$;


-- ============================================================
-- 9. CONTROLLED ACTIVATION — CGU ONLY
-- ============================================================

set local role authenticated;

do $$
declare
  v_cgu_id uuid;
  v_row record;
begin
  select cgu_outlet_id
    into v_cgu_id
  from dd_pilot_context
  limit 1;

  for v_row in
    select form_code, form_version_id
    from dd_pilot_target_versions
    order by
      case form_code
        when 'OPENING_FOH' then 1
        when 'OPENING_BOH' then 2
        when 'CLOSING_FOH' then 3
        when 'CLOSING_BOH' then 4
        else 99
      end
  loop
    perform public.activate_outlet_form_version(
      v_cgu_id,
      v_row.form_version_id
    );
  end loop;
end;
$$;

reset role;


-- ============================================================
-- 10. FINAL POSTFLIGHT
-- ============================================================

do $$
declare
  v_count integer;
  v_bad text;
begin
  select count(*)
    into v_count
  from dd_pilot_target_versions tv
  join public.outlet_form_assignments ofa
    on ofa.outlet_id = (
      select cgu_outlet_id
      from dd_pilot_context
      limit 1
    )
   and ofa.form_id = tv.form_id
   and ofa.form_version_id = tv.form_version_id
   and ofa.is_active = true;

  if v_count <> 4 then
    raise exception
      'DD PILOT POSTFLIGHT: expected CGU on exact 4 DD target versions, found %.',
      v_count;
  end if;

  select string_agg(tv.form_code, ', ' order by tv.form_code)
    into v_bad
  from dd_pilot_target_versions tv
  where (
    select count(*)
    from public.outlet_form_assignments ofa
    where ofa.outlet_id = (
      select cgu_outlet_id
      from dd_pilot_context
      limit 1
    )
      and ofa.form_id = tv.form_id
      and ofa.is_active = true
  ) <> 1;

  if v_bad is not null then
    raise exception
      'DD PILOT POSTFLIGHT: CGU active assignment cardinality invalid for: %.',
      v_bad;
  end if;

  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join public.forms f
    on f.id = ofa.form_id
  where ofa.outlet_id = (
      select smy_outlet_id
      from dd_pilot_context
      limit 1
    )
    and ofa.is_active = true
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    );

  if v_count <> 0 then
    raise exception
      'DD PILOT POSTFLIGHT: SMY unexpectedly received % active split assignment(s).',
      v_count;
  end if;

  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o
    on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
  where o.id in (
      select cgu_outlet_id from dd_pilot_context
      union all
      select smy_outlet_id from dd_pilot_context
    )
    and ofa.is_active = true
    and upper(f.code) in ('OPENING', 'CLOSING');

  if v_count <> 4 then
    raise exception
      'DD PILOT POSTFLIGHT: legacy DD assignments changed; expected 4, found %.',
      v_count;
  end if;

  select string_agg(
    snap.outlet_code || ':' || snap.form_code,
    ', ' order by snap.outlet_code, snap.form_code
  )
  into v_bad
  from dd_pilot_cq_assignment_snapshot snap
  left join public.outlet_form_assignments ofa
    on ofa.id = snap.assignment_id
   and ofa.is_active = true
   and ofa.form_version_id = snap.form_version_id
  left join public.form_versions fv
    on fv.id = snap.form_version_id
  where ofa.id is null
     or fv.status <> 'published';

  if v_bad is not null then
    raise exception
      'DD PILOT POSTFLIGHT: CQ assignment protection failed: %.',
      v_bad;
  end if;

  select count(*)
    into v_count
  from public.reports r
  where r.form_version_id in (
    select form_version_id
    from dd_pilot_target_versions
  );

  if v_count <> 0 then
    raise exception
      'DD PILOT POSTFLIGHT: publish/activation unexpectedly created target-version reports.';
  end if;
end;
$$;

commit;
