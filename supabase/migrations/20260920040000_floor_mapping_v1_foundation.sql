begin;

-- ============================================================
-- FLOOR MAPPING V1
-- Pilot: CQ Bandung
--
-- FOH  = visual floor-map assignment
-- BOH  = list / station assignment
--
-- Daily sessions:
--   MORNING
--   AFTERNOON
--   CLOSING
--
-- Templates are versioned so historical sessions keep their
-- original map reference even when a new floor layout is made.
-- ============================================================


-- ============================================================
-- 1. FLOOR MAP TEMPLATE
-- ============================================================

create table public.floor_mapping_templates (
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

  name text
    not null,

  version_number integer
    not null
    default 1
    check (
      version_number > 0
    ),

  image_storage_path text
    not null,

  image_width integer,
  image_height integer,

  is_active boolean
    not null
    default false,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint floor_mapping_templates_name_chk
    check (
      btrim(name) <> ''
    ),

  constraint floor_mapping_templates_image_chk
    check (
      btrim(image_storage_path) <> ''
    ),

  constraint floor_mapping_templates_outlet_version_key
    unique (
      outlet_id,
      version_number
    )
);


create unique index
floor_mapping_templates_one_active_per_outlet_idx
on public.floor_mapping_templates (
  outlet_id
)
where is_active = true;


create index
floor_mapping_templates_org_outlet_idx
on public.floor_mapping_templates (
  organization_id,
  outlet_id
);


create trigger floor_mapping_templates_set_updated_at
before update
on public.floor_mapping_templates
for each row
execute function public.set_updated_at();


-- ============================================================
-- 2. FOH VISUAL ZONES
--
-- x/y/width/height use percentages, not pixels.
-- This keeps the same template responsive on desktop/mobile.
--
-- Example:
-- x_pct = 35.50
-- y_pct = 20.25
-- ============================================================

create table public.floor_mapping_zones (
  id uuid
    primary key
    default gen_random_uuid(),

  template_id uuid
    not null
    references public.floor_mapping_templates(id)
    on delete cascade,

  zone_code text
    not null,

  zone_name text
    not null,

  zone_type text
    not null
    check (
      zone_type in (
        'TABLE',
        'VIP',
        'FLOOR',
        'SERVER',
        'LEADER',
        'RUNNER',
        'CHECKER',
        'CASHIER',
        'HOST',
        'GRO',
        'TA_HK',
        'MOD',
        'SERVICE_AREA',
        'OTHER'
      )
    ),

  x_pct numeric(6,3)
    not null
    check (
      x_pct >= 0
      and x_pct <= 100
    ),

  y_pct numeric(6,3)
    not null
    check (
      y_pct >= 0
      and y_pct <= 100
    ),

  width_pct numeric(6,3)
    check (
      width_pct is null
      or (
        width_pct > 0
        and width_pct <= 100
      )
    ),

  height_pct numeric(6,3)
    check (
      height_pct is null
      or (
        height_pct > 0
        and height_pct <= 100
      )
    ),

  shape text
    not null
    default 'PILL'
    check (
      shape in (
        'CIRCLE',
        'PILL',
        'RECT'
      )
    ),

  display_label text,

  capacity integer
    check (
      capacity is null
      or capacity >= 0
    ),

  sort_order integer
    not null
    default 0,

  is_active boolean
    not null
    default true,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint floor_mapping_zones_code_chk
    check (
      btrim(zone_code) <> ''
    ),

  constraint floor_mapping_zones_name_chk
    check (
      btrim(zone_name) <> ''
    ),

  constraint floor_mapping_zones_template_code_key
    unique (
      template_id,
      zone_code
    )
);


create index
floor_mapping_zones_template_sort_idx
on public.floor_mapping_zones (
  template_id,
  sort_order
);


create trigger floor_mapping_zones_set_updated_at
before update
on public.floor_mapping_zones
for each row
execute function public.set_updated_at();


-- ============================================================
-- 3. BOH POSITION TEMPLATE
--
-- Kitchen stays LIST VIEW.
-- No visual map required.
-- ============================================================

create table public.floor_mapping_boh_positions (
  id uuid
    primary key
    default gen_random_uuid(),

  template_id uuid
    not null
    references public.floor_mapping_templates(id)
    on delete cascade,

  position_code text
    not null,

  position_name text
    not null,

  default_station text,

  sort_order integer
    not null
    default 0,

  is_active boolean
    not null
    default true,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint floor_mapping_boh_position_code_chk
    check (
      btrim(position_code) <> ''
    ),

  constraint floor_mapping_boh_position_name_chk
    check (
      btrim(position_name) <> ''
    ),

  constraint floor_mapping_boh_template_position_key
    unique (
      template_id,
      position_code
    )
);


