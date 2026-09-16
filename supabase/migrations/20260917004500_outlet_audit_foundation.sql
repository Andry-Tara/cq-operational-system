begin;

-- ============================================================
-- A2 — OUTLET AUDIT FOUNDATION
--
-- Finding-only audit runtime.
--
-- IMPORTANT:
-- - This does NOT reuse public.reports/report_answers.
-- - No one-audit-per-day uniqueness exists.
-- - Unanswered audit points are NOT PASS/OK.
-- - Findings are historical observations, not resolve/reopen tickets.
-- - Opening / Closing runtime is untouched.
-- - OUTLET_AUDIT v1 stays DRAFT and receives NO outlet assignment here.
-- ============================================================


-- ============================================================
-- 1. PREFLIGHT / ORGANIZATION ANCHOR
-- ============================================================

do $$
declare
  v_org_count integer;
  v_existing integer;
begin
  select count(distinct f.organization_id)
    into v_org_count
  from public.forms f
  where upper(f.code) = 'OPENING_FOH'
    and f.operational_scope = 'restaurant';

  if v_org_count <> 1 then
    raise exception
      'A2 STOP: expected exactly one organization owning restaurant OPENING_FOH, found %.',
      v_org_count;
  end if;

  select count(*)
    into v_existing
  from public.forms f
  where upper(f.code) = 'OUTLET_AUDIT';

  if v_existing <> 0 then
    raise exception
      'A2 STOP: OUTLET_AUDIT already exists. Refusing to overwrite an existing audit form.';
  end if;
end;
$$;


-- ============================================================
-- 2. FORM SHELL — DRAFT ONLY
-- ============================================================

do $$
declare
  v_org_id uuid;
  v_form_id uuid;
  v_version_id uuid;
  v_section_id uuid;
  v_version_section_id uuid;
begin
  select distinct f.organization_id
    into v_org_id
  from public.forms f
  where upper(f.code) = 'OPENING_FOH'
    and f.operational_scope = 'restaurant'
  limit 1;

  insert into public.forms (
    organization_id,
    code,
    name,
    description,
    icon,
    operational_scope,
    is_active
  )
  values (
    v_org_id,
    'OUTLET_AUDIT',
    'Outlet Audit',
    'Finding-only outlet audit. Auditors record only observed findings; untouched points are not treated as pass.',
    'clipboard-check',
    'restaurant',
    true
  )
  returning id into v_form_id;

  insert into public.form_versions (
    form_id,
    version_number,
    status,
    notes
  )
  values (
    v_form_id,
    1,
    'draft',
    'Outlet Audit V1 — finding-only draft. Questions will be seeded from the approved assessment source before publication.'
  )
  returning id into v_version_id;

  insert into public.sections (
    form_id,
    code,
    name,
    description,
    is_active
  )
  values (
    v_form_id,
    'FINDINGS',
    'Audit Findings',
    'Reference point library grouped by audit area. No group or point is mandatory.',
    true
  )
  returning id into v_section_id;

  insert into public.form_version_sections (
    form_version_id,
    section_id,
    display_name,
    description,
    sort_order,
    is_required,
    is_active
  )
  values (
    v_version_id,
    v_section_id,
    'Audit Findings',
    'Open only the relevant area and add findings against observed audit points.',
    10,
    false,
    true
  )
  returning id into v_version_section_id;

  insert into public.question_groups (
    version_section_id,
    code,
    name,
    sort_order,
    is_active
  )
  values
    (v_version_section_id, 'PARKING_AREA', 'Parking Area', 10, true),
    (v_version_section_id, 'FOH',          'FOH',          20, true),
    (v_version_section_id, 'PLAYGROUND',   'Playground',   30, true),
    (v_version_section_id, 'TOILET',       'Toilet',       40, true),
    (v_version_section_id, 'GROOMING',     'Grooming',     50, true),
    (v_version_section_id, 'BOH',          'BOH',          60, true),
    (v_version_section_id, 'FOH_BOH',      'FOH & BOH',    70, true);
end;
$$;


-- ============================================================
-- 3. FINDING CATEGORY MASTER
--
-- These are management dimensions from the supplied audit report.
-- They are editable data, not a hard-coded CHECK constraint.
-- ============================================================

create table public.audit_finding_categories (
  id uuid
    primary key
    default gen_random_uuid(),

  organization_id uuid
    not null
    references public.organizations(id)
    on delete restrict,

  code text
    not null,

  name text
    not null,

  sort_order integer
    not null
    default 100,

  is_active boolean
    not null
    default true,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint audit_finding_categories_org_code_key
    unique (organization_id, code)
);

