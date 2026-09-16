begin;

-- ============================================================
-- OPENING_FOH V3 CQ ROLLOUT
--
-- Pilot source:
--   MOI active OPENING_FOH v3
--
-- Rollout targets:
--   BDG, GS, HT, PIM, PL, PP, SP, TBZ
--
-- Protected:
--   MOI remains pilot v3
--   CGU / SMY are not touched
--   OPENING_BOH / CLOSING_FOH / CLOSING_BOH are not touched
--   Historical reports remain pinned to their original version
--
-- Safety:
--   - exact published v3 source from MOI
--   - exact v3 graph: 59 active questions, 7 groups
--   - all 59 questions evidence_mode=always
--   - target outlets must have exactly one active OPENING_FOH assignment
--   - abort if a target has today's unfinished OPENING_FOH report on a non-v3 version
--   - activation uses existing activate_outlet_form_version RPC
-- ============================================================

create temporary table o3m_context (
  organization_id uuid not null,
  form_id uuid not null,
  v3_version_id uuid not null,
  admin_user_id uuid not null
) on commit drop;

create temporary table o3m_targets (
  outlet_id uuid primary key,
  outlet_code text not null,
  outlet_name text not null,
  timezone text not null
) on commit drop;

do $$
declare
  v_org_id uuid;
  v_form_id uuid;
  v_v3_version_id uuid;
  v_v3_version_number integer;
  v_v3_status text;
  v_admin_id uuid;
  v_candidate record;
  v_count integer;
begin
  -- Exact MOI pilot source.
  select
    o.organization_id,
    f.id,
    ofa.form_version_id,
    fv.version_number,
    fv.status
  into
    v_org_id,
    v_form_id,
    v_v3_version_id,
    v_v3_version_number,
    v_v3_status
  from public.outlets o
  join public.outlet_form_assignments ofa
    on ofa.outlet_id = o.id
   and ofa.is_active = true
  join public.forms f
    on f.id = ofa.form_id
   and f.organization_id = o.organization_id
   and upper(f.code) = 'OPENING_FOH'
   and f.is_active = true
  join public.form_versions fv
    on fv.id = ofa.form_version_id
   and fv.form_id = f.id
  where upper(o.code) = 'MOI'
    and o.is_active = true;

  if v_v3_version_id is null then
    raise exception
      'OPENING_FOH v3 rollout STOP: active MOI pilot assignment not found.';
  end if;

  if v_v3_version_number <> 3
     or v_v3_status <> 'published' then
    raise exception
      'OPENING_FOH v3 rollout STOP: MOI must be on published v3. Found version=% status=%.',
      v_v3_version_number,
      v_v3_status;
  end if;

  -- Exact graph guards.
  select count(*)
  into v_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_v3_version_id
    and q.is_active = true;

  if v_count <> 59 then
    raise exception
      'OPENING_FOH v3 rollout STOP: expected 59 active questions, found %.',
      v_count;
  end if;

  select count(*)
  into v_count
  from public.question_groups qg
  join public.form_version_sections fvs
    on fvs.id = qg.version_section_id
  where fvs.form_version_id = v_v3_version_id
    and qg.is_active = true;

  if v_count <> 7 then
    raise exception
      'OPENING_FOH v3 rollout STOP: expected 7 active groups, found %.',
      v_count;
  end if;

  select count(*)
  into v_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_v3_version_id
    and q.is_active = true
    and q.config ->> 'evidence_mode' = 'always';

  if v_count <> 59 then
    raise exception
      'OPENING_FOH v3 rollout STOP: expected 59 evidence_mode=always questions, found %.',
      v_count;
  end if;

  -- Resolve an existing active organization admin for RPC auth context.
  for v_candidate in
    select p.id
    from public.profiles p
    where p.organization_id = v_org_id
      and p.is_active = true
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
      'OPENING_FOH v3 rollout STOP: active organization admin not found.';
  end if;

  if auth.uid() is distinct from v_admin_id then
    raise exception
      'OPENING_FOH v3 rollout STOP: admin JWT subject was not established.';
  end if;

  insert into o3m_context (
    organization_id,
    form_id,
    v3_version_id,
    admin_user_id
  )
  values (
    v_org_id,
    v_form_id,
    v_v3_version_id,
    v_admin_id
  );

  insert into o3m_targets (
    outlet_id,
    outlet_code,
    outlet_name,
    timezone
  )
  select
    o.id,
    upper(o.code),
    o.name,
    coalesce(
      nullif(trim(o.timezone), ''),
      'Asia/Jakarta'
    )
  from public.outlets o
  where o.organization_id = v_org_id
    and o.is_active = true
    and upper(o.code) in (
      'BDG',
      'GS',
      'HT',
      'PIM',
      'PL',
      'PP',
      'SP',
      'TBZ'
    );

  select count(*)
  into v_count
  from o3m_targets;

  if v_count <> 8 then
    raise exception
      'OPENING_FOH v3 rollout STOP: expected 8 rollout targets, found %.',
      v_count;
  end if;
