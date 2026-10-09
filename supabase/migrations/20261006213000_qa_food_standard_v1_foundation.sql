begin;

-- ============================================================
-- QA FOOD STANDARD V1 — FOUNDATION
--
-- Audit module:
--   Kitchen Speed & Menu Quality
--
-- Core rules:
--   - One QA session targets 10 unique menus by default.
--   - Menus may be ordered/tested partially in multiple rounds.
--   - Service timer is per menu.
--   - Default service standard = 13 minutes / 780 seconds.
--   - Food assessment contains 9 manual quality criteria.
--   - Final finding / exception integration comes in next phase.
--
-- Existing Test Food V1 is intentionally NOT modified.
-- ============================================================


-- ============================================================
-- 1. QA FOOD MENU MASTER
-- ============================================================

create table if not exists public.qa_food_menus (
  id uuid
    primary key
    default gen_random_uuid(),

  organization_id uuid
    not null
    references public.organizations(id)
    on delete restrict,

  source text
    not null
    default 'HOT_POT_WEB',

  source_menu_key text
    not null,

  name text
    not null,

  category text,

  default_service_standard_seconds integer
    not null
    default 780,

  is_active boolean
    not null
    default true,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint qa_food_menus_source_key
    unique (
      organization_id,
      source,
      source_menu_key
    ),

  constraint qa_food_menus_name_chk
    check (
      btrim(name) <> ''
    ),

  constraint qa_food_menus_source_key_chk
    check (
      btrim(source_menu_key) <> ''
    ),

  constraint qa_food_menus_service_standard_chk
    check (
      default_service_standard_seconds > 0
      and default_service_standard_seconds <= 7200
    )
);


create index if not exists qa_food_menus_org_active_idx
on public.qa_food_menus (
  organization_id,
  is_active,
  category,
  name
);


drop trigger if exists qa_food_menus_set_updated_at
on public.qa_food_menus;

create trigger qa_food_menus_set_updated_at
before update
on public.qa_food_menus
for each row
execute function public.set_updated_at();


-- ============================================================
-- 2. MENU ↔ OUTLET
-- ============================================================

create table if not exists public.qa_food_menu_outlets (
  id uuid
    primary key
    default gen_random_uuid(),

  menu_id uuid
    not null
    references public.qa_food_menus(id)
    on delete cascade,

  outlet_id uuid
    not null
    references public.outlets(id)
    on delete restrict,

  source_branch_id text,

  qa_eligible boolean
    not null
    default true,

  service_standard_seconds integer,

  is_active boolean
    not null
    default true,

  last_synced_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint qa_food_menu_outlets_key
    unique (
      menu_id,
      outlet_id
    ),

  constraint qa_food_menu_outlets_service_standard_chk
    check (
      service_standard_seconds is null
      or (
        service_standard_seconds > 0
        and service_standard_seconds <= 7200
      )
    )
);


create index if not exists qa_food_menu_outlets_outlet_idx
on public.qa_food_menu_outlets (
  outlet_id,
  is_active,
  qa_eligible
);


drop trigger if exists qa_food_menu_outlets_set_updated_at
on public.qa_food_menu_outlets;

create trigger qa_food_menu_outlets_set_updated_at
before update
on public.qa_food_menu_outlets
for each row
execute function public.set_updated_at();


-- ============================================================
-- 3. MENU / OUTLET ORGANIZATION GUARD
-- ============================================================

create or replace function
public.validate_qa_food_menu_outlet_org()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_menu_org uuid;
  v_outlet_org uuid;
begin
  select organization_id
    into v_menu_org
  from public.qa_food_menus
  where id = new.menu_id;

  select organization_id
    into v_outlet_org
  from public.outlets
  where id = new.outlet_id;

  if v_menu_org is null
     or v_outlet_org is null
     or v_menu_org is distinct from v_outlet_org then
    raise exception
      'QA Food menu and outlet must belong to the same organization.';
  end if;

  return new;
end;
$$;


drop trigger if exists qa_food_menu_outlets_org_guard
on public.qa_food_menu_outlets;

create trigger qa_food_menu_outlets_org_guard
before insert or update
on public.qa_food_menu_outlets
for each row
execute function public.validate_qa_food_menu_outlet_org();


-- ============================================================
-- 4. QA SESSION
-- ============================================================

