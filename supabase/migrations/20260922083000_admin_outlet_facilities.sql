begin;

create table if not exists public.outlet_facility_change_log (
  id uuid primary key default gen_random_uuid(),

  organization_id uuid not null
    references public.organizations(id)
    on delete cascade,

  outlet_id uuid not null
    references public.outlets(id)
    on delete cascade,

  facility_id uuid not null
    references public.facility_definitions(id)
    on delete restrict,

  old_is_available boolean null,
  new_is_available boolean not null,

  changed_by uuid not null
    references public.profiles(id)
    on delete restrict,

  change_reason text null,

  created_at timestamptz not null
    default now()
);

create index if not exists
  outlet_facility_change_log_outlet_idx
on public.outlet_facility_change_log (
  outlet_id,
  created_at desc
);

create index if not exists
  outlet_facility_change_log_facility_idx
on public.outlet_facility_change_log (
  facility_id,
  created_at desc
);

alter table public.outlet_facility_change_log
  enable row level security;

drop policy if exists
  outlet_facility_change_log_select_admin
on public.outlet_facility_change_log;

create policy
  outlet_facility_change_log_select_admin
on public.outlet_facility_change_log
for select
to authenticated
using (
  public.is_org_admin(
    organization_id
  )
);

grant select
on public.outlet_facility_change_log
to authenticated;

create or replace function
public.set_outlet_facility_availability(
  p_outlet_id uuid,
  p_facility_id uuid,
  p_is_available boolean,
  p_expected_updated_at timestamptz default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_facility_org_id uuid;
  v_facility_code text;

  v_existing public.outlet_facilities%rowtype;
  v_result public.outlet_facilities%rowtype;

  v_open_report_number text;
  v_open_report_status text;
begin
  v_user_id :=
    auth.uid();

  if v_user_id is null then
    raise exception
      'OUTLET_FACILITY_UNAUTHORIZED'
      using errcode = '28000';
  end if;

  if p_outlet_id is null
     or p_facility_id is null
     or p_is_available is null then
    raise exception
      'OUTLET_FACILITY_INVALID_INPUT'
      using errcode = '22004';
  end if;

  select
    o.organization_id
  into
    v_org_id
  from public.outlets o
  where o.id = p_outlet_id
    and o.is_active = true;

  if v_org_id is null then
    raise exception
      'OUTLET_FACILITY_OUTLET_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  select
    fd.organization_id,
    fd.code
  into
    v_facility_org_id,
    v_facility_code
  from public.facility_definitions fd
  where fd.id = p_facility_id
    and fd.is_active = true;

  if v_facility_org_id is null then
    raise exception
      'OUTLET_FACILITY_DEFINITION_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if v_facility_org_id
     is distinct from
     v_org_id then
    raise exception
      'OUTLET_FACILITY_ORGANIZATION_MISMATCH'
      using errcode = '23514';
  end if;

  if not public.is_org_admin(
    v_org_id
  ) then
    raise exception
      'OUTLET_FACILITY_FORBIDDEN'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_outlet_id::text
      || ':'
      || p_facility_id::text,
      0
    )
  );

  select
    ofa.*
  into
    v_existing
  from public.outlet_facilities ofa
  where ofa.outlet_id =
        p_outlet_id
    and ofa.facility_id =
        p_facility_id
  for update;

  if v_existing.id is not null then
    if p_expected_updated_at is null then
      raise exception
        'OUTLET_FACILITY_STALE: current configuration must be refreshed before update.'
        using errcode = '40001';
    end if;

    if v_existing.updated_at
       is distinct from
       p_expected_updated_at then
      raise exception
        'OUTLET_FACILITY_STALE: configuration was changed by another user.'
        using errcode = '40001';
    end if;

    if v_existing.is_available
       is not distinct from
       p_is_available then
      return jsonb_build_object(
        'id',
          v_existing.id,
        'outletId',
          v_existing.outlet_id,
        'facilityId',
          v_existing.facility_id,
        'isAvailable',
          v_existing.is_available,
        'updatedAt',
          v_existing.updated_at,
        'changed',
          false
      );
    end if;
  else
    if p_expected_updated_at is not null then
      raise exception
        'OUTLET_FACILITY_STALE: expected configuration no longer exists.'
        using errcode = '40001';
    end if;
  end if;

  select
    r.report_number,
    r.status
  into
    v_open_report_number,
    v_open_report_status
  from public.reports r

  join public.form_version_sections fvs
    on fvs.form_version_id =
       r.form_version_id

  join public.questions q
    on q.version_section_id =
       fvs.id

  where r.outlet_id =
        p_outlet_id

    and lower(
      coalesce(
        r.status,
        ''
      )
    ) in (
      'draft',
      'in_progress',
      'reopened',
      'needs_correction'
    )

    and fvs.is_active =
        true

    and q.is_active =
        true

    and q.config #>>
        '{applicability,type}' =
        'facility'

    and upper(
      coalesce(
        q.config #>>
          '{applicability,facility_key}',
        ''
      )
    ) =
        upper(
          v_facility_code
        )

  order by
    r.created_at desc

  limit 1;

  if v_open_report_number
     is not null then
    raise exception
      'OUTLET_FACILITY_OPEN_REPORT: report % is currently % and uses facility %.',
      v_open_report_number,
      v_open_report_status,
      v_facility_code
      using errcode = '55000';
  end if;

  if v_existing.id is null then
    insert into public.outlet_facilities (
      outlet_id,
      facility_id,
      is_available,
      created_by,
      updated_by
    )
    values (
      p_outlet_id,
      p_facility_id,
      p_is_available,
      v_user_id,
      v_user_id
    )
    returning *
      into v_result;
  else
    update public.outlet_facilities
    set
      is_available =
        p_is_available,
      updated_by =
        v_user_id
    where id =
          v_existing.id
    returning *
      into v_result;
  end if;

  insert into
  public.outlet_facility_change_log (
    organization_id,
    outlet_id,
    facility_id,
    old_is_available,
    new_is_available,
    changed_by,
    change_reason
  )
  values (
    v_org_id,
    p_outlet_id,
    p_facility_id,
    case
      when v_existing.id is null
        then null
      else
        v_existing.is_available
    end,
    p_is_available,
    v_user_id,
    nullif(
      btrim(
        coalesce(
          p_reason,
          ''
        )
      ),
      ''
    )
  );

  return jsonb_build_object(
    'id',
      v_result.id,
    'outletId',
      v_result.outlet_id,
    'facilityId',
      v_result.facility_id,
    'isAvailable',
      v_result.is_available,
    'updatedAt',
      v_result.updated_at,
    'changed',
      true
  );
end;
$function$;

revoke all
on function
public.set_outlet_facility_availability(
  uuid,
  uuid,
  boolean,
  timestamptz,
  text
)
from public, anon;

grant execute
on function
public.set_outlet_facility_availability(
  uuid,
  uuid,
  boolean,
  timestamptz,
  text
)
to authenticated;

commit;
