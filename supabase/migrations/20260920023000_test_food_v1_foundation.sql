begin;

-- ============================================================
-- TEST FOOD V1 — FOUNDATION
--
-- Runtime concept:
--   Internal Restaurant PIC
--   Shift: PAGI / SORE
--
-- Per selected menu:
--   Expiry Date
--   Warna
--   Rasa
--   Tekstur
--
-- Standard values:
--   STANDARD
--   NOT_STANDARD
--
-- Initial result:
--   PASS
--   NEEDS_CORRECTION
--
-- Re-test infrastructure is created now, but only appears in UI
-- when a menu needs correction.
--
-- No dashboard / UI / exception integration in this migration.
-- ============================================================


-- ============================================================
-- 0. TARGET RESTAURANT OUTLETS
-- ============================================================

create temporary table tf_target_outlets (
  outlet_code text primary key
) on commit drop;

insert into tf_target_outlets values
  ('BDG'),
  ('CGU'),
  ('GS'),
  ('HT'),
  ('MOI'),
  ('PIM'),
  ('PL'),
  ('PP'),
  ('SMY'),
  ('SP'),
  ('TBZ');


create temporary table tf_context (
  organization_id uuid primary key
) on commit drop;


do $$
declare
  v_count integer;
  v_org_count integer;
  v_org_id uuid;
begin
  select
    count(*),
    count(distinct o.organization_id)
  into
    v_count,
    v_org_count
  from tf_target_outlets t
  join public.outlets o
    on upper(o.code) = t.outlet_code
   and o.is_active = true;

  if v_count <> 11 then
    raise exception
      'TEST FOOD STOP: expected 11 active restaurant outlets, found %.',
      v_count;
  end if;

  if v_org_count <> 1 then
    raise exception
      'TEST FOOD STOP: target outlets must belong to exactly one organization.';
  end if;

  select o.organization_id
    into v_org_id
  from tf_target_outlets t
  join public.outlets o
    on upper(o.code) = t.outlet_code
   and o.is_active = true
  order by o.code
  limit 1;

  if v_org_id is null then
    raise exception
      'TEST FOOD STOP: organization could not be resolved.';
  end if;

  if exists (
    select 1
    from tf_target_outlets
    where outlet_code = 'CNT'
  ) then
    raise exception
      'TEST FOOD STOP: Central Kitchen must not be included.';
  end if;

  insert into tf_context (
    organization_id
  )
  values (
    v_org_id
  );
end;
$$;


-- ============================================================
-- 1. TEST FOOD MENU MASTER
-- ============================================================

create table public.test_food_menus (
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

  category text
    not null,

  notes text,

  is_seasonal boolean
    not null
    default false,

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

  constraint test_food_menus_org_code_key
    unique (
      organization_id,
      code
    ),

  constraint test_food_menus_code_chk
    check (
      code ~ '^[A-Z][A-Z0-9_]*$'
    ),

  constraint test_food_menus_name_chk
    check (
      btrim(name) <> ''
    )
);


create index test_food_menus_org_active_idx
on public.test_food_menus (
  organization_id,
  is_active,
  sort_order
);


create trigger test_food_menus_set_updated_at
before update
on public.test_food_menus
for each row
execute function public.set_updated_at();


-- ============================================================
-- 2. MENU ↔ OUTLET APPLICABILITY
-- ============================================================

create table public.test_food_menu_outlets (
  id uuid
    primary key
    default gen_random_uuid(),

  menu_id uuid
    not null
    references public.test_food_menus(id)
    on delete cascade,

  outlet_id uuid
    not null
    references public.outlets(id)
    on delete restrict,

  is_active boolean
    not null
    default true,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint test_food_menu_outlets_key
    unique (
      menu_id,
      outlet_id
    )
);


create index test_food_menu_outlets_outlet_idx
on public.test_food_menu_outlets (
  outlet_id,
  is_active
);


create trigger test_food_menu_outlets_set_updated_at
before update
on public.test_food_menu_outlets
for each row
execute function public.set_updated_at();


-- ============================================================
-- 3. MENU/OUTLET ORGANIZATION GUARD
-- ============================================================

