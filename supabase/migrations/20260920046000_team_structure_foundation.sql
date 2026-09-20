begin;

-- ============================================================
-- TEAM STRUCTURE FOUNDATION
--
-- staff_positions
-- team_staff
-- team_staff_assignments
--
-- Position master:
--   organization-wide defaults
--   + optional outlet-specific additions
--
-- Staff:
--   independent from auth.users
--   optional app_user_id link
--
-- Moving staff:
--   old assignment stays historical
--   new assignment becomes current
-- ============================================================


-- ============================================================
-- 1. POSITION MASTER
-- ============================================================

create table public.staff_positions (
  id uuid
    primary key
    default gen_random_uuid(),

  organization_id uuid
    not null
    references public.organizations(id)
    on delete restrict,

  outlet_id uuid
    references public.outlets(id)
    on delete restrict,

  name text
    not null,

  category text
    not null
    check (
      category in (
        'MOD',
        'LEADER',
        'SERVER',
        'RUNNER',
        'CHECKER',
        'CASHIER',
        'HOST',
        'GRO',
        'TA_HK',
        'FLOOR',
        'OTHER'
      )
    ),

  area text
    not null
    default 'FOH'
    check (
      area in (
        'FOH',
        'BOH',
        'BOTH'
      )
    ),

  sort_order integer
    not null
    default 100,

  is_active boolean
    not null
    default true,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint staff_positions_name_chk
    check (
      btrim(name) <> ''
    )
);


create unique index
staff_positions_global_name_key
on public.staff_positions (
  organization_id,
  lower(name)
)
where outlet_id is null;


create unique index
staff_positions_outlet_name_key
on public.staff_positions (
  organization_id,
  outlet_id,
  lower(name)
)
where outlet_id is not null;


create index
staff_positions_lookup_idx
on public.staff_positions (
  organization_id,
  outlet_id,
  is_active,
  sort_order
);


create trigger staff_positions_set_updated_at
before update
on public.staff_positions
for each row
execute function public.set_updated_at();


-- ============================================================
-- 2. STAFF DIRECTORY
-- ============================================================

create table public.team_staff (
  id uuid
    primary key
    default gen_random_uuid(),

  organization_id uuid
    not null
    references public.organizations(id)
    on delete restrict,

  employee_code text,

  full_name text
    not null,

  app_user_id uuid
    references auth.users(id)
    on delete set null,

  is_active boolean
    not null
    default true,

  notes text,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint team_staff_name_chk
    check (
      btrim(full_name) <> ''
    )
);


create unique index
team_staff_employee_code_key
on public.team_staff (
  organization_id,
  lower(employee_code)
)
where
  employee_code is not null
  and btrim(employee_code) <> '';


create index
team_staff_org_active_idx
on public.team_staff (
  organization_id,
  is_active,
  full_name
);


create trigger team_staff_set_updated_at
before update
on public.team_staff
for each row
execute function public.set_updated_at();


-- ============================================================
-- 3. STAFF ASSIGNMENT HISTORY
-- ============================================================

create table public.team_staff_assignments (
  id uuid
    primary key
    default gen_random_uuid(),

  organization_id uuid
    not null
    references public.organizations(id)
    on delete restrict,

  staff_id uuid
    not null
    references public.team_staff(id)
    on delete restrict,

  outlet_id uuid
    not null
    references public.outlets(id)
    on delete restrict,

  position_id uuid
    not null
    references public.staff_positions(id)
    on delete restrict,

  assignment_type text
    not null
    default 'PERMANENT'
    check (
      assignment_type in (
        'PERMANENT',
        'TEMPORARY'
      )
    ),

  is_primary boolean
    not null
    default true,

  effective_from date
    not null
    default current_date,

  effective_to date,

  notes text,

  created_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz
    not null
    default now(),

  updated_at timestamptz
    not null
    default now(),

  constraint team_staff_assignment_dates_chk
    check (
      effective_to is null
      or effective_to >= effective_from
    ),

  constraint team_staff_temporary_end_chk
    check (
      assignment_type <> 'TEMPORARY'
      or effective_to is not null
    )
);


create unique index
team_staff_one_current_primary_idx
on public.team_staff_assignments (
  staff_id
)
where
  is_primary = true
  and effective_to is null;