create table if not exists public.qa_food_sessions (
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

  business_date date
    not null,

  status text
    not null
    default 'OPEN',

  target_menu_count integer
    not null
    default 10,

  result_status text,

  created_by uuid
    not null
    references auth.users(id)
    on delete restrict,

  auditor_name_snapshot text
    not null,

  started_at timestamptz
    not null
    default now(),

  finalized_at timestamptz,

  cancelled_at timestamptz,

  cancellation_reason text,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint qa_food_sessions_status_chk
    check (
      status in (
        'OPEN',
        'FINALIZED',
        'CANCELLED'
      )
    ),

  constraint qa_food_sessions_target_chk
    check (
      target_menu_count between 1 and 50
    ),

  constraint qa_food_sessions_result_chk
    check (
      result_status is null
      or result_status in (
        'PASS',
        'NEEDS_CORRECTION'
      )
    ),

  constraint qa_food_sessions_auditor_name_chk
    check (
      btrim(auditor_name_snapshot) <> ''
    )
);


create index if not exists qa_food_sessions_outlet_date_idx
on public.qa_food_sessions (
  outlet_id,
  business_date desc,
  created_at desc
);


create index if not exists qa_food_sessions_open_idx
on public.qa_food_sessions (
  outlet_id,
  status
)
where status = 'OPEN';


create index if not exists qa_food_sessions_created_by_idx
on public.qa_food_sessions (
  created_by,
  created_at desc
);


drop trigger if exists qa_food_sessions_set_updated_at
on public.qa_food_sessions;

create trigger qa_food_sessions_set_updated_at
before update
on public.qa_food_sessions
for each row
execute function public.set_updated_at();


-- ============================================================
-- 5. QA SESSION ITEM
--
-- One row = one ordered/tested menu.
-- round_no allows:
--   Round 1 = 3 menus
--   Round 2 = 2 menus
--   Round 3 = 3 menus
--   Round 4 = 2 menus
-- ============================================================

create table if not exists public.qa_food_session_items (
  id uuid
    primary key
    default gen_random_uuid(),

  session_id uuid
    not null
    references public.qa_food_sessions(id)
    on delete cascade,

  menu_id uuid
    not null
    references public.qa_food_menus(id)
    on delete restrict,

  round_no integer
    not null
    default 1,

  sequence_no integer
    not null,

  state text
    not null
    default 'SELECTED',

  menu_name_snapshot text
    not null,

  category_snapshot text,

  service_standard_seconds integer
    not null
    default 780,

  selected_at timestamptz
    not null
    default now(),

  started_at timestamptz,

  served_at timestamptz,

  service_seconds integer,

  service_status text,

  void_reason text,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint qa_food_session_items_session_menu_key
    unique (
      session_id,
      menu_id
    ),

  constraint qa_food_session_items_sequence_key
    unique (
      session_id,
      sequence_no
    ),

  constraint qa_food_session_items_round_chk
    check (
      round_no >= 1
    ),

  constraint qa_food_session_items_sequence_chk
    check (
      sequence_no >= 1
    ),

  constraint qa_food_session_items_state_chk
    check (
      state in (
        'SELECTED',
        'RUNNING',
        'SERVED',
        'ASSESSED',
        'VOIDED'
      )
    ),

  constraint qa_food_session_items_service_standard_chk
    check (
      service_standard_seconds > 0
      and service_standard_seconds <= 7200
    ),

  constraint qa_food_session_items_service_seconds_chk
    check (
      service_seconds is null
      or service_seconds >= 0
    ),

  constraint qa_food_session_items_service_status_chk
    check (
      service_status is null
      or service_status in (
        'STANDARD',
        'LATE'
      )
    ),

  constraint qa_food_session_items_timer_chk
    check (
      served_at is null
      or (
        started_at is not null
        and served_at >= started_at
      )
    ),

  constraint qa_food_session_items_void_reason_chk
    check (
      state <> 'VOIDED'
      or nullif(
        btrim(
          coalesce(
            void_reason,
            ''
          )
        ),
        ''
      ) is not null
    )
);


create index if not exists qa_food_session_items_session_idx
on public.qa_food_session_items (
  session_id,
  state,
  sequence_no
);


create index if not exists qa_food_session_items_running_idx
on public.qa_food_session_items (
  session_id,
  started_at
)
where state = 'RUNNING';


drop trigger if exists qa_food_session_items_set_updated_at
on public.qa_food_session_items;

create trigger qa_food_session_items_set_updated_at
before update
on public.qa_food_session_items
for each row
execute function public.set_updated_at();


-- ============================================================
-- 6. SESSION ITEM SCOPE + SNAPSHOT
-- ============================================================

create or replace function
public.prepare_qa_food_session_item()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_org uuid;
  v_session_outlet uuid;
  v_session_status text;

  v_menu_org uuid;
  v_menu_name text;
  v_menu_category text;
  v_menu_active boolean;
  v_menu_default_seconds integer;

  v_mapping_active boolean;
  v_mapping_eligible boolean;
  v_mapping_seconds integer;