end;
$$;


-- ============================================================
-- PREFLIGHT TARGET ASSIGNMENTS + TODAY'S OPEN REPORTS
-- ============================================================

do $$
declare
  v_form_id uuid;
  v_v3_version_id uuid;
  v_bad record;
  v_count integer;
begin
  select
    form_id,
    v3_version_id
  into
    v_form_id,
    v_v3_version_id
  from o3m_context
  limit 1;

  -- Exactly one active OPENING_FOH assignment per target.
  for v_bad in
    select
      t.outlet_code,
      count(ofa.id) as active_assignment_count
    from o3m_targets t
    left join public.outlet_form_assignments ofa
      on ofa.outlet_id = t.outlet_id
     and ofa.form_id = v_form_id
     and ofa.is_active = true
    group by
      t.outlet_code
    having count(ofa.id) <> 1
  loop
    raise exception
      'OPENING_FOH v3 rollout STOP: outlet % has % active OPENING_FOH assignments.',
      v_bad.outlet_code,
      v_bad.active_assignment_count;
  end loop;

  -- Do not switch an outlet if today's OPENING_FOH is unfinished
  -- and pinned to an older/non-v3 version.
  for v_bad in
    select
      t.outlet_code,
      r.report_number,
      r.status,
      r.form_version_id
    from o3m_targets t
    join public.reports r
      on r.outlet_id = t.outlet_id
     and r.form_id = v_form_id
     and r.business_date = (
       current_timestamp
       at time zone t.timezone
     )::date
    where lower(coalesce(r.status, '')) in (
      'draft',
      'in_progress',
      'reopened',
      'needs_correction'
    )
      and r.form_version_id <> v_v3_version_id
  loop
    raise exception
      'OPENING_FOH v3 rollout STOP: outlet % has unfinished old-version report % status %.',
      v_bad.outlet_code,
      v_bad.report_number,
      v_bad.status;
  end loop;

  -- MOI pilot must remain active on exact v3.
  select count(*)
  into v_count
  from public.outlets o
  join public.outlet_form_assignments ofa
    on ofa.outlet_id = o.id
   and ofa.form_id = v_form_id
   and ofa.form_version_id = v_v3_version_id
   and ofa.is_active = true
  where o.organization_id = (
    select organization_id
    from o3m_context
    limit 1
  )
    and upper(o.code) = 'MOI'
    and o.is_active = true;

  if v_count <> 1 then
    raise exception
      'OPENING_FOH v3 rollout STOP: MOI pilot is not actively assigned to exact v3.';
  end if;

  -- DD holdouts must not have active split OPENING_FOH assignment.
  select count(*)
  into v_count
  from public.outlets o
  join public.outlet_form_assignments ofa
    on ofa.outlet_id = o.id
   and ofa.form_id = v_form_id
   and ofa.is_active = true
  where o.organization_id = (
    select organization_id
    from o3m_context
    limit 1
  )
    and upper(o.code) in ('CGU', 'SMY');

  if v_count <> 0 then
    raise exception
      'OPENING_FOH v3 rollout STOP: CGU/SMY unexpectedly have active split OPENING_FOH assignments.';
  end if;
