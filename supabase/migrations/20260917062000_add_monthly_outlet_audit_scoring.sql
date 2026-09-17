begin;

-- ============================================================
-- A5.6.1 — MONTHLY OUTLET AUDIT SCORING
--
-- Every outlet starts each month at 100 points.
--
-- Finding penalties:
-- minor    =  2
-- medium   =  5
-- major    = 10
-- critical = 20
--
-- Draft findings do NOT affect the score.
-- Penalty is applied exactly once when an audit is submitted.
-- ============================================================

create table public.outlet_monthly_scores (
  id uuid
    primary key
    default gen_random_uuid(),

  organization_id uuid
    not null
    references public.organizations(id)
    on delete restrict,

  outlet_id uuid
    not null
    references public.outlets(id)
    on delete restrict,

  month_start date
    not null,

  base_score numeric(6,2)
    not null
    default 100,

  total_penalty numeric(8,2)
    not null
    default 0,

  current_score numeric(6,2)
    not null
    default 100,

  submitted_audit_count integer
    not null
    default 0,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint outlet_monthly_scores_org_outlet_month_key
    unique (
      organization_id,
      outlet_id,
      month_start
    ),

  constraint outlet_monthly_scores_month_start_check
    check (
      month_start =
      date_trunc(
        'month',
        month_start
      )::date
    ),

  constraint outlet_monthly_scores_base_score_check
    check (
      base_score >= 0
      and base_score <= 100
    ),

  constraint outlet_monthly_scores_total_penalty_check
    check (
      total_penalty >= 0
    ),

  constraint outlet_monthly_scores_current_score_check
    check (
      current_score >= 0
      and current_score <= 100
    ),

  constraint outlet_monthly_scores_audit_count_check
    check (
      submitted_audit_count >= 0
    )
);

create index outlet_monthly_scores_outlet_month_idx
  on public.outlet_monthly_scores (
    outlet_id,
    month_start desc
  );

create index outlet_monthly_scores_org_month_idx
  on public.outlet_monthly_scores (
    organization_id,
    month_start desc,
    current_score
  );

create trigger outlet_monthly_scores_touch_updated_at
before update on public.outlet_monthly_scores
for each row
execute function public.touch_audit_updated_at();


-- ============================================================
-- ATOMIC SUBMIT + SCORE
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
      (v_minor * 2)
    + (v_medium * 5)
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
        'minor', 2,
        'medium', 5,
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


-- ============================================================
-- SECURITY
-- ============================================================

alter table public.outlet_monthly_scores
enable row level security;

revoke all
on table public.outlet_monthly_scores
from anon, authenticated;

revoke all
on function public.submit_audit_with_monthly_score(uuid, uuid)
from public, anon, authenticated;

grant execute
on function public.submit_audit_with_monthly_score(uuid, uuid)
to service_role;


-- ============================================================
-- POSTCHECK
-- ============================================================

do $$
begin

  if to_regclass(
    'public.outlet_monthly_scores'
  ) is null then
    raise exception
      'A5.6 POSTCHECK: outlet_monthly_scores missing.';
  end if;

  if to_regprocedure(
    'public.submit_audit_with_monthly_score(uuid,uuid)'
  ) is null then
    raise exception
      'A5.6 POSTCHECK: scoring submit function missing.';
  end if;

end;
$$;

commit;