begin
  select
    s.organization_id,
    s.outlet_id,
    s.status
  into
    v_session_org,
    v_session_outlet,
    v_session_status
  from public.qa_food_sessions s
  where s.id = new.session_id;

  if v_session_org is null then
    raise exception
      'QA Food session was not found.';
  end if;

  if tg_op = 'INSERT'
     and v_session_status <> 'OPEN' then
    raise exception
      'Menus can only be added to an open QA Food session.';
  end if;

  select
    m.organization_id,
    m.name,
    m.category,
    m.is_active,
    m.default_service_standard_seconds
  into
    v_menu_org,
    v_menu_name,
    v_menu_category,
    v_menu_active,
    v_menu_default_seconds
  from public.qa_food_menus m
  where m.id = new.menu_id;

  if v_menu_org is null
     or v_menu_org is distinct from v_session_org then
    raise exception
      'QA Food menu organization mismatch.';
  end if;

  if not coalesce(
    v_menu_active,
    false
  ) then
    raise exception
      'QA Food menu is inactive.';
  end if;

  select
    qmo.is_active,
    qmo.qa_eligible,
    qmo.service_standard_seconds
  into
    v_mapping_active,
    v_mapping_eligible,
    v_mapping_seconds
  from public.qa_food_menu_outlets qmo
  where qmo.menu_id = new.menu_id
    and qmo.outlet_id = v_session_outlet;

  if not coalesce(
    v_mapping_active,
    false
  ) then
    raise exception
      'QA Food menu is not active for this outlet.';
  end if;

  if not coalesce(
    v_mapping_eligible,
    false
  ) then
    raise exception
      'QA Food menu is not eligible for QA testing.';
  end if;

  if tg_op = 'INSERT' then
    new.menu_name_snapshot :=
      v_menu_name;

    new.category_snapshot :=
      v_menu_category;

    new.service_standard_seconds :=
      coalesce(
        v_mapping_seconds,
        v_menu_default_seconds,
        780
      );
  end if;

  return new;
end;
$$;


drop trigger if exists qa_food_session_items_prepare
on public.qa_food_session_items;

create trigger qa_food_session_items_prepare
before insert or update of
  session_id,
  menu_id
on public.qa_food_session_items
for each row
execute function public.prepare_qa_food_session_item();


-- ============================================================
-- 7. TIMER CALCULATION
-- ============================================================

create or replace function
public.calculate_qa_food_service_time()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.served_at is not null then
    if new.started_at is null then
      raise exception
        'QA Food timer must be started before Mark Served.';
    end if;

    if new.served_at < new.started_at then
      raise exception
        'Served time cannot be earlier than start time.';
    end if;

    new.service_seconds :=
      floor(
        extract(
          epoch
          from (
            new.served_at -
            new.started_at
          )
        )
      )::integer;

    new.service_status :=
      case
        when new.service_seconds
          <= new.service_standard_seconds
          then 'STANDARD'
        else 'LATE'
      end;

    if new.state = 'RUNNING'
       or new.state = 'SELECTED' then
      new.state :=
        'SERVED';
    end if;

  elsif new.served_at is null then
    new.service_seconds :=
      null;

    new.service_status :=
      null;
  end if;

  return new;
end;
$$;


drop trigger if exists qa_food_session_items_service_timer
on public.qa_food_session_items;

create trigger qa_food_session_items_service_timer
before insert or update of
  started_at,
  served_at,
  service_standard_seconds
on public.qa_food_session_items
for each row
execute function public.calculate_qa_food_service_time();


-- ============================================================
-- 8. FOOD QUALITY ASSESSMENT
--
-- Original Form Quality Standard Assessment:
--   1. Service Time        -> automated
--   2. Visual
--   3. Serving Method
--   4. Plating / Garnish
--   5. Aroma
--   6. Ingredients
--   7. Portion
--   8. Temperature
--   9. Taste
--  10. Texture
--
-- Service Time is stored on qa_food_session_items.
-- Remaining 9 criteria are stored here.
-- ============================================================