end;
$$;


-- ============================================================
-- ACTIVATE V3 FOR SAFE CQ TARGETS
-- ============================================================

do $$
declare
  v_form_id uuid;
  v_v3_version_id uuid;
  v_target record;
  v_current_version_id uuid;
begin
  select
    form_id,
    v3_version_id
  into
    v_form_id,
    v_v3_version_id
  from o3m_context
  limit 1;

  for v_target in
    select
      outlet_id,
      outlet_code
    from o3m_targets
    order by outlet_code
  loop
    select ofa.form_version_id
    into v_current_version_id
    from public.outlet_form_assignments ofa
    where ofa.outlet_id = v_target.outlet_id
      and ofa.form_id = v_form_id
      and ofa.is_active = true
    limit 1;

    if v_current_version_id is distinct from v_v3_version_id then
      perform public.activate_outlet_form_version(
        v_target.outlet_id,
        v_v3_version_id
      );
    end if;
  end loop;
end;
$$;


-- ============================================================
-- POSTFLIGHT
-- ============================================================

do $$
declare
  v_org_id uuid;
  v_form_id uuid;
  v_v3_version_id uuid;
  v_count integer;
begin
  select
    organization_id,
    form_id,
    v3_version_id
  into
    v_org_id,
    v_form_id,
    v_v3_version_id
  from o3m_context
  limit 1;

  -- 8 rollout targets must now be exact v3.
  select count(*)
  into v_count
  from o3m_targets t
  join public.outlet_form_assignments ofa
    on ofa.outlet_id = t.outlet_id
   and ofa.form_id = v_form_id
   and ofa.form_version_id = v_v3_version_id
   and ofa.is_active = true;

  if v_count <> 8 then
    raise exception
      'OPENING_FOH v3 rollout POSTFLIGHT: expected 8 active target v3 assignments, found %.',
      v_count;
  end if;

  -- All 9 CQ outlets including MOI must be exact v3.
  select count(*)
  into v_count
  from public.outlets o
  join public.outlet_form_assignments ofa
    on ofa.outlet_id = o.id
   and ofa.form_id = v_form_id
   and ofa.form_version_id = v_v3_version_id
   and ofa.is_active = true
  where o.organization_id = v_org_id
    and o.is_active = true
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
    );

  if v_count <> 9 then
    raise exception
      'OPENING_FOH v3 rollout POSTFLIGHT: expected all 9 CQ outlets on exact v3, found %.',
      v_count;
  end if;

  -- Exactly one active OPENING_FOH assignment per CQ outlet.
  if exists (
    select 1
    from public.outlets o
    left join public.outlet_form_assignments ofa
      on ofa.outlet_id = o.id
     and ofa.form_id = v_form_id
     and ofa.is_active = true
    where o.organization_id = v_org_id
      and o.is_active = true
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
    group by o.id
    having count(ofa.id) <> 1
  ) then
    raise exception
      'OPENING_FOH v3 rollout POSTFLIGHT: at least one CQ outlet does not have exactly one active assignment.';
  end if;

  -- DD remains untouched.
  select count(*)
  into v_count
  from public.outlets o
  join public.outlet_form_assignments ofa
    on ofa.outlet_id = o.id
   and ofa.form_id = v_form_id
   and ofa.is_active = true
  where o.organization_id = v_org_id
    and upper(o.code) in ('CGU', 'SMY');

  if v_count <> 0 then
    raise exception
      'OPENING_FOH v3 rollout POSTFLIGHT: CGU/SMY were unexpectedly changed.';
  end if;
end;
$$;

commit;
