begin;


-- ============================================================
-- EXCEPTION CENTER V2-A
--
-- Unified remediation workflow for:
--   1. operational issues
--   2. audit findings
--
-- Source records remain authoritative and untouched.
--
-- Direct client writes are not allowed.
-- Mutations will use trusted server routes after RBAC checks.
-- ============================================================


-- ============================================================
-- 1. PERMISSIONS
-- ============================================================

insert into public.permissions (
  organization_id,
  code,
  name,
  description,
  is_active
)
select
  o.id,
  seed.code,
  seed.name,
  seed.description,
  true
from public.organizations o
cross join (
  values
    (
      'exceptions.view',
      'View Exception Center',
      'View operational issues, audit findings and exception workflow status.'
    ),
    (
      'exceptions.manage',
      'Manage Exceptions',
      'Assign PIC, set due dates, update workflow status, resolve, verify and escalate exceptions.'
    )
) as seed(
  code,
  name,
  description
)
on conflict (
  organization_id,
  code
)
do update set
  name =
    excluded.name,
  description =
    excluded.description,
  is_active =
    true,
  updated_at =
    now();


-- ============================================================
-- 2. ROLE PERMISSIONS
--
-- View:
--   BOD
--   MANAGEMENT
--   AREA_MANAGER
--   ORG_ADMIN
--
-- Manage:
--   MANAGEMENT
--   AREA_MANAGER
--   ORG_ADMIN
--
-- BOD intentionally remains read-only.
-- ============================================================

insert into public.role_permissions (
  role_id,
  permission_id,
  is_allowed
)
select
  r.id,
  p.id,
  true
from public.roles r
join public.permissions p
  on p.organization_id =
    r.organization_id
where r.is_active =
    true
  and p.is_active =
    true
  and (
    (
      p.code =
        'exceptions.view'
      and r.code in (
        'BOD',
        'MANAGEMENT',
        'AREA_MANAGER',
        'ORG_ADMIN'
      )
    )
    or
    (
      p.code =
        'exceptions.manage'
      and r.code in (
        'MANAGEMENT',
        'AREA_MANAGER',
        'ORG_ADMIN'
      )
    )
  )
on conflict (
  role_id,
  permission_id
)
do update set
  is_allowed =
    true,
  updated_at =
    now();


-- ============================================================
-- 3. WORKFLOW TABLE
-- ============================================================

create table public.exception_workflows (
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

  source_type text
    not null,

  source_id uuid
    not null,

  status text
    not null
    default 'open',

  assigned_to uuid
    references public.profiles(id)
    on delete set null,

  assigned_by uuid
    references public.profiles(id)
    on delete set null,

  assigned_at timestamptz,

  due_at timestamptz,

  sla_hours integer,

  escalated_at timestamptz,

  escalated_by uuid
    references public.profiles(id)
    on delete set null,

  resolution_note text,

  resolved_at timestamptz,

  resolved_by uuid
    references public.profiles(id)
    on delete set null,

  verified_at timestamptz,

  verified_by uuid
    references public.profiles(id)
    on delete set null,

  closed_at timestamptz,

  closed_by uuid
    references public.profiles(id)
    on delete set null,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint exception_workflows_source_type_chk
    check (
      source_type in (
        'operations_issue',
        'audit_finding'
      )
    ),

  constraint exception_workflows_status_chk
    check (
      status in (
        'open',
        'assigned',
        'in_progress',
        'resolved',
        'verified',
        'closed'
      )
    ),

  constraint exception_workflows_sla_hours_chk
    check (
      sla_hours is null
      or sla_hours > 0
    ),

  constraint exception_workflows_source_unique
    unique (
      organization_id,
      source_type,
      source_id
    )
);


create index exception_workflows_org_status_idx
on public.exception_workflows (
  organization_id,
  status,
  updated_at desc
);


create index exception_workflows_outlet_status_idx
on public.exception_workflows (
  outlet_id,
  status,
  updated_at desc
);


create index exception_workflows_assignee_idx
on public.exception_workflows (
  assigned_to,
  status,
  due_at
)
where assigned_to is not null;


create index exception_workflows_due_idx
on public.exception_workflows (
  due_at,
  status
)
where due_at is not null;


-- ============================================================
-- 4. IMMUTABLE AUDIT EVENT LOG
-- ============================================================