create table if not exists public.qa_food_assessments (
  id uuid
    primary key
    default gen_random_uuid(),

  item_id uuid
    not null
    unique
    references public.qa_food_session_items(id)
    on delete cascade,

  visual_status text
    not null,

  serving_method_status text
    not null,

  plating_status text
    not null,

  aroma_status text
    not null,

  ingredients_status text
    not null,

  portion_status text
    not null,

  temperature_status text
    not null,

  taste_status text
    not null,

  texture_status text
    not null,

  weight_grams numeric(10,2),

  serving_temperature_c numeric(6,2),

  notes text,

  result_status text
    not null,

  assessed_by uuid
    not null
    references auth.users(id)
    on delete restrict,

  assessed_at timestamptz
    not null
    default now(),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint qa_food_assessments_visual_chk
    check (
      visual_status in (
        'STANDARD',
        'NOT_STANDARD'
      )
    ),

  constraint qa_food_assessments_serving_method_chk
    check (
      serving_method_status in (
        'STANDARD',
        'NOT_STANDARD'
      )
    ),

  constraint qa_food_assessments_plating_chk
    check (
      plating_status in (
        'STANDARD',
        'NOT_STANDARD'
      )
    ),

  constraint qa_food_assessments_aroma_chk
    check (
      aroma_status in (
        'STANDARD',
        'NOT_STANDARD'
      )
    ),

  constraint qa_food_assessments_ingredients_chk
    check (
      ingredients_status in (
        'STANDARD',
        'NOT_STANDARD'
      )
    ),

  constraint qa_food_assessments_portion_chk
    check (
      portion_status in (
        'STANDARD',
        'NOT_STANDARD'
      )
    ),

  constraint qa_food_assessments_temperature_chk
    check (
      temperature_status in (
        'STANDARD',
        'NOT_STANDARD'
      )
    ),

  constraint qa_food_assessments_taste_chk
    check (
      taste_status in (
        'STANDARD',
        'NOT_STANDARD'
      )
    ),

  constraint qa_food_assessments_texture_chk
    check (
      texture_status in (
        'STANDARD',
        'NOT_STANDARD'
      )
    ),

  constraint qa_food_assessments_result_chk
    check (
      result_status in (
        'PASS',
        'NEEDS_CORRECTION'
      )
    ),

  constraint qa_food_assessments_weight_chk
    check (
      weight_grams is null
      or weight_grams >= 0
    ),

  constraint qa_food_assessments_temperature_value_chk
    check (
      serving_temperature_c is null
      or serving_temperature_c between -20 and 150
    )
);


drop trigger if exists qa_food_assessments_set_updated_at
on public.qa_food_assessments;

create trigger qa_food_assessments_set_updated_at
before update
on public.qa_food_assessments
for each row
execute function public.set_updated_at();


-- ============================================================
-- 9. ASSESSMENT AUTO RESULT
-- ============================================================

create or replace function
public.prepare_qa_food_assessment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_service_status text;
begin
  select
    i.service_status
  into
    v_service_status
  from public.qa_food_session_items i
  where i.id = new.item_id;

  if v_service_status is null then
    raise exception
      'Mark Served before completing the QA Food assessment.';
  end if;

  if (
    new.visual_status = 'NOT_STANDARD'
    or new.serving_method_status = 'NOT_STANDARD'
    or new.plating_status = 'NOT_STANDARD'
    or new.aroma_status = 'NOT_STANDARD'
    or new.ingredients_status = 'NOT_STANDARD'
    or new.portion_status = 'NOT_STANDARD'
    or new.temperature_status = 'NOT_STANDARD'
    or new.taste_status = 'NOT_STANDARD'
    or new.texture_status = 'NOT_STANDARD'
  )
  and nullif(
    btrim(
      coalesce(
        new.notes,
        ''
      )
    ),
    ''
  ) is null then
    raise exception
      'Notes are required when a food quality criterion is Not Standard.';
  end if;

  new.result_status :=
    case
      when v_service_status = 'LATE'
        or new.visual_status = 'NOT_STANDARD'
        or new.serving_method_status = 'NOT_STANDARD'
        or new.plating_status = 'NOT_STANDARD'
        or new.aroma_status = 'NOT_STANDARD'
        or new.ingredients_status = 'NOT_STANDARD'
        or new.portion_status = 'NOT_STANDARD'
        or new.temperature_status = 'NOT_STANDARD'
        or new.taste_status = 'NOT_STANDARD'
        or new.texture_status = 'NOT_STANDARD'
      then 'NEEDS_CORRECTION'
      else 'PASS'
    end;

  return new;
end;
$$;


drop trigger if exists qa_food_assessments_prepare
on public.qa_food_assessments;

create trigger qa_food_assessments_prepare
before insert or update
on public.qa_food_assessments
for each row
execute function public.prepare_qa_food_assessment();


create or replace function
public.mark_qa_food_item_assessed()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.qa_food_session_items
  set
    state = 'ASSESSED',
    updated_at = now()
  where id = new.item_id
    and state <> 'VOIDED';

  return new;
end;
$$;


drop trigger if exists qa_food_assessments_mark_item
on public.qa_food_assessments;