create index
floor_mapping_boh_template_sort_idx
on public.floor_mapping_boh_positions (
  template_id,
  sort_order
);


create trigger floor_mapping_boh_positions_set_updated_at
before update
on public.floor_mapping_boh_positions
for each row
execute function public.set_updated_at();


-- ============================================================
-- 4. DAILY FLOOR MAPPING SESSION
-- ============================================================

create table public.floor_mapping_sessions (
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

  template_id uuid
    not null
    references public.floor_mapping_templates(id)
    on delete restrict,

  business_date date
    not null,

  session_type text
    not null
    check (
      session_type in (
        'MORNING',
        'AFTERNOON',
        'CLOSING'
      )
    ),

  status text
    not null
    default 'DRAFT'
    check (
      status in (
        'DRAFT',
        'SUBMITTED'
      )
    ),

  general_notes text,

  created_by uuid
    not null
    references auth.users(id)
    on delete restrict,

  pic_name_snapshot text
    not null,

  submitted_by uuid
    references auth.users(id)
    on delete restrict,

  submitted_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint floor_mapping_sessions_unique_key
    unique (
      outlet_id,
      business_date,
      session_type
    ),

  constraint floor_mapping_sessions_pic_chk
    check (
      btrim(
        pic_name_snapshot
      ) <> ''
    ),

  constraint floor_mapping_sessions_submit_chk
    check (
      (
        status = 'DRAFT'
        and submitted_at is null
        and submitted_by is null
      )
      or
      (
        status = 'SUBMITTED'
        and submitted_at is not null
        and submitted_by is not null
      )
    )
);


create index
floor_mapping_sessions_outlet_date_idx
on public.floor_mapping_sessions (
  outlet_id,
  business_date desc,
  session_type
);


create index
floor_mapping_sessions_org_date_idx
on public.floor_mapping_sessions (
  organization_id,
  business_date desc
);


create trigger floor_mapping_sessions_set_updated_at
before update
on public.floor_mapping_sessions
for each row
execute function public.set_updated_at();


-- ============================================================
-- 5. FOH DAILY ASSIGNMENTS
--
-- assigned_names is an array because examples include:
--   PUTRI & PAK ANTO
--   NOVITA & AISYAH
-- ============================================================

create table public.floor_mapping_foh_assignments (
  id uuid
    primary key
    default gen_random_uuid(),

  session_id uuid
    not null
    references public.floor_mapping_sessions(id)
    on delete cascade,

  zone_id uuid
    not null
    references public.floor_mapping_zones(id)
    on delete restrict,

  position_label text,

  assigned_names text[]
    not null
    default '{}'::text[],

  assignment_note text,

  sort_order integer
    not null
    default 0,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint floor_mapping_foh_session_zone_key
    unique (
      session_id,
      zone_id
    ),

  constraint floor_mapping_foh_names_chk
    check (
      cardinality(
        assigned_names
      ) > 0
    )
);


create index
floor_mapping_foh_session_idx
on public.floor_mapping_foh_assignments (
  session_id,
  sort_order
);


create trigger floor_mapping_foh_assignments_set_updated_at
before update
on public.floor_mapping_foh_assignments
for each row
execute function public.set_updated_at();


-- ============================================================
-- 6. BOH DAILY ASSIGNMENTS
-- ============================================================

create table public.floor_mapping_boh_assignments (
  id uuid
    primary key
    default gen_random_uuid(),

  session_id uuid
    not null
    references public.floor_mapping_sessions(id)
    on delete cascade,

  position_id uuid
    not null
    references public.floor_mapping_boh_positions(id)
    on delete restrict,

  assigned_names text[]
    not null
    default '{}'::text[],

  station_note text,

  sort_order integer
    not null
    default 0,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint floor_mapping_boh_session_position_key
    unique (
      session_id,
      position_id
    ),

  constraint floor_mapping_boh_names_chk
    check (
      cardinality(
        assigned_names
      ) > 0
    )
);


create index
floor_mapping_boh_session_idx
on public.floor_mapping_boh_assignments (
  session_id,
  sort_order
);


create trigger floor_mapping_boh_assignments_set_updated_at
before update
on public.floor_mapping_boh_assignments
for each row
execute function public.set_updated_at();


-- ============================================================
-- 7. SCOPE GUARD
--
-- Session organization/outlet/template must match.
-- CNT excluded.
-- ============================================================

create or replace function
public.validate_floor_mapping_session_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_outlet_org uuid;
  v_outlet_code text;
  v_template_outlet uuid;
  v_template_org uuid;
