begin;

-- ============================================================
-- BRIEFING V1 — FOUNDATION
--
-- Restaurant outlet internal briefing:
--
--   MORNING
--   AFTERNOON
--   CLOSING
--
-- One submission per outlet / business date / session.
--
-- Required:
--   photo
--
-- Optional:
--   title
--   main notes
--   custom sections
--
-- Custom sections JSON:
-- [
--   {
--     "title": "Upselling",
--     "content": "Chicken Mushroom Pocai"
--   },
--   {
--     "title": "Issues",
--     "content": "Food delay..."
--   }
-- ]
--
-- PIC / outlet / timestamps are system generated.
-- ============================================================


-- ============================================================
-- 1. SESSION TABLE
-- ============================================================

create table public.briefing_sessions (
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

  session_type text
    not null
    check (
      session_type in (
        'MORNING',
        'AFTERNOON',
        'CLOSING'
      )
    ),

  title text,

  notes text,

  sections jsonb
    not null
    default '[]'::jsonb,

  photo_storage_path text
    not null,

  photo_original_filename text,

  photo_mime_type text,

  photo_size_bytes bigint
    check (
      photo_size_bytes is null
      or photo_size_bytes >= 0
    ),

  status text
    not null
    default 'SUBMITTED'
    check (
      status in (
        'SUBMITTED'
      )
    ),

  created_by uuid
    not null
    references auth.users(id)
    on delete restrict,

  pic_name_snapshot text
    not null,

  submitted_at timestamptz
    not null
    default now(),

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint briefing_sessions_outlet_date_session_key
    unique (
      outlet_id,
      business_date,
      session_type
    ),

  constraint briefing_sessions_photo_chk
    check (
      btrim(
        photo_storage_path
      ) <> ''
    ),

  constraint briefing_sessions_pic_chk
    check (
      btrim(
        pic_name_snapshot
      ) <> ''
    )
);


create index briefing_sessions_outlet_date_idx
on public.briefing_sessions (
  outlet_id,
  business_date desc,
  session_type
);


create index briefing_sessions_created_by_idx
on public.briefing_sessions (
  created_by,
  business_date desc
);


create index briefing_sessions_org_date_idx
on public.briefing_sessions (
  organization_id,
  business_date desc
);


create trigger briefing_sessions_set_updated_at
before update
on public.briefing_sessions
for each row
execute function public.set_updated_at();


-- ============================================================
-- 2. CUSTOM SECTION VALIDATOR
--
-- Empty array is valid.
--
-- If a custom section exists:
--   title   required
--   content required
--
-- This prevents blank dynamic cards while keeping the entire
-- custom-section feature optional.
-- ============================================================

create or replace function
public.validate_briefing_sections(
  p_sections jsonb
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_item jsonb;
begin
  if p_sections is null then
    return false;
  end if;


  if jsonb_typeof(
    p_sections
  ) <> 'array' then
    return false;
  end if;


  if jsonb_array_length(
    p_sections
  ) > 20 then
    return false;
  end if;


  for v_item in
    select value
    from jsonb_array_elements(
      p_sections
    )
  loop

    if jsonb_typeof(
      v_item
    ) <> 'object' then
      return false;
    end if;


    if nullif(
      btrim(
        coalesce(
          v_item->>'title',
          ''
        )
      ),
      ''
    ) is null then
      return false;
    end if;


    if nullif(
      btrim(
        coalesce(
          v_item->>'content',
          ''
        )
      ),
      ''
    ) is null then
      return false;
    end if;

  end loop;


  return true;
end;
$$;


alter table public.briefing_sessions
add constraint briefing_sessions_sections_chk
check (
  public.validate_briefing_sections(
    sections
  )
);


-- ============================================================
-- 3. OUTLET / ORGANIZATION GUARD
--
-- Briefing is restaurant-outlet only.
-- CNT / Central Kitchen is excluded.
-- ============================================================

create or replace function
public.validate_briefing_session_scope()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_outlet_org uuid;
  v_outlet_code text;
begin
  select
    o.organization_id,
    upper(
      trim(
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
      'Briefing requires an active outlet.';
  end if;


  if v_outlet_org is distinct from
     new.organization_id then
    raise exception
      'Briefing organization mismatch.';
  end if;


  if v_outlet_code = 'CNT' then
    raise exception
      'Central Kitchen is not available for outlet Briefing.';
  end if;


  return new;
end;
$$;


create trigger briefing_sessions_scope_guard
before insert or update
on public.briefing_sessions
for each row
execute function
public.validate_briefing_session_scope();


-- ============================================================
-- 4. DIRECT DATABASE ACCESS
--
-- Runtime uses authenticated server routes.
-- Raw browser writes remain disabled.
-- ============================================================

alter table public.briefing_sessions
  enable row level security;


revoke all
on public.briefing_sessions
from public, anon, authenticated;


grant
  select,
  insert,
  update,
  delete
on public.briefing_sessions
to service_role;


-- ============================================================
-- 5. FOUNDATION POSTCHECK
-- ============================================================

do $$
declare
  v_table_exists boolean;
  v_constraint_count integer;
begin

  select
    to_regclass(
      'public.briefing_sessions'
    ) is not null
  into
    v_table_exists;


  if not v_table_exists then
    raise exception
      'BRIEFING POSTCHECK: briefing_sessions table missing.';
  end if;


  select count(*)
    into v_constraint_count
  from pg_constraint
  where conrelid =
    'public.briefing_sessions'::regclass
    and conname in (
      'briefing_sessions_outlet_date_session_key',
      'briefing_sessions_sections_chk',
      'briefing_sessions_photo_chk'
    );


  if v_constraint_count <> 3 then
    raise exception
      'BRIEFING POSTCHECK: expected 3 core constraints, found %.',
      v_constraint_count;
  end if;

end;
$$;


commit;