create table public.exception_workflow_events (
  id uuid
    primary key
    default gen_random_uuid(),

  workflow_id uuid
    not null
    references public.exception_workflows(id)
    on delete cascade,

  event_type text
    not null,

  from_status text,

  to_status text,

  actor_user_id uuid
    references public.profiles(id)
    on delete set null,

  note text,

  metadata jsonb
    not null
    default '{}'::jsonb,

  created_at timestamptz
    not null
    default now(),

  constraint exception_workflow_events_type_chk
    check (
      event_type in (
        'created',
        'assigned',
        'assignment_changed',
        'due_date_changed',
        'status_changed',
        'escalated',
        'resolution_added',
        'verified',
        'closed'
      )
    )
);


create index exception_workflow_events_workflow_idx
on public.exception_workflow_events (
  workflow_id,
  created_at desc
);


-- ============================================================
-- 5. UPDATED_AT
-- ============================================================

create or replace function public.set_exception_workflow_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at :=
    now();

  return new;
end;
$$;


drop trigger if exists
  exception_workflows_set_updated_at
on public.exception_workflows;


create trigger exception_workflows_set_updated_at
before update
on public.exception_workflows
for each row
execute function public.set_exception_workflow_updated_at();


-- ============================================================
-- 6. SOURCE VALIDATION
--
-- organization_id / outlet_id are derived from the source.
-- Caller cannot spoof another outlet or organization.
-- ============================================================

create or replace function public.validate_exception_workflow_source()
returns trigger
language plpgsql
as $$
declare
  v_organization_id uuid;
  v_outlet_id uuid;
begin

  if tg_op =
      'UPDATE'
     and (
       new.source_type is distinct from
         old.source_type
       or
       new.source_id is distinct from
         old.source_id
     )
  then
    raise exception
      'Exception workflow source identity is immutable.';
  end if;


  if new.source_type =
      'operations_issue'
  then

    select
      o.organization_id,
      r.outlet_id
    into
      v_organization_id,
      v_outlet_id
    from public.issues i
    join public.reports r
      on r.id =
        i.report_id
    join public.outlets o
      on o.id =
        r.outlet_id
    where i.id =
      new.source_id
    limit 1;


  elsif new.source_type =
      'audit_finding'
  then

    select
      s.organization_id,
      s.outlet_id
    into
      v_organization_id,
      v_outlet_id
    from public.audit_findings f
    join public.audit_sessions s
      on s.id =
        f.audit_session_id
    where f.id =
      new.source_id
    limit 1;

  end if;


  if v_organization_id is null
     or v_outlet_id is null
  then
    raise exception
      'Exception workflow source does not exist.';
  end if;


  new.organization_id :=
    v_organization_id;

  new.outlet_id :=
    v_outlet_id;


  return new;
end;
$$;


drop trigger if exists
  exception_workflows_validate_source
on public.exception_workflows;


create trigger exception_workflows_validate_source
before insert
or update
on public.exception_workflows
for each row
execute function public.validate_exception_workflow_source();


-- ============================================================
-- 7. RLS / DIRECT CLIENT ACCESS
--
-- No authenticated direct table access.
-- Exception mutations must pass through trusted server routes.
-- ============================================================

alter table public.exception_workflows
  enable row level security;

alter table public.exception_workflow_events
  enable row level security;


revoke all
on public.exception_workflows
from anon,
     authenticated;


revoke all
on public.exception_workflow_events
from anon,
     authenticated;


grant all
on public.exception_workflows
to service_role;


grant all
on public.exception_workflow_events
to service_role;


-- ============================================================
-- 8. POSTCHECKS
-- ============================================================

do $$
declare
  v_bad_bod_manage integer;
begin

  select count(*)
  into v_bad_bod_manage
  from public.role_permissions rp
  join public.roles r
    on r.id =
      rp.role_id
  join public.permissions p
    on p.id =
      rp.permission_id
  where r.code =
      'BOD'
    and p.code =
      'exceptions.manage'
    and rp.is_allowed =
      true;


  if v_bad_bod_manage > 0 then
    raise exception
      'EXCEPTION V2 POSTCHECK: BOD must not receive exceptions.manage.';
  end if;


  if not exists (
    select 1
    from public.permissions p
    where p.code =
      'exceptions.view'
      and p.is_active =
        true
  ) then
    raise exception
      'EXCEPTION V2 POSTCHECK: exceptions.view missing.';
  end if;


  if not exists (
    select 1
    from public.permissions p
    where p.code =
      'exceptions.manage'
      and p.is_active =
        true
  ) then
    raise exception
      'EXCEPTION V2 POSTCHECK: exceptions.manage missing.';
  end if;

end;
$$;


commit;