create index
team_staff_assignments_outlet_date_idx
on public.team_staff_assignments (
  outlet_id,
  effective_from,
  effective_to
);


create index
team_staff_assignments_staff_history_idx
on public.team_staff_assignments (
  staff_id,
  effective_from desc
);


create trigger team_staff_assignments_set_updated_at
before update
on public.team_staff_assignments
for each row
execute function public.set_updated_at();


-- ============================================================
-- 4. ASSIGNMENT SCOPE GUARD
-- ============================================================

create or replace function
public.validate_team_staff_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_staff_org uuid;
  v_outlet_org uuid;
  v_position_org uuid;
  v_position_outlet uuid;
begin

  select organization_id
  into v_staff_org
  from public.team_staff
  where id =
    new.staff_id;


  select organization_id
  into v_outlet_org
  from public.outlets
  where id =
      new.outlet_id
    and is_active =
      true;


  select
    organization_id,
    outlet_id
  into
    v_position_org,
    v_position_outlet
  from public.staff_positions
  where id =
      new.position_id
    and is_active =
      true;


  if
    v_staff_org is null
    or v_outlet_org is null
    or v_position_org is null
  then
    raise exception
      'Invalid Team Structure assignment reference.';
  end if;


  if
    new.organization_id
      is distinct from
      v_staff_org
    or new.organization_id
      is distinct from
      v_outlet_org
    or new.organization_id
      is distinct from
      v_position_org
  then
    raise exception
      'Team Structure organization mismatch.';
  end if;


  if
    v_position_outlet is not null
    and v_position_outlet
      is distinct from
      new.outlet_id
  then
    raise exception
      'Outlet-specific position cannot be assigned to another outlet.';
  end if;


  return new;
end;
$$;


create trigger team_staff_assignment_scope_guard
before insert or update
on public.team_staff_assignments
for each row
execute function
public.validate_team_staff_assignment();


-- ============================================================
-- 5. ATOMIC POSITION / OUTLET REASSIGNMENT
--
-- Used later for:
--   position change
--   staff transfer
--
-- Existing history remains unchanged.
-- ============================================================