create trigger qa_food_assessments_mark_item
after insert or update
on public.qa_food_assessments
for each row
execute function public.mark_qa_food_item_assessed();


-- ============================================================
-- 10. PHOTO EVIDENCE
-- ============================================================

create table if not exists public.qa_food_evidence (
  id uuid
    primary key
    default gen_random_uuid(),

  item_id uuid
    not null
    references public.qa_food_session_items(id)
    on delete cascade,

  storage_bucket text
    not null,

  storage_path text
    not null,

  caption text,

  captured_by uuid
    not null
    references auth.users(id)
    on delete restrict,

  created_at timestamptz
    not null
    default now(),

  constraint qa_food_evidence_bucket_chk
    check (
      btrim(storage_bucket) <> ''
    ),

  constraint qa_food_evidence_path_chk
    check (
      btrim(storage_path) <> ''
    )
);


create index if not exists qa_food_evidence_item_idx
on public.qa_food_evidence (
  item_id,
  created_at
);


-- ============================================================
-- 11. EVENT / AUDIT LOG
-- ============================================================

create table if not exists public.qa_food_events (
  id uuid
    primary key
    default gen_random_uuid(),

  session_id uuid
    not null
    references public.qa_food_sessions(id)
    on delete cascade,

  item_id uuid
    references public.qa_food_session_items(id)
    on delete cascade,

  event_type text
    not null,

  actor_user_id uuid
    references auth.users(id)
    on delete set null,

  payload jsonb
    not null
    default '{}'::jsonb,

  created_at timestamptz
    not null
    default now(),

  constraint qa_food_events_event_type_chk
    check (
      btrim(event_type) <> ''
    )
);


create index if not exists qa_food_events_session_idx
on public.qa_food_events (
  session_id,
  created_at
);


-- ============================================================
-- 12. RLS
--
-- Runtime will use protected server routes + service role.
-- No direct browser writes.
-- ============================================================

alter table public.qa_food_menus
  enable row level security;

alter table public.qa_food_menu_outlets
  enable row level security;

alter table public.qa_food_sessions
  enable row level security;

alter table public.qa_food_session_items
  enable row level security;

alter table public.qa_food_assessments
  enable row level security;

alter table public.qa_food_evidence
  enable row level security;

alter table public.qa_food_events
  enable row level security;


revoke all
on table public.qa_food_menus
from public, anon, authenticated;

revoke all
on table public.qa_food_menu_outlets
from public, anon, authenticated;

revoke all
on table public.qa_food_sessions
from public, anon, authenticated;

revoke all
on table public.qa_food_session_items
from public, anon, authenticated;

revoke all
on table public.qa_food_assessments
from public, anon, authenticated;

revoke all
on table public.qa_food_evidence
from public, anon, authenticated;

revoke all
on table public.qa_food_events
from public, anon, authenticated;


grant select, insert, update, delete
on table public.qa_food_menus
to service_role;

grant select, insert, update, delete
on table public.qa_food_menu_outlets
to service_role;

grant select, insert, update, delete
on table public.qa_food_sessions
to service_role;

grant select, insert, update, delete
on table public.qa_food_session_items
to service_role;

grant select, insert, update, delete
on table public.qa_food_assessments
to service_role;

grant select, insert, update, delete
on table public.qa_food_evidence
to service_role;

grant select, insert, update, delete
on table public.qa_food_events
to service_role;


-- Functions execute only through trusted runtime / triggers.

revoke all
on function public.validate_qa_food_menu_outlet_org()
from public, anon, authenticated;

revoke all
on function public.prepare_qa_food_session_item()
from public, anon, authenticated;

revoke all
on function public.calculate_qa_food_service_time()
from public, anon, authenticated;

revoke all
on function public.prepare_qa_food_assessment()
from public, anon, authenticated;

revoke all
on function public.mark_qa_food_item_assessed()
from public, anon, authenticated;


-- ============================================================
-- 13. FOUNDATION VALIDATION
-- ============================================================

do $$
begin
  if not exists (
    select 1
    from pg_class
    where relname = 'qa_food_sessions'
  ) then
    raise exception
      'QA FOOD FOUNDATION STOP: qa_food_sessions was not created.';
  end if;

  if not exists (
    select 1
    from pg_class
    where relname = 'qa_food_session_items'
  ) then
    raise exception
      'QA FOOD FOUNDATION STOP: qa_food_session_items was not created.';
  end if;

  if not exists (
    select 1
    from pg_class
    where relname = 'qa_food_assessments'
  ) then
    raise exception
      'QA FOOD FOUNDATION STOP: qa_food_assessments was not created.';
  end if;
end;
$$;


commit;