create index audit_finding_categories_org_active_idx
  on public.audit_finding_categories (
    organization_id,
    is_active,
    sort_order
  );

insert into public.audit_finding_categories (
  organization_id,
  code,
  name,
  sort_order
)
select
  org.organization_id,
  seed.code,
  seed.name,
  seed.sort_order
from (
  select distinct f.organization_id
  from public.forms f
  where upper(f.code) = 'OUTLET_AUDIT'
) org
cross join (
  values
    ('FOOD_SAFETY',            'Food Safety',            10),
    ('PEST_CONTROL',           'Pest Control',           20),
    ('INVENTORY_CONTROL',      'Inventory Control',      30),
    ('HYGIENE',                'Hygiene',                40),
    ('ASSET_MANAGEMENT',       'Asset Management',       50),
    ('OPERATIONAL_DISCIPLINE', 'Operational Discipline', 60)
) as seed(code, name, sort_order);


-- ============================================================
-- 4. AUDIT SESSION
--
-- Deliberately NO unique(outlet_id, form_id, audit_date).
-- Multiple audits per outlet per day are valid.
-- ============================================================

create table public.audit_sessions (
  id uuid
    primary key
    default gen_random_uuid(),

  audit_number text
    not null
    unique,

  organization_id uuid
    not null
    references public.organizations(id)
    on delete restrict,

  outlet_id uuid
    not null
    references public.outlets(id)
    on delete restrict,

  form_version_id uuid
    not null
    references public.form_versions(id)
    on delete restrict,

  audit_date date
    not null,

  status text
    not null
    default 'draft'
    check (status in ('draft', 'submitted')),

  auditor_user_id uuid
    not null
    references auth.users(id)
    on delete restrict,

  auditor_name_snapshot text
    not null,

  locale_snapshot text
    not null
    default 'id-ID',

  -- Kept nullable until the risk penalty formula is approved.
  score numeric(6,2),

  scoring_snapshot jsonb
    not null
    default '{}'::jsonb,

  -- Example future payload:
  -- {
  --   "leader_foh": {"user_id":"...", "name":"..."},
  --   "leader_boh": {"user_id":"...", "name":"..."},
  --   "manager": {"user_id":"...", "name":"..."}
  -- }
  pic_snapshot jsonb
    not null
    default '{}'::jsonb,

  pdf_storage_path text,

  started_at timestamptz
    not null
    default now(),

  submitted_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  metadata jsonb
    not null
    default '{}'::jsonb,

  constraint audit_sessions_submitted_state_check
    check (
      (status = 'draft' and submitted_at is null)
      or
      (status = 'submitted' and submitted_at is not null)
    )
);

create index audit_sessions_outlet_date_idx
  on public.audit_sessions (
    outlet_id,
    audit_date desc,
    created_at desc
  );

create index audit_sessions_org_date_idx
  on public.audit_sessions (
    organization_id,
    audit_date desc
  );

create index audit_sessions_form_version_idx
  on public.audit_sessions (form_version_id);

create index audit_sessions_auditor_idx
  on public.audit_sessions (
    auditor_user_id,
    audit_date desc
  );


-- ============================================================
-- 5. FINDINGS
--
-- A finding is one historical observation.
-- There is intentionally NO resolved/reopened/status workflow.
--
-- question_code_snapshot is the cross-version trend key.
-- question_id pins the exact question revision used by that audit.
-- ============================================================

create table public.audit_findings (
  id uuid
    primary key
    default gen_random_uuid(),

  audit_session_id uuid
    not null
    references public.audit_sessions(id)
    on delete cascade,

  question_id uuid
    not null
    references public.questions(id)
    on delete restrict,

  question_code_snapshot text
    not null,

  question_text_snapshot text
    not null,

  area_code_snapshot text
    not null,

  area_name_snapshot text
    not null,

  finding_category_id uuid
    not null
    references public.audit_finding_categories(id)
    on delete restrict,

  finding_category_code_snapshot text
    not null,

  finding_category_name_snapshot text
    not null,

  risk_level text
    not null
    check (
      risk_level in (
        'minor',
        'medium',
        'major',
        'critical'
      )
    ),

  notes text,

  sort_order integer
    not null
    default 100,

  created_by uuid
    not null
    references auth.users(id)
    on delete restrict,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  metadata jsonb
    not null
    default '{}'::jsonb
);

create index audit_findings_session_idx
  on public.audit_findings (
    audit_session_id,
    sort_order,
    created_at
  );

create index audit_findings_question_code_idx
  on public.audit_findings (question_code_snapshot);

create index audit_findings_area_idx
  on public.audit_findings (area_code_snapshot);

