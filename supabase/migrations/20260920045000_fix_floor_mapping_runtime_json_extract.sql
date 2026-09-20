begin;

create or replace function
public.save_floor_mapping_runtime(
  p_organization_id uuid,
  p_outlet_id uuid,
  p_template_id uuid,
  p_business_date date,
  p_session_type text,
  p_action text,
  p_user_id uuid,
  p_pic_name text,
  p_general_notes text,
  p_staff_pins jsonb,
  p_boh_assignments jsonb
)
returns table (
  out_session_id uuid,
  out_status text,
  out_submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_session_id uuid;
  v_existing_status text;
  v_existing_template uuid;

  v_item jsonb;
  v_names text[];

  v_staff_count integer;
  v_boh_count integer;

  v_action text;
  v_session_type text;
begin

  v_action =
    upper(
      btrim(
        coalesce(
          p_action,
          ''
        )
      )
    );


  v_session_type =
    upper(
      btrim(
        coalesce(
          p_session_type,
          ''
        )
      )
    );


  if v_action not in (
    'SAVE_DRAFT',
    'SUBMIT'
  ) then
    raise exception
      'Invalid Floor Mapping action.';
  end if;


  if v_session_type not in (
    'MORNING',
    'AFTERNOON',
    'CLOSING'
  ) then
    raise exception
      'Invalid Floor Mapping session.';
  end if;


  if
    p_pic_name is null
    or btrim(
      p_pic_name
    ) = ''
  then
    raise exception
      'PIC name is required.';
  end if;


  if
    jsonb_typeof(
      coalesce(
        p_staff_pins,
        '[]'::jsonb
      )
    ) <> 'array'
  then
    raise exception
      'FOH staff pins must be an array.';
  end if;


  if
    jsonb_typeof(
      coalesce(
        p_boh_assignments,
        '[]'::jsonb
      )
    ) <> 'array'
  then
    raise exception
      'BOH assignments must be an array.';
  end if;


  v_staff_count =
    jsonb_array_length(
      coalesce(
        p_staff_pins,
        '[]'::jsonb
      )
    );


  v_boh_count =
    jsonb_array_length(
      coalesce(
        p_boh_assignments,
        '[]'::jsonb
      )
    );


  if
    v_staff_count > 100
    or v_boh_count > 100
  then
    raise exception
      'Too many Floor Mapping assignments.';
  end if;


  if
    v_action = 'SUBMIT'
    and v_staff_count = 0
  then
    raise exception
      'At least one FOH staff assignment is required before submit.';
  end if;


  if
    v_action = 'SUBMIT'
    and v_boh_count = 0
  then
    raise exception
      'At least one BOH assignment is required before submit.';
  end if;


  select
    s.id,
    s.status,
    s.template_id
  into
    v_session_id,
    v_existing_status,
    v_existing_template
  from public.floor_mapping_sessions s
  where
    s.outlet_id =
      p_outlet_id
    and s.business_date =
      p_business_date
    and s.session_type =
      v_session_type
  for update;


  if
    v_existing_status =
      'SUBMITTED'
  then
    raise exception
      'This Floor Mapping session has already been submitted.';
  end if;


  if
    v_session_id is not null
    and v_existing_template
      is distinct from
      p_template_id
  then
    raise exception
      'Floor Mapping template changed after this draft was created.';
  end if;


  if v_session_id is null then

    insert into public.floor_mapping_sessions (
      organization_id,
      outlet_id,
      template_id,
      business_date,
      session_type,
      status,
      general_notes,
      created_by,
      pic_name_snapshot
    )
    values (
      p_organization_id,
      p_outlet_id,
      p_template_id,
      p_business_date,
      v_session_type,
      'DRAFT',
      nullif(
        btrim(
          coalesce(
            p_general_notes,
            ''
          )
        ),
        ''
      ),
      p_user_id,
      p_pic_name
    )
    returning id
    into v_session_id;

  else

    update public.floor_mapping_sessions
    set
      general_notes =
        nullif(
          btrim(
            coalesce(
              p_general_notes,
              ''
            )
          ),
          ''
        ),

      pic_name_snapshot =
        p_pic_name,

      updated_at =
        now()
    where id =
      v_session_id;

  end if;


  -- ==========================================================
  -- FOH STAFF PINS
  -- ==========================================================

  delete
  from public.floor_mapping_staff_pins
  where session_id =
    v_session_id;


  for v_item in
    select value
    from jsonb_array_elements(
      coalesce(
        p_staff_pins,
        '[]'::jsonb
      )
    )
  loop

    v_names =
      array(
        select
          btrim(value)
        from jsonb_array_elements_text(
          coalesce(
            v_item ->
              'assigned_names',
            '[]'::jsonb
          )
        )
        where btrim(value) <> ''
      );


    if
      cardinality(
        v_names
      ) = 0
    then
      raise exception
        'FOH assigned name is required.';
    end if;


    insert into public.floor_mapping_staff_pins (
      session_id,
      position_label,
      role_type,
      assigned_names,
      x_pct,
      y_pct,
      notes,
      sort_order
    )
    values (
      v_session_id,

      nullif(
        btrim(
          v_item ->>
            'position_label'
        ),
        ''
      ),

      upper(
        btrim(
          v_item ->>
            'role_type'
        )
      ),

      v_names,

      (
        v_item ->>
          'x_pct'
      )::numeric,

      (
        v_item ->>
          'y_pct'
      )::numeric,

      nullif(
        btrim(
          coalesce(
            v_item ->>
              'notes',
            ''
          )
        ),
        ''
      ),

      coalesce(
        nullif(
          v_item ->>
            'sort_order',
          ''
        )::integer,
        0
      )
    );

  end loop;


  -- ==========================================================
  -- BOH ASSIGNMENTS
  -- ==========================================================

  delete
  from public.floor_mapping_boh_assignments
  where session_id =
    v_session_id;


  for v_item in
    select value
    from jsonb_array_elements(
      coalesce(
        p_boh_assignments,
        '[]'::jsonb
      )
    )
  loop

    v_names =
      array(
        select
          btrim(value)
        from jsonb_array_elements_text(
          coalesce(
            v_item ->
              'assigned_names',
            '[]'::jsonb
          )
        )
        where btrim(value) <> ''
      );


    if
      cardinality(
        v_names
      ) = 0
    then
      raise exception
        'BOH assigned name is required.';
    end if;


    insert into public.floor_mapping_boh_assignments (
      session_id,
      position_id,
      assigned_names,
      station_note,
      sort_order
    )
    values (
      v_session_id,

      (
        v_item ->>
          'position_id'
      )::uuid,

      v_names,

      nullif(
        btrim(
          coalesce(
            v_item ->>
              'station_note',
            ''
          )
        ),
        ''
      ),

      coalesce(
        nullif(
          v_item ->>
            'sort_order',
          ''
        )::integer,
        0
      )
    );

  end loop;


  if v_action = 'SUBMIT' then

    update public.floor_mapping_sessions
    set
      status =
        'SUBMITTED',

      submitted_by =
        p_user_id,

      submitted_at =
        now(),

      updated_at =
        now()
    where id =
      v_session_id;

  end if;


  return query
  select
    s.id,
    s.status,
    s.submitted_at
  from public.floor_mapping_sessions s
  where s.id =
    v_session_id;

end;
$$;


revoke all
on function
public.save_floor_mapping_runtime(
  uuid,
  uuid,
  uuid,
  date,
  text,
  text,
  uuid,
  text,
  text,
  jsonb,
  jsonb
)
from public, anon, authenticated;


grant execute
on function
public.save_floor_mapping_runtime(
  uuid,
  uuid,
  uuid,
  date,
  text,
  text,
  uuid,
  text,
  text,
  jsonb,
  jsonb
)
to service_role;


notify pgrst, 'reload schema';

commit;
