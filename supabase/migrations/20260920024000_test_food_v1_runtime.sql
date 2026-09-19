begin;

-- ============================================================
-- TEST FOOD V1 — RUNTIME
--
-- Internal restaurant PIC only.
-- One submission per outlet / business date / shift.
--
-- Input:
--   PAGI / SORE
--   selected menus
--   expiry date
--   warna / rasa / tekstur
--   notes only when NOT_STANDARD
-- ============================================================

create or replace function public.submit_test_food_v1(
  p_outlet_id uuid,
  p_shift text,
  p_checks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_org_id uuid;
  v_profile_name text;
  v_outlet_org uuid;
  v_outlet_code text;
  v_timezone text;
  v_business_date date;
  v_session_id uuid;
  v_result text;
  v_count integer;
  v_distinct_count integer;
  v_bad_count integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Unauthorized.';
  end if;


  select
    p.organization_id,
    p.full_name
  into
    v_org_id,
    v_profile_name
  from public.profiles p
  where p.id = v_user_id
    and p.is_active = true;

  if v_org_id is null then
    raise exception 'Active user profile was not found.';
  end if;


  select
    o.organization_id,
    upper(o.code),
    coalesce(
      nullif(o.timezone, ''),
      'Asia/Jakarta'
    )
  into
    v_outlet_org,
    v_outlet_code,
    v_timezone
  from public.outlets o
  where o.id = p_outlet_id
    and o.is_active = true;

  if v_outlet_org is null then
    raise exception 'Active outlet was not found.';
  end if;

  if v_outlet_org is distinct from v_org_id then
    raise exception 'Outlet organization mismatch.';
  end if;

  if v_outlet_code = 'CNT' then
    raise exception 'Central Kitchen is not available for Test Food.';
  end if;


  -- Explicit outlet assignment is required.
  -- Global/all-outlet access alone does not authorize Test Food input.
  if not exists (
    select 1
    from public.user_outlets uo
    where uo.user_id = v_user_id
      and uo.outlet_id = p_outlet_id
      and uo.is_active = true
  ) then
    raise exception
      'Test Food can only be submitted by an assigned outlet PIC.';
  end if;


  if upper(coalesce(p_shift, '')) not in (
    'PAGI',
    'SORE'
  ) then
    raise exception 'Shift must be PAGI or SORE.';
  end if;


  if p_checks is null
     or jsonb_typeof(p_checks) <> 'array'
     or jsonb_array_length(p_checks) = 0 then
    raise exception 'Select at least one Test Food menu.';
  end if;

  if jsonb_array_length(p_checks) > 50 then
    raise exception 'Too many Test Food menu rows.';
  end if;


  select
    count(*),
    count(distinct x.value->>'menu_id')
  into
    v_count,
    v_distinct_count
  from jsonb_array_elements(p_checks) x;

  if v_count <> v_distinct_count then
    raise exception 'Duplicate Test Food menu is not allowed.';
  end if;


  -- Validate required payload.
  select count(*)
    into v_bad_count
  from jsonb_array_elements(p_checks) x
  where
    nullif(btrim(x.value->>'menu_id'), '') is null
    or nullif(btrim(x.value->>'expiry_date'), '') is null
    or upper(coalesce(x.value->>'color_status', '')) not in (
      'STANDARD',
      'NOT_STANDARD'
    )
    or upper(coalesce(x.value->>'taste_status', '')) not in (
      'STANDARD',
      'NOT_STANDARD'
    )
    or upper(coalesce(x.value->>'texture_status', '')) not in (
      'STANDARD',
      'NOT_STANDARD'
    );

  if v_bad_count <> 0 then
    raise exception
      'Expiry Date, Warna, Rasa, and Tekstur are required for every selected menu.';
  end if;


  -- Notes mandatory only when one of the three specs is NOT_STANDARD.
  select count(*)
    into v_bad_count
  from jsonb_array_elements(p_checks) x
  where (
      upper(x.value->>'color_status') = 'NOT_STANDARD'
      or upper(x.value->>'taste_status') = 'NOT_STANDARD'
      or upper(x.value->>'texture_status') = 'NOT_STANDARD'
    )
    and nullif(
      btrim(
        coalesce(
          x.value->>'notes',
          ''
        )
      ),
      ''
    ) is null;

  if v_bad_count <> 0 then
    raise exception
      'Notes are required for menu with Not Standard result.';
  end if;


  -- Validate menu UUIDs + active applicability to exact outlet.
  begin
    select count(*)
      into v_bad_count
    from jsonb_array_elements(p_checks) x
    where not exists (
      select 1
      from public.test_food_menus m
      join public.test_food_menu_outlets tmo
        on tmo.menu_id = m.id
       and tmo.outlet_id = p_outlet_id
       and tmo.is_active = true
      where m.id = (x.value->>'menu_id')::uuid
        and m.organization_id = v_org_id
        and m.is_active = true
    );
  exception
    when invalid_text_representation then
      raise exception 'Invalid Test Food menu ID.';
  end;

  if v_bad_count <> 0 then
    raise exception
      'One or more Test Food menus are not applicable to this outlet.';
  end if;


  v_business_date :=
    (now() at time zone v_timezone)::date;


  if exists (
    select 1
    from public.test_food_sessions s
    where s.outlet_id = p_outlet_id
      and s.business_date = v_business_date
      and s.shift = upper(p_shift)
  ) then
    raise exception
      'Test Food for this shift has already been submitted today.';
  end if;


  select
    case
      when exists (
        select 1
        from jsonb_array_elements(p_checks) x
        where upper(x.value->>'color_status') = 'NOT_STANDARD'
           or upper(x.value->>'taste_status') = 'NOT_STANDARD'
           or upper(x.value->>'texture_status') = 'NOT_STANDARD'
      )
      then 'NEEDS_CORRECTION'
      else 'PASS'
    end
  into v_result;


  insert into public.test_food_sessions (
    organization_id,
    outlet_id,
    business_date,
    shift,
    status,
    result_status,
    created_by,
    pic_name_snapshot,
    submitted_at
  )
  values (
    v_org_id,
    p_outlet_id,
    v_business_date,
    upper(p_shift),
    'SUBMITTED',
    v_result,
    v_user_id,
    coalesce(
      nullif(btrim(v_profile_name), ''),
      'Outlet PIC'
    ),
    now()
  )
  returning id
    into v_session_id;


  begin
    insert into public.test_food_checks (
      session_id,
      menu_id,
      expiry_date,
      color_status,
      taste_status,
      texture_status,
      notes
    )
    select
      v_session_id,
      (x.value->>'menu_id')::uuid,
      (x.value->>'expiry_date')::date,
      upper(x.value->>'color_status'),
      upper(x.value->>'taste_status'),
      upper(x.value->>'texture_status'),
      nullif(
        btrim(
          coalesce(
            x.value->>'notes',
            ''
          )
        ),
        ''
      )
    from jsonb_array_elements(p_checks) x;
  exception
    when invalid_datetime_format then
      raise exception 'Invalid Expiry Date.';
  end;


  return jsonb_build_object(
    'session_id',
      v_session_id,
    'business_date',
      v_business_date,
    'shift',
      upper(p_shift),
    'result',
      v_result,
    'checked_count',
      v_count
  );
end;
$$;


revoke all
on function public.submit_test_food_v1(
  uuid,
  text,
  jsonb
)
from public, anon;

grant execute
on function public.submit_test_food_v1(
  uuid,
  text,
  jsonb
)
to authenticated;


commit;
