-- ============================================================
-- OUTLET AUDIT SCORING V2
--
-- None     = 0
-- Minor    = -1
-- Medium   = -2
-- Major    = -10
-- Critical = -20
--
-- Also:
-- + DEFECT finding category
-- ============================================================

begin;

-- ============================================================
-- 1. RISK LEVEL
-- Add NONE without changing historical finding rows.
-- ============================================================

do $$
declare
  c record;
begin
  for c in
    select conname
    from pg_constraint
    where conrelid = 'public.audit_findings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%risk_level%'
  loop
    execute format(
      'alter table public.audit_findings drop constraint %I',
      c.conname
    );
  end loop;
end;
$$;

alter table public.audit_findings
  add constraint audit_findings_risk_level_check
  check (
    risk_level in (
      'none',
      'minor',
      'medium',
      'major',
      'critical'
    )
  );


-- ============================================================
-- 2. ADD DEFECT CATEGORY
-- One DEFECT category for every organization using OUTLET_AUDIT.
-- ============================================================

insert into public.audit_finding_categories (
  organization_id,
  code,
  name,
  sort_order,
  is_active
)
select distinct
  f.organization_id,
  'DEFECT',
  'Defect',
  70,
  true
from public.forms f
where upper(f.code) = 'OUTLET_AUDIT'
  and f.organization_id is not null
on conflict (organization_id, code)
do update set
  name = excluded.name,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();


-- ============================================================
-- 3. SCORING FUNCTION V2
-- Function copied from existing migration and only scoring
-- weights are changed.
-- ============================================================

create or replace function public.submit_audit_with_monthly_score(
  p_session_id uuid,
  p_auditor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session public.audit_sessions%rowtype;

  v_month_start date;

  v_minor integer := 0;
  v_medium integer := 0;
  v_major integer := 0;
  v_critical integer := 0;

  v_penalty numeric(8,2) := 0;

  v_month public.outlet_monthly_scores%rowtype;

  v_score_before numeric(6,2);
  v_score_after numeric(6,2);

  v_submitted_at timestamptz := now();

  v_snapshot jsonb;
begin

  -- Lock session first.
  -- This guarantees that repeated/concurrent submit requests
  -- cannot apply the same audit penalty twice.
  select *
    into v_session
  from public.audit_sessions
  where id = p_session_id
  for update;

  if not found then
    raise exception
      'Audit session tidak ditemukan.';
  end if;

  if v_session.auditor_user_id <> p_auditor_user_id then
    raise exception
      'Audit session bukan milik user ini.';
  end if;


  -- ----------------------------------------------------------
  -- IDEMPOTENT RE-SUBMIT
  -- ----------------------------------------------------------

  if v_session.status = 'submitted' then
    return jsonb_build_object(
      'alreadySubmitted',
      true,

      'session',
      jsonb_build_object(
        'id',
        v_session.id,

        'audit_number',
        v_session.audit_number,

        'audit_date',
        v_session.audit_date,

        'status',
        v_session.status,

        'form_version_id',
        v_session.form_version_id,

        'started_at',
        v_session.started_at,

        'submitted_at',
        v_session.submitted_at,

        'score',
        v_session.score,

        'scoring_snapshot',
        v_session.scoring_snapshot
      )
    );
  end if;


  if v_session.status <> 'draft' then
    raise exception
      'Audit session tidak dapat disubmit.';
  end if;


  -- ----------------------------------------------------------
  -- COUNT FINDINGS
  -- ----------------------------------------------------------

  select
    count(*) filter (
      where risk_level = 'minor'
    ),
    count(*) filter (
      where risk_level = 'medium'
    ),
    count(*) filter (
      where risk_level = 'major'
    ),
    count(*) filter (
      where risk_level = 'critical'
    )
  into
    v_minor,
    v_medium,
    v_major,
    v_critical
  from public.audit_findings
  where audit_session_id =
    v_session.id;


  v_penalty :=
      (v_minor * 1)
    + (v_medium * 2)
    + (v_major * 10)
    + (v_critical * 20);


  v_month_start :=
    date_trunc(
      'month',
      v_session.audit_date
    )::date;


  -- ----------------------------------------------------------
  -- CREATE MONTH SCORE LAZILY
  --
  -- No submitted audit yet = logically 100.
  -- Physical row is created on first submitted audit.
  -- ----------------------------------------------------------

  insert into public.outlet_monthly_scores (
    organization_id,
    outlet_id,
    month_start,
    base_score,
    total_penalty,
    current_score,
    submitted_audit_count
  )
  values (
    v_session.organization_id,
    v_session.outlet_id,
    v_month_start,
    100,
    0,
    100,
    0
  )
  on conflict (
    organization_id,
    outlet_id,
    month_start
  )
  do nothing;


  -- Lock monthly score row.
  -- Concurrent audits for the same outlet/month therefore
  -- serialize their score deductions safely.
  select *
    into v_month
  from public.outlet_monthly_scores
  where organization_id =
      v_session.organization_id
    and outlet_id =
      v_session.outlet_id
    and month_start =
      v_month_start
  for update;


  v_score_before :=
    v_month.current_score;

  v_score_after :=
    greatest(
      0,
      v_score_before -
      v_penalty
    );


  update public.outlet_monthly_scores
  set
    total_penalty =
      total_penalty +
      v_penalty,

    current_score =
      v_score_after,

    submitted_audit_count =
      submitted_audit_count + 1,

    updated_at =
      now()

  where id =
    v_month.id

  returning *
  into v_month;


  -- ----------------------------------------------------------
  -- HISTORICAL SCORE SNAPSHOT
  -- ----------------------------------------------------------

  v_snapshot :=
    jsonb_build_object(
      'scoring_version',
      1,

      'period',
      to_char(
        v_month_start,
        'YYYY-MM'
      ),

      'base_score',
      100,

      'weights',
      jsonb_build_object(
        'minor', 1,
        'medium', 2,
        'major', 10,
        'critical', 20
      ),

      'counts',
      jsonb_build_object(
        'minor', v_minor,
        'medium', v_medium,
        'major', v_major,
        'critical', v_critical
      ),

      'audit_penalty',
      v_penalty,

      'monthly_score_before',
      v_score_before,

      'monthly_score_after',
      v_score_after
    );


  update public.audit_sessions
  set
    status =
      'submitted',

    submitted_at =
      v_submitted_at,

    score =
      v_score_after,

    scoring_snapshot =
      v_snapshot

  where id =
    v_session.id

  returning *
  into v_session;


  return jsonb_build_object(
    'alreadySubmitted',
    false,

    'session',
    jsonb_build_object(
      'id',
      v_session.id,

      'audit_number',
      v_session.audit_number,

      'audit_date',
      v_session.audit_date,

      'status',
      v_session.status,

      'form_version_id',
      v_session.form_version_id,

      'started_at',
      v_session.started_at,

      'submitted_at',
      v_session.submitted_at,

      'score',
      v_session.score,

      'scoring_snapshot',
      v_session.scoring_snapshot
    ),

    'monthlyScore',
    jsonb_build_object(
      'month_start',
      v_month.month_start,

      'base_score',
      v_month.base_score,

      'total_penalty',
      v_month.total_penalty,

      'current_score',
      v_month.current_score,

      'submitted_audit_count',
      v_month.submitted_audit_count
    )
  );

end;
$$;




commit;