create or replace function
public.validate_test_food_menu_outlet_org()
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
  from public.test_food_menus
  where id = new.menu_id;

  select organization_id
    into v_outlet_org
  from public.outlets
  where id = new.outlet_id;

  if v_menu_org is null
     or v_outlet_org is null
     or v_menu_org is distinct from v_outlet_org then
    raise exception
      'Test Food menu and outlet must belong to the same organization.';
  end if;

  return new;
end;
$$;


create trigger test_food_menu_outlets_org_guard
before insert or update
on public.test_food_menu_outlets
for each row
execute function public.validate_test_food_menu_outlet_org();


-- ============================================================
-- 4. TEST FOOD SESSION
-- ============================================================

create table public.test_food_sessions (
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

  shift text
    not null
    check (
      shift in (
        'PAGI',
        'SORE'
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

  result_status text
    check (
      result_status is null
      or result_status in (
        'PASS',
        'NEEDS_CORRECTION'
      )
    ),

  created_by uuid
    not null
    references auth.users(id)
    on delete restrict,

  pic_name_snapshot text
    not null,

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

  constraint test_food_sessions_outlet_date_shift_key
    unique (
      outlet_id,
      business_date,
      shift
    ),

  constraint test_food_sessions_pic_name_chk
    check (
      btrim(pic_name_snapshot) <> ''
    )
);


create index test_food_sessions_outlet_date_idx
on public.test_food_sessions (
  outlet_id,
  business_date desc,
  shift
);


create index test_food_sessions_created_by_idx
on public.test_food_sessions (
  created_by,
  business_date desc
);


create trigger test_food_sessions_set_updated_at
before update
on public.test_food_sessions
for each row
execute function public.set_updated_at();


-- ============================================================
-- 5. TEST FOOD CHECK
-- ============================================================

create table public.test_food_checks (
  id uuid
    primary key
    default gen_random_uuid(),

  session_id uuid
    not null
    references public.test_food_sessions(id)
    on delete cascade,

  menu_id uuid
    not null
    references public.test_food_menus(id)
    on delete restrict,

  expiry_date date,

  color_status text
    check (
      color_status is null
      or color_status in (
        'STANDARD',
        'NOT_STANDARD'
      )
    ),

  taste_status text
    check (
      taste_status is null
      or taste_status in (
        'STANDARD',
        'NOT_STANDARD'
      )
    ),

  texture_status text
    check (
      texture_status is null
      or texture_status in (
        'STANDARD',
        'NOT_STANDARD'
      )
    ),

  notes text,

  result_status text
    generated always as (
      case
        when expiry_date is null
          or color_status is null
          or taste_status is null
          or texture_status is null
        then null

        when color_status = 'NOT_STANDARD'
          or taste_status = 'NOT_STANDARD'
          or texture_status = 'NOT_STANDARD'
        then 'NEEDS_CORRECTION'

        else 'PASS'
      end
    ) stored,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint test_food_checks_session_menu_key
    unique (
      session_id,
      menu_id
    )
);


create index test_food_checks_session_idx
on public.test_food_checks (
  session_id
);


create trigger test_food_checks_set_updated_at
before update
on public.test_food_checks
for each row
execute function public.set_updated_at();


-- ============================================================
-- 6. CHECK APPLICABILITY GUARD
--
-- Prevent Mushroom Soup or any future outlet-specific menu from
-- being inserted into a session for an unsupported outlet.
-- ============================================================

create or replace function
public.validate_test_food_check_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_outlet_id uuid;
  v_session_org uuid;
  v_menu_org uuid;
begin
  select
    s.outlet_id,
    s.organization_id
  into
    v_outlet_id,
    v_session_org
  from public.test_food_sessions s
  where s.id = new.session_id;

  if v_outlet_id is null then
    raise exception
      'Test Food session was not found.';
  end if;

  select m.organization_id
    into v_menu_org
  from public.test_food_menus m
  where m.id = new.menu_id
    and m.is_active = true;

  if v_menu_org is null then
    raise exception
      'Active Test Food menu was not found.';
  end if;

  if v_session_org is distinct from v_menu_org then
    raise exception
      'Test Food session and menu organization mismatch.';
  end if;

  if not exists (
    select 1
    from public.test_food_menu_outlets tmo
    where tmo.menu_id = new.menu_id
      and tmo.outlet_id = v_outlet_id
      and tmo.is_active = true
  ) then
    raise exception
      'Test Food menu is not applicable to this outlet.';
  end if;

  return new;
end;
$$;


create trigger test_food_checks_scope_guard
before insert or update
on public.test_food_checks
for each row
execute function public.validate_test_food_check_scope();


-- ============================================================
-- 7. OPTIONAL RE-TEST
--
-- Only used when initial result = NEEDS_CORRECTION.
-- Multiple attempts are supported without changing V1 UI.
-- ============================================================

create table public.test_food_retests (
  id uuid
    primary key
    default gen_random_uuid(),

  check_id uuid
    not null
    references public.test_food_checks(id)
    on delete cascade,

  attempt_no integer
    not null
    default 1
    check (
      attempt_no > 0
    ),

  correction_note text
    not null,

  color_status text
    not null
    check (
      color_status in (
        'STANDARD',
        'NOT_STANDARD'
      )
    ),

  taste_status text
    not null
    check (
      taste_status in (
        'STANDARD',
        'NOT_STANDARD'
      )
    ),

  texture_status text
    not null
    check (
      texture_status in (
        'STANDARD',
        'NOT_STANDARD'
      )
    ),

  notes text,

  result_status text
    generated always as (
      case
        when color_status = 'NOT_STANDARD'
          or taste_status = 'NOT_STANDARD'
          or texture_status = 'NOT_STANDARD'
        then 'NEEDS_CORRECTION'

        else 'PASS'
      end
    ) stored,

  tested_by uuid
    not null
    references auth.users(id)
    on delete restrict,

  tested_at timestamptz
    not null
    default now(),

  created_at timestamptz
    not null
    default now(),

  constraint test_food_retests_check_attempt_key
    unique (
      check_id,
      attempt_no
    ),

  constraint test_food_retests_correction_note_chk
    check (
      btrim(correction_note) <> ''
    )
);


create index test_food_retests_check_idx
on public.test_food_retests (
  check_id,
  attempt_no
);


-- ============================================================
-- 8. SESSION ORGANIZATION GUARD
-- ============================================================

create or replace function
public.validate_test_food_session_org()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_outlet_org uuid;
begin
  select o.organization_id
    into v_outlet_org
  from public.outlets o
  where o.id = new.outlet_id
    and o.is_active = true;

  if v_outlet_org is null then
    raise exception
      'Active Test Food outlet was not found.';
  end if;

  if v_outlet_org is distinct from new.organization_id then
    raise exception
      'Test Food session organization mismatch.';
  end if;

  if exists (
    select 1
    from public.outlets o
    where o.id = new.outlet_id
      and upper(o.code) = 'CNT'
  ) then
    raise exception
      'Central Kitchen is not a Test Food restaurant outlet.';
  end if;

  return new;
end;
$$;


create trigger test_food_sessions_org_guard
before insert or update
on public.test_food_sessions
for each row
execute function public.validate_test_food_session_org();


-- ============================================================
-- 9. SEED MENU MASTER
-- ============================================================

create temporary table tf_menu_seed (
  code text primary key,
  name text not null,
  category text not null,
  notes text,
  is_seasonal boolean not null,
  sort_order integer not null,
  is_active boolean not null
) on commit drop;


insert into tf_menu_seed values
  (
    'SOUP_CHICKEN_BONE_BROTH',
    '8 Hours Chicken Bone Broth',
    'SOUP',
    null,
    false,
    10,
    true
  ),
  (
    'SOUP_MALA',
    'Mala Soup',
    'SOUP',
    null,
    false,
    20,
    true
  ),
  (
    'SOUP_CRAB',
    'Crab Soup',
    'SOUP',
    'Seasonal availability.',
    true,
    30,
    true
  ),
  (
    'SOUP_PRAWN',
    'Prawn Soup',
    'SOUP',
    null,
    false,
    40,
    true
  ),
  (
    'SOUP_LAKSA',
    'Laksa Soup',
    'SOUP',
    null,
    false,
    50,
    true
  ),
  (
    'SOUP_CREAMY_MALA',
    'Creamy Mala Soup',
    'SOUP',
    null,
    false,
    60,
    true
  ),
  (
    'SOUP_VEGETABLES',
    'Vegetables Soup',
    'SOUP',
    null,
    false,
    70,
    true
  ),
  (
    'SOUP_MUSHROOM',
    'Mushroom Soup',
    'SOUP',
    'Bali outlets only.',
    false,
    80,
    true
  ),
  (
    'SOUP_CREAMY_FISH',
    'Creamy Fish Soup',
    'SOUP',
    'Inactive.',
    false,
    90,
    false
  ),
  (
    'SILK_TOFU',
    'Silk Tofu',
    'TOFU',
    null,
    false,
    100,
    true
  ),
  (
    'TAHU_LAKSA',
    'Tahu Laksa',
    'TOFU',
    null,
    false,
    110,
    true
  ),
  (
    'WHITE_RICE',
    'White Rice',
    'RICE',
    null,
    false,
    120,
    true
  ),
  (
    'FRIED_RICE',
    'Fried Rice',
    'RICE',
    null,
    false,
    130,
    true
  ),
  (
    'CHEESY_CHICKEN_BALL',
    'Cheesy Chicken Ball',
    'BALL',
    null,
    false,
    140,
    true
  ),
  (
    'FUZHOU_FISH_BALL',
    'Fuzhou Fish Ball',
    'BALL',
    null,
    false,
    150,
    true
  ),
  (
    'MEATBALL_PLATTER',
    'Meatball Platter',
    'PLATTER',
    'Beef Ball · Fish Ball · Prawn Ball · Chicken Ball',
    false,
    160,
    true
  ),
  (
    'WONTON_PLATTER',
    'Wonton Platter',
    'PLATTER',
    'Prawn Chives Wonton · Prawn Chicken & Salted Egg · Chicken Mushroom & Pocai · Beef Wonton',
    false,
    170,
    true
  );


insert into public.test_food_menus (
  organization_id,
  code,
  name,
  category,
  notes,
  is_seasonal,
  sort_order,
  is_active
)
select
  ctx.organization_id,
  s.code,
  s.name,
  s.category,
  s.notes,
  s.is_seasonal,
  s.sort_order,
  s.is_active
from tf_context ctx
cross join tf_menu_seed s;


-- ============================================================
-- 10. SEED OUTLET APPLICABILITY
--
-- All ACTIVE menus except Mushroom Soup:
--   all 11 restaurant outlets
--
-- Mushroom Soup:
--   DD Canggu + DD Seminyak only
--
-- Creamy Fish Soup:
--   inactive, therefore no outlet mapping
--
-- Pork Soup:
--   discontinued, intentionally not in menu master
-- ============================================================

insert into public.test_food_menu_outlets (
  menu_id,
  outlet_id,
  is_active
)
select
  m.id,
  o.id,
  true
from public.test_food_menus m
join tf_context ctx
  on ctx.organization_id = m.organization_id
cross join tf_target_outlets t
join public.outlets o
  on upper(o.code) = t.outlet_code
 and o.is_active = true
where m.is_active = true
  and m.code <> 'SOUP_MUSHROOM';


insert into public.test_food_menu_outlets (
  menu_id,
  outlet_id,
  is_active
)
select
  m.id,
  o.id,
  true
from public.test_food_menus m
join tf_context ctx
  on ctx.organization_id = m.organization_id
join public.outlets o
  on o.organization_id = ctx.organization_id
 and upper(o.code) in (
   'CGU',
   'SMY'
 )
 and o.is_active = true
where m.code = 'SOUP_MUSHROOM'
  and m.is_active = true;


-- ============================================================
-- 11. DATABASE ACCESS
--
-- V1 runtime will use authenticated server routes which perform
-- explicit user/outlet authorization, then trusted admin reads
-- and writes.
--
-- Raw browser access is intentionally disabled.
-- ============================================================

alter table public.test_food_menus
  enable row level security;

alter table public.test_food_menu_outlets
  enable row level security;

alter table public.test_food_sessions
  enable row level security;

alter table public.test_food_checks
  enable row level security;

alter table public.test_food_retests
  enable row level security;


revoke all
on public.test_food_menus
from public, anon, authenticated;

revoke all
on public.test_food_menu_outlets
from public, anon, authenticated;

revoke all
on public.test_food_sessions
from public, anon, authenticated;

revoke all
on public.test_food_checks
from public, anon, authenticated;

revoke all
on public.test_food_retests
from public, anon, authenticated;


grant select, insert, update, delete
on public.test_food_menus
to service_role;

grant select, insert, update, delete
on public.test_food_menu_outlets
to service_role;

grant select, insert, update, delete
on public.test_food_sessions
to service_role;

grant select, insert, update, delete
on public.test_food_checks
to service_role;

grant select, insert, update, delete
on public.test_food_retests
to service_role;


-- ============================================================
-- 12. POSTCHECK
-- ============================================================

do $$
declare
  v_total_menu integer;
  v_active_menu integer;
  v_scope_rows integer;
  v_mushroom_rows integer;
  v_bad_mushroom integer;
begin
  select count(*)
    into v_total_menu
  from public.test_food_menus m
  join tf_context ctx
    on ctx.organization_id = m.organization_id;

  if v_total_menu <> 17 then
    raise exception
      'TEST FOOD POSTCHECK: expected 17 menu master rows, found %.',
      v_total_menu;
  end if;


  select count(*)
    into v_active_menu
  from public.test_food_menus m
  join tf_context ctx
    on ctx.organization_id = m.organization_id
  where m.is_active = true;

  if v_active_menu <> 16 then
    raise exception
      'TEST FOOD POSTCHECK: expected 16 active menus, found %.',
      v_active_menu;
  end if;


  select count(*)
    into v_scope_rows
  from public.test_food_menu_outlets tmo
  join public.test_food_menus m
    on m.id = tmo.menu_id
  join tf_context ctx
    on ctx.organization_id = m.organization_id
  where tmo.is_active = true;

  if v_scope_rows <> 167 then
    raise exception
      'TEST FOOD POSTCHECK: expected 167 active menu/outlet mappings, found %.',
      v_scope_rows;
  end if;


  select count(*)
    into v_mushroom_rows
  from public.test_food_menu_outlets tmo
  join public.test_food_menus m
    on m.id = tmo.menu_id
  join public.outlets o
    on o.id = tmo.outlet_id
  where m.code = 'SOUP_MUSHROOM'
    and tmo.is_active = true;

  if v_mushroom_rows <> 2 then
    raise exception
      'TEST FOOD POSTCHECK: Mushroom Soup expected exactly 2 outlets, found %.',
      v_mushroom_rows;
  end if;


  select count(*)
    into v_bad_mushroom
  from public.test_food_menu_outlets tmo
  join public.test_food_menus m
    on m.id = tmo.menu_id
  join public.outlets o
    on o.id = tmo.outlet_id
  where m.code = 'SOUP_MUSHROOM'
    and tmo.is_active = true
    and upper(o.code) not in (
      'CGU',
      'SMY'
    );

  if v_bad_mushroom <> 0 then
    raise exception
      'TEST FOOD POSTCHECK: Mushroom Soup mapped outside Bali.';
  end if;


  if exists (
    select 1
    from public.test_food_menus m
    join tf_context ctx
      on ctx.organization_id = m.organization_id
    where upper(m.name) like '%PORK SOUP%'
  ) then
    raise exception
      'TEST FOOD POSTCHECK: discontinued Pork Soup must not exist.';
  end if;


  if not exists (
    select 1
    from public.test_food_menus m
    join tf_context ctx
      on ctx.organization_id = m.organization_id
    where m.code = 'SOUP_CREAMY_FISH'
      and m.is_active = false
  ) then
    raise exception
      'TEST FOOD POSTCHECK: Creamy Fish Soup must be inactive.';
  end if;
end;
$$;


commit;
