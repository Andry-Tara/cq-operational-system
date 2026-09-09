begin;

-- ============================================================
-- APPLICABILITY ENGINE V1
--
-- Foundation only:
--   1. facility_definitions
--   2. outlet_facilities
--   3. report_question_applicability
--
-- Does NOT:
--   - modify existing Form V1
--   - modify questions
--   - backfill historical reports
--   - activate N/A behavior
-- ============================================================


-- ============================================================
-- 1. FACILITY DEFINITIONS
-- ============================================================

create table public.facility_definitions (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  code text not null,
  name text not null,
  description text null,

  is_active boolean not null default true,

  created_by uuid null
    references public.profiles(id)
    on delete set null,

  updated_by uuid null
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint facility_definitions_code_format_chk
    check (
      code ~ '^[A-Z][A-Z0-9_]*$'
    ),

  constraint facility_definitions_name_not_blank_chk
    check (
      btrim(name) <> ''
    ),

  constraint facility_definitions_org_code_key
    unique (
      organization_id,
      code
    )
);

create index facility_definitions_org_active_idx
  on public.facility_definitions (
    organization_id,
    is_active
  );

create trigger facility_definitions_set_updated_at
before update
on public.facility_definitions
for each row
execute function public.set_updated_at();


-- ============================================================
-- 2. OUTLET FACILITIES
-- ============================================================

create table public.outlet_facilities (
  id uuid primary key default gen_random_uuid(),

  outlet_id uuid not null
    references public.outlets(id)
    on delete cascade,

  facility_id uuid not null
    references public.facility_definitions(id)
    on delete restrict,

  is_available boolean not null,

  notes text null,

  created_by uuid null
    references public.profiles(id)
    on delete set null,

  updated_by uuid null
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint outlet_facilities_outlet_facility_key
    unique (
      outlet_id,
      facility_id
    )
);

create index outlet_facilities_outlet_idx
  on public.outlet_facilities (
    outlet_id
  );

create index outlet_facilities_facility_idx
  on public.outlet_facilities (
    facility_id
  );

create trigger outlet_facilities_set_updated_at
before update
on public.outlet_facilities
for each row
execute function public.set_updated_at();


-- ============================================================
-- ORGANIZATION SCOPE GUARD
--
-- Prevent:
--
-- Outlet from Organization A
-- being assigned a facility definition from Organization B.
--
-- RLS is authorization.
-- This trigger is database integrity.
-- ============================================================

create or replace function
public.validate_outlet_facility_organization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_outlet_org_id uuid;
  v_facility_org_id uuid;
begin
  select o.organization_id
    into v_outlet_org_id
  from public.outlets o
  where o.id = new.outlet_id;

  if not found then
    raise exception
      'Outlet % does not exist.',
      new.outlet_id;
  end if;

  select fd.organization_id
    into v_facility_org_id
  from public.facility_definitions fd
  where fd.id = new.facility_id;

  if not found then
    raise exception
      'Facility definition % does not exist.',
      new.facility_id;
  end if;

  if v_outlet_org_id is distinct from
     v_facility_org_id
  then
    raise exception
      'Outlet and facility definition must belong to the same organization.';
  end if;

  return new;
end;
$$;

create trigger outlet_facilities_validate_organization
before insert or update of outlet_id, facility_id
on public.outlet_facilities
for each row
execute function
  public.validate_outlet_facility_organization();


-- ============================================================
-- 3. REPORT QUESTION APPLICABILITY SNAPSHOT
--
-- Snapshot ALL questions for a report section:
--
-- applicable     → is_applicable = true
-- N/A            → is_applicable = false
--
-- Historical configuration must never depend on the
-- outlet's current facility profile.
-- ============================================================

create table public.report_question_applicability (
  id uuid primary key default gen_random_uuid(),

  report_section_id uuid not null
    references public.report_sections(id)
    on delete cascade,

  question_id uuid not null
    references public.questions(id)
    on delete restrict,

  is_applicable boolean not null,

  source_type text not null,
  source_key text null,

  reason_snapshot text null,

  created_at timestamptz not null default now(),

  constraint report_question_applicability_unique
    unique (
      report_section_id,
      question_id
    ),

  constraint report_question_applicability_source_type_chk
    check (
      source_type in (
        'global',
        'facility'
      )
    ),

  constraint report_question_applicability_source_shape_chk
    check (
      (
        source_type = 'global'
        and source_key is null
      )
      or
      (
        source_type = 'facility'
        and nullif(
          btrim(source_key),
          ''
        ) is not null
      )
    )
);