begin

  select
    o.organization_id,
    upper(
      btrim(
        o.code
      )
    )
  into
    v_outlet_org,
    v_outlet_code
  from public.outlets o
  where o.id =
      new.outlet_id
    and o.is_active =
      true;


  if v_outlet_org is null then
    raise exception
      'Floor Mapping requires an active outlet.';
  end if;


  if v_outlet_code = 'CNT' then
    raise exception
      'Central Kitchen is not available for Floor Mapping.';
  end if;


  if v_outlet_org is distinct from
     new.organization_id then
    raise exception
      'Floor Mapping organization mismatch.';
  end if;


  select
    t.outlet_id,
    t.organization_id
  into
    v_template_outlet,
    v_template_org
  from public.floor_mapping_templates t
  where t.id =
    new.template_id;


  if v_template_outlet is null then
    raise exception
      'Floor Mapping template was not found.';
  end if;


  if v_template_outlet is distinct from
     new.outlet_id then
    raise exception
      'Floor Mapping template outlet mismatch.';
  end if;


  if v_template_org is distinct from
     new.organization_id then
    raise exception
      'Floor Mapping template organization mismatch.';
  end if;


  return new;
end;
$$;


create trigger floor_mapping_session_scope_guard
before insert or update
on public.floor_mapping_sessions
for each row
execute function
public.validate_floor_mapping_session_scope();


-- ============================================================
-- 8. ASSIGNMENT TEMPLATE GUARDS
-- ============================================================

create or replace function
public.validate_floor_mapping_foh_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_template uuid;
  v_zone_template uuid;
begin

  select template_id
  into v_session_template
  from public.floor_mapping_sessions
  where id =
    new.session_id;


  select template_id
  into v_zone_template
  from public.floor_mapping_zones
  where id =
    new.zone_id
    and is_active =
      true;


  if
    v_session_template is null
    or v_zone_template is null
    or v_session_template
       is distinct from
       v_zone_template
  then
    raise exception
      'FOH assignment template mismatch.';
  end if;


  return new;
end;
$$;


create trigger floor_mapping_foh_assignment_guard
before insert or update
on public.floor_mapping_foh_assignments
for each row
execute function
public.validate_floor_mapping_foh_assignment();


create or replace function
public.validate_floor_mapping_boh_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_template uuid;
  v_position_template uuid;
begin

  select template_id
  into v_session_template
  from public.floor_mapping_sessions
  where id =
    new.session_id;


  select template_id
  into v_position_template
  from public.floor_mapping_boh_positions
  where id =
    new.position_id
    and is_active =
      true;


  if
    v_session_template is null
    or v_position_template is null
    or v_session_template
       is distinct from
       v_position_template
  then
    raise exception
      'BOH assignment template mismatch.';
  end if;


  return new;
end;
$$;


create trigger floor_mapping_boh_assignment_guard
before insert or update
on public.floor_mapping_boh_assignments
for each row
execute function
public.validate_floor_mapping_boh_assignment();


-- ============================================================
-- 9. RLS
--
-- Runtime will use authenticated server routes.
-- No raw browser DB writes.
-- ============================================================

alter table public.floor_mapping_templates
  enable row level security;

alter table public.floor_mapping_zones
  enable row level security;

alter table public.floor_mapping_boh_positions
  enable row level security;

alter table public.floor_mapping_sessions
  enable row level security;

alter table public.floor_mapping_foh_assignments
  enable row level security;

alter table public.floor_mapping_boh_assignments
  enable row level security;


revoke all
on public.floor_mapping_templates,
   public.floor_mapping_zones,
   public.floor_mapping_boh_positions,
   public.floor_mapping_sessions,
   public.floor_mapping_foh_assignments,
   public.floor_mapping_boh_assignments
from public, anon, authenticated;


grant
  select,
  insert,
  update,
  delete
on public.floor_mapping_templates,
   public.floor_mapping_zones,
   public.floor_mapping_boh_positions,
   public.floor_mapping_sessions,
   public.floor_mapping_foh_assignments,
   public.floor_mapping_boh_assignments
to service_role;


-- ============================================================
-- 10. POSTCHECK
-- ============================================================

do $$
declare
  v_tables integer;
begin

  select count(*)
  into v_tables
  from pg_class c
  join pg_namespace n
    on n.oid =
       c.relnamespace
  where n.nspname =
      'public'
    and c.relname in (
      'floor_mapping_templates',
      'floor_mapping_zones',
      'floor_mapping_boh_positions',
      'floor_mapping_sessions',
      'floor_mapping_foh_assignments',
      'floor_mapping_boh_assignments'
    )
    and c.relkind =
      'r';


  if v_tables <> 6 then
    raise exception
      'FLOOR MAPPING POSTCHECK: expected 6 tables, found %.',
      v_tables;
  end if;

end;
$$;


commit;
