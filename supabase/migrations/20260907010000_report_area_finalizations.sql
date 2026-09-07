-- ============================================================
-- CK AREA LEADER + FINALIZATION ARCHITECTURE
-- ============================================================
--
-- Central Kitchen Closing:
--
-- STORE
--   Leader: Muzza
--   Sections:
--     - MAIN_WAREHOUSE
--     - SECONDARY_WAREHOUSE
--
-- PRODUCTION
--   Leader: Wahyu
--   Sections:
--     - BEVERAGE
--     - BUTCHER
--     - STEWARD
--     - PREMIX
--     - COLD_KITCHEN
--     - HOT_KITCHEN
--     - HDS
--
-- A report area is considered FINALIZED when a row exists in
-- report_area_finalizations.
--
-- Section submission alone does NOT finalize the area.
-- ============================================================


-- ============================================================
-- 1. FORM AREA LEADERS
-- ============================================================

create table if not exists public.form_area_leaders (
  id uuid primary key default gen_random_uuid(),

  outlet_id uuid not null
    references public.outlets(id)
    on delete cascade,

  form_id uuid not null
    references public.forms(id)
    on delete cascade,

  area_code text not null
    check (
      area_code in (
        'STORE',
        'PRODUCTION'
      )
    ),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint form_area_leaders_outlet_form_area_key
    unique (
      outlet_id,
      form_id,
      area_code
    )
);


create index if not exists
  form_area_leaders_user_id_idx
on public.form_area_leaders (
  user_id
);


create index if not exists
  form_area_leaders_form_id_idx
on public.form_area_leaders (
  form_id
);


-- ============================================================
-- 2. RLS — FORM AREA LEADERS
-- ============================================================

alter table public.form_area_leaders
  enable row level security;


drop policy if exists
  "form_area_leaders_select_own"
on public.form_area_leaders;


create policy
  "form_area_leaders_select_own"
on public.form_area_leaders
for select
to authenticated
using (
  user_id = auth.uid()
);


-- No direct INSERT / UPDATE / DELETE policies.
-- Leader assignment mutations must happen through trusted
-- server/admin flows.


-- ============================================================
-- 3. REPORT AREA FINALIZATIONS
-- ============================================================

create table if not exists public.report_area_finalizations (
  id uuid primary key default gen_random_uuid(),

  report_id uuid not null
    references public.reports(id)
    on delete cascade,

  area_code text not null
    check (
      area_code in (
        'STORE',
        'PRODUCTION'
      )
    ),

  leader_user_id uuid not null
    references auth.users(id)
    on delete restrict,

  -- Snapshot of leader name at finalization time.
  leader_name text not null,

  finalized_at timestamptz not null
    default now(),

  pdf_storage_path text,

  pdf_generated_at timestamptz,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint report_area_finalizations_report_area_key
    unique (
      report_id,
      area_code
    )
);


create index if not exists
  report_area_finalizations_report_id_idx
on public.report_area_finalizations (
  report_id
);


create index if not exists
  report_area_finalizations_leader_user_id_idx
on public.report_area_finalizations (
  leader_user_id
);


-- ============================================================
-- 4. RLS — REPORT AREA FINALIZATIONS
-- ============================================================

alter table public.report_area_finalizations
  enable row level security;


drop policy if exists
  "report_area_finalizations_select_own"
on public.report_area_finalizations;


create policy
  "report_area_finalizations_select_own"
on public.report_area_finalizations
for select
to authenticated
using (
  leader_user_id = auth.uid()
);


-- No direct INSERT / UPDATE / DELETE policies.
-- Finalization must go through a trusted server endpoint that
-- verifies:
--
--   1. current user is the configured area leader
--   2. all required area sections are submitted/reviewed
--   3. area has not already been finalized unexpectedly
--
-- Server/admin client performs the mutation.


-- ============================================================
-- 5. SEED CENTRAL KITCHEN CLOSING AREA LEADERS
-- ============================================================

do $$
declare
  v_outlet_id uuid;
  v_form_id uuid;

  v_muzza_id uuid;
  v_wahyu_id uuid;
begin

  -- ----------------------------------------------------------
  -- Resolve CQ Central + Closing CK
  -- ----------------------------------------------------------

  select
    o.id,
    f.id
  into
    v_outlet_id,
    v_form_id
  from public.outlets o
  join public.forms f
    on f.organization_id = o.organization_id
  where
    o.code = 'CNT'
    and o.is_active is distinct from false
    and f.code = 'CLOSING_CK'
    and f.is_active is distinct from false
  limit 1;


  if v_outlet_id is null then
    raise exception
      'Area leader migration failed: active CNT outlet not found';
  end if;


  if v_form_id is null then
    raise exception
      'Area leader migration failed: active CLOSING_CK form not found';
  end if;


  -- ----------------------------------------------------------
  -- Resolve Muzza
  -- ----------------------------------------------------------

  select id
  into v_muzza_id
  from auth.users
  where lower(email) = 'muzza@store.id'
  limit 1;


  if v_muzza_id is null then
    raise exception
      'Area leader migration failed: muzza@store.id not found';
  end if;


  -- ----------------------------------------------------------
  -- Resolve Wahyu
  -- ----------------------------------------------------------

  select id
  into v_wahyu_id
  from auth.users
  where lower(email) = 'wahyu@production.id'
  limit 1;


  if v_wahyu_id is null then
    raise exception
      'Area leader migration failed: wahyu@production.id not found';
  end if;


  -- ----------------------------------------------------------
  -- STORE → Muzza
  -- ----------------------------------------------------------

  insert into public.form_area_leaders (
    outlet_id,
    form_id,
    area_code,
    user_id
  )
  values (
    v_outlet_id,
    v_form_id,
    'STORE',
    v_muzza_id
  )
  on conflict (
    outlet_id,
    form_id,
    area_code
  )
  do update set
    user_id = excluded.user_id,
    updated_at = now();


  -- ----------------------------------------------------------
  -- PRODUCTION → Wahyu
  -- ----------------------------------------------------------

  insert into public.form_area_leaders (
    outlet_id,
    form_id,
    area_code,
    user_id
  )
  values (
    v_outlet_id,
    v_form_id,
    'PRODUCTION',
    v_wahyu_id
  )
  on conflict (
    outlet_id,
    form_id,
    area_code
  )
  do update set
    user_id = excluded.user_id,
    updated_at = now();

end
$$;