create index report_question_applicability_section_idx
  on public.report_question_applicability (
    report_section_id
  );

create index report_question_applicability_question_idx
  on public.report_question_applicability (
    question_id
  );


-- ============================================================
-- RLS
-- ============================================================

alter table public.facility_definitions
  enable row level security;

alter table public.outlet_facilities
  enable row level security;

alter table public.report_question_applicability
  enable row level security;


-- ============================================================
-- FACILITY DEFINITIONS
--
-- Admin-owned configuration.
-- ============================================================

create policy
  "facility_definitions_select_admin"
on public.facility_definitions
for select
to authenticated
using (
  public.is_org_admin(
    organization_id
  )
);

create policy
  "facility_definitions_insert_admin"
on public.facility_definitions
for insert
to authenticated
with check (
  public.is_org_admin(
    organization_id
  )
);

create policy
  "facility_definitions_update_admin"
on public.facility_definitions
for update
to authenticated
using (
  public.is_org_admin(
    organization_id
  )
)
with check (
  public.is_org_admin(
    organization_id
  )
);

create policy
  "facility_definitions_delete_admin"
on public.facility_definitions
for delete
to authenticated
using (
  public.is_org_admin(
    organization_id
  )
);


-- ============================================================
-- OUTLET FACILITIES
--
-- Read:
-- user with outlet access.
--
-- Write:
-- organization admin only.
-- ============================================================

create policy
  "outlet_facilities_select_outlet_access"
on public.outlet_facilities
for select
to authenticated
using (
  public.has_outlet_access(
    outlet_id
  )
);

create policy
  "outlet_facilities_insert_admin"
on public.outlet_facilities
for insert
to authenticated
with check (
  exists (
    select 1
    from public.outlets o
    where o.id =
      outlet_facilities.outlet_id
      and public.is_org_admin(
        o.organization_id
      )
  )
);

create policy
  "outlet_facilities_update_admin"
on public.outlet_facilities
for update
to authenticated
using (
  exists (
    select 1
    from public.outlets o
    where o.id =
      outlet_facilities.outlet_id
      and public.is_org_admin(
        o.organization_id
      )
  )
)
with check (
  exists (
    select 1
    from public.outlets o
    where o.id =
      outlet_facilities.outlet_id
      and public.is_org_admin(
        o.organization_id
      )
  )
);

create policy
  "outlet_facilities_delete_admin"
on public.outlet_facilities
for delete
to authenticated
using (
  exists (
    select 1
    from public.outlets o
    where o.id =
      outlet_facilities.outlet_id
      and public.is_org_admin(
        o.organization_id
      )
  )
);


-- ============================================================
-- REPORT QUESTION APPLICABILITY
--
-- Authenticated users may READ only if they can view the
-- report section.
--
-- No INSERT / UPDATE / DELETE policy is intentionally created.
--
-- Snapshot mutation belongs to trusted server-side report
-- lifecycle using the admin/service client.
--
-- PIC cannot mark a question N/A.
-- ============================================================

create policy
  "report_question_applicability_select"
on public.report_question_applicability
for select
to authenticated
using (
  public.can_access_report_section(
    report_section_id,
    'view'
  )
);


-- ============================================================
-- TABLE PRIVILEGES
-- ============================================================

grant
  select,
  insert,
  update,
  delete
on public.facility_definitions
to authenticated;

grant
  select,
  insert,
  update,
  delete
on public.outlet_facilities
to authenticated;

grant
  select
on public.report_question_applicability
to authenticated;

grant all
on public.facility_definitions
to service_role;

grant all
on public.outlet_facilities
to service_role;

grant all
on public.report_question_applicability
to service_role;


-- ============================================================
-- COMMENTS
-- ============================================================

comment on table public.facility_definitions is
  'Organization-scoped master definitions for outlet facilities and operational capabilities.';

comment on table public.outlet_facilities is
  'Current facility availability configuration for an outlet. Missing configuration is not equivalent to N/A.';

comment on table public.report_question_applicability is
  'Historical per-report-section applicability snapshot. N/A questions are stored with is_applicable=false.';

commit;