create or replace function
public.assign_team_staff(
  p_organization_id uuid,
  p_staff_id uuid,
  p_outlet_id uuid,
  p_position_id uuid,
  p_effective_from date,
  p_user_id uuid,
  p_notes text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current public.team_staff_assignments%rowtype;
  v_assignment_id uuid;
begin

  select *
  into v_current
  from public.team_staff_assignments
  where
    staff_id =
      p_staff_id
    and is_primary =
      true
    and effective_to
      is null
  for update;


  if v_current.id is not null then

    if
      v_current.outlet_id =
        p_outlet_id
      and v_current.position_id =
        p_position_id
    then
      return
        v_current.id;
    end if;


    if
      v_current.effective_from >=
        p_effective_from
    then

      update public.team_staff_assignments
      set
        organization_id =
          p_organization_id,

        outlet_id =
          p_outlet_id,

        position_id =
          p_position_id,

        effective_from =
          p_effective_from,

        notes =
          nullif(
            btrim(
              coalesce(
                p_notes,
                ''
              )
            ),
            ''
          ),

        updated_at =
          now()
      where id =
        v_current.id
      returning id
      into v_assignment_id;


      return
        v_assignment_id;

    end if;


    update public.team_staff_assignments
    set
      effective_to =
        p_effective_from - 1,

      updated_at =
        now()
    where id =
      v_current.id;

  end if;


  insert into public.team_staff_assignments (
    organization_id,
    staff_id,
    outlet_id,
    position_id,
    assignment_type,
    is_primary,
    effective_from,
    effective_to,
    notes,
    created_by
  )
  values (
    p_organization_id,
    p_staff_id,
    p_outlet_id,
    p_position_id,
    'PERMANENT',
    true,
    p_effective_from,
    null,
    nullif(
      btrim(
        coalesce(
          p_notes,
          ''
        )
      ),
      ''
    ),
    p_user_id
  )
  returning id
  into v_assignment_id;


  return
    v_assignment_id;
end;
$$;


revoke all
on function
public.assign_team_staff(
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  uuid,
  text
)
from public, anon, authenticated;


grant execute
on function
public.assign_team_staff(
  uuid,
  uuid,
  uuid,
  uuid,
  date,
  uuid,
  text
)
to service_role;


-- ============================================================
-- 6. DEACTIVATE STAFF
-- ============================================================

create or replace function
public.deactivate_team_staff(
  p_staff_id uuid,
  p_effective_date date
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin

  update public.team_staff_assignments
  set
    effective_to =
      greatest(
        effective_from,
        p_effective_date
      ),

    updated_at =
      now()
  where
    staff_id =
      p_staff_id
    and is_primary =
      true
    and effective_to
      is null;


  update public.team_staff
  set
    is_active =
      false,

    updated_at =
      now()
  where id =
    p_staff_id;

end;
$$;


revoke all
on function
public.deactivate_team_staff(
  uuid,
  date
)
from public, anon, authenticated;


grant execute
on function
public.deactivate_team_staff(
  uuid,
  date
)
to service_role;


-- ============================================================
-- 7. RLS
--
-- Runtime goes through server routes.
-- ============================================================

alter table public.staff_positions
  enable row level security;

alter table public.team_staff
  enable row level security;

alter table public.team_staff_assignments
  enable row level security;


revoke all
on public.staff_positions,
   public.team_staff,
   public.team_staff_assignments
from public, anon, authenticated;


grant
  select,
  insert,
  update,
  delete
on public.staff_positions,
   public.team_staff,
   public.team_staff_assignments
to service_role;


-- ============================================================
-- 8. DEFAULT POSITION LIBRARY
-- ============================================================

insert into public.staff_positions (
  organization_id,
  outlet_id,
  name,
  category,
  area,
  sort_order
)
select
  o.id,
  null,
  seed.name,
  seed.category,
  seed.area,
  seed.sort_order
from public.organizations o
cross join (
  values
    (
      'Manager On Duty',
      'MOD',
      'BOTH',
      10
    ),
    (
      'Assistant Manager',
      'LEADER',
      'BOTH',
      20
    ),
    (
      'Leader',
      'LEADER',
      'BOTH',
      30
    ),
    (
      'Server',
      'SERVER',
      'FOH',
      40
    ),
    (
      'Runner',
      'RUNNER',
      'FOH',
      50
    ),
    (
      'Checker',
      'CHECKER',
      'FOH',
      60
    ),
    (
      'Cashier',
      'CASHIER',
      'FOH',
      70
    ),
    (
      'Host',
      'HOST',
      'FOH',
      80
    ),
    (
      'GRO',
      'GRO',
      'FOH',
      90
    ),
    (
      'Toilet Attendant',
      'TA_HK',
      'FOH',
      100
    ),
    (
      'Housekeeping',
      'TA_HK',
      'BOTH',
      110
    ),
    (
      'Cook',
      'OTHER',
      'BOH',
      120
    ),
    (
      'Steward',
      'OTHER',
      'BOH',
      130
    )
) as seed(
  name,
  category,
  area,
  sort_order
)
on conflict do nothing;


-- ============================================================
-- 9. DEDICATED PERMISSION
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
  'team_structure.manage',
  'Manage Team Structure',
  'Manage position master and staff directory for allowed outlets.',
  true
from public.organizations o
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


-- Outlet Manager + ORG_ADMIN
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
 and p.code =
     'team_structure.manage'
where
  r.code in (
    'STORE_MANAGER',
    'ORG_ADMIN'
  )
  and r.is_active =
    true
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
-- 10. POSTCHECK
-- ============================================================

do $$
declare
  v_table_count integer;
  v_permission_count integer;
begin

  select count(*)
  into v_table_count
  from pg_class c
  join pg_namespace n
    on n.oid =
       c.relnamespace
  where
    n.nspname =
      'public'
    and c.relname in (
      'staff_positions',
      'team_staff',
      'team_staff_assignments'
    )
    and c.relkind =
      'r';


  if v_table_count <> 3 then
    raise exception
      'TEAM STRUCTURE POSTCHECK: expected 3 tables, found %.',
      v_table_count;
  end if;


  select count(*)
  into v_permission_count
  from public.permissions
  where
    code =
      'team_structure.manage'
    and is_active =
      true;


  if v_permission_count = 0 then
    raise exception
      'TEAM STRUCTURE POSTCHECK: permission was not created.';
  end if;

end;
$$;


notify pgrst, 'reload schema';

commit;