create index audit_findings_category_idx
  on public.audit_findings (finding_category_code_snapshot);

create index audit_findings_risk_idx
  on public.audit_findings (risk_level);


-- ============================================================
-- 6. FINDING PHOTOS
-- ============================================================

create table public.audit_finding_photos (
  id uuid
    primary key
    default gen_random_uuid(),

  audit_finding_id uuid
    not null
    references public.audit_findings(id)
    on delete cascade,

  storage_bucket text
    not null
    default 'operational-photos',

  storage_path text
    not null,

  original_filename text,

  mime_type text,

  file_size bigint
    check (file_size is null or file_size >= 0),

  sort_order integer
    not null
    default 100,

  created_by uuid
    not null
    references auth.users(id)
    on delete restrict,

  created_at timestamptz
    not null
    default now(),

  constraint audit_finding_photos_storage_key
    unique (storage_bucket, storage_path)
);

create index audit_finding_photos_finding_idx
  on public.audit_finding_photos (
    audit_finding_id,
    sort_order,
    created_at
  );


-- ============================================================
-- 7. UPDATED-AT TRIGGER
-- ============================================================

create or replace function public.touch_audit_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger audit_finding_categories_touch_updated_at
before update on public.audit_finding_categories
for each row execute function public.touch_audit_updated_at();

create trigger audit_sessions_touch_updated_at
before update on public.audit_sessions
for each row execute function public.touch_audit_updated_at();

create trigger audit_findings_touch_updated_at
before update on public.audit_findings
for each row execute function public.touch_audit_updated_at();


-- ============================================================
-- 8. SECURITY BOUNDARY
--
-- Runtime writes will go through authenticated server API routes
-- with explicit outlet/form permission checks.
--
-- Keep direct browser DML closed until those APIs are installed.
-- service_role remains available to trusted server routes.
-- ============================================================

alter table public.audit_finding_categories enable row level security;
alter table public.audit_sessions enable row level security;
alter table public.audit_findings enable row level security;
alter table public.audit_finding_photos enable row level security;

revoke all
on table
  public.audit_finding_categories,
  public.audit_sessions,
  public.audit_findings,
  public.audit_finding_photos
from anon, authenticated;


-- ============================================================
-- 9. POST-FLIGHT ASSERTIONS
-- ============================================================

do $$
declare
  v_form_id uuid;
  v_version_id uuid;
  v_section_count integer;
  v_group_count integer;
  v_category_count integer;
begin
  select f.id
    into v_form_id
  from public.forms f
  where upper(f.code) = 'OUTLET_AUDIT'
    and f.operational_scope = 'restaurant'
  limit 1;

  if v_form_id is null then
    raise exception 'A2 POSTCHECK: OUTLET_AUDIT form missing.';
  end if;

  select fv.id
    into v_version_id
  from public.form_versions fv
  where fv.form_id = v_form_id
    and fv.version_number = 1
    and fv.status = 'draft'
  limit 1;

  if v_version_id is null then
    raise exception 'A2 POSTCHECK: OUTLET_AUDIT v1 draft missing.';
  end if;

  select count(*)
    into v_section_count
  from public.form_version_sections fvs
  where fvs.form_version_id = v_version_id
    and fvs.is_active = true;

  if v_section_count <> 1 then
    raise exception
      'A2 POSTCHECK: expected 1 active audit version section, found %.',
      v_section_count;
  end if;

  select count(*)
    into v_group_count
  from public.question_groups qg
  join public.form_version_sections fvs
    on fvs.id = qg.version_section_id
  where fvs.form_version_id = v_version_id
    and qg.is_active = true;

  if v_group_count <> 7 then
    raise exception
      'A2 POSTCHECK: expected 7 audit area groups, found %.',
      v_group_count;
  end if;

  select count(*)
    into v_category_count
  from public.audit_finding_categories afc
  join public.forms f
    on f.organization_id = afc.organization_id
   and f.id = v_form_id
  where afc.is_active = true;

  if v_category_count <> 6 then
    raise exception
      'A2 POSTCHECK: expected 6 active finding categories, found %.',
      v_category_count;
  end if;

  if exists (
    select 1
    from public.outlet_form_assignments ofa
    where ofa.form_id = v_form_id
      and ofa.is_active = true
  ) then
    raise exception
      'A2 POSTCHECK: OUTLET_AUDIT must not have active outlet assignments yet.';
  end if;

  if exists (
    select 1
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where fvs.form_version_id = v_version_id
  ) then
    raise exception
      'A2 POSTCHECK: question seed must remain empty until A3.';
  end if;
end;
$$;

commit;
