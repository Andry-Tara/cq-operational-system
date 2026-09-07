begin;

create or replace function public.review_report_section(
  p_report_section_id uuid,
  p_actor_user_id uuid,
  p_actor_name text
)
returns table (
  report_section_id uuid,
  status text,
  submitted_by uuid,
  submitted_at timestamptz,
  reviewed_by uuid,
  reviewed_at timestamptz,
  correction_round integer,
  event_type text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_submitted_by uuid;
  v_submitted_at timestamptz;
  v_correction_round integer;
  v_event_type text;
  v_reviewed_at timestamptz := now();
begin

  if p_report_section_id is null then
    raise exception
      'report_section_id is required';
  end if;

  if p_actor_user_id is null then
    raise exception
      'actor_user_id is required';
  end if;


  -- ==========================================================
  -- LOCK SECTION
  -- ==========================================================

  select
    lower(
      trim(
        coalesce(
          rs.status,
          ''
        )
      )
    ),
    rs.submitted_by,
    rs.submitted_at,
    coalesce(
      rs.correction_round,
      0
    )
  into
    v_status,
    v_submitted_by,
    v_submitted_at,
    v_correction_round
  from public.report_sections rs
  where
    rs.id =
      p_report_section_id
  for update;


  if not found then
    raise exception
      'Report section not found';
  end if;


  if v_status = 'reviewed' then
    return query
    select
      rs.id,
      rs.status,
      rs.submitted_by,
      rs.submitted_at,
      rs.reviewed_by,
      rs.reviewed_at,
      rs.correction_round,
      case
        when coalesce(
          rs.correction_round,
          0
        ) > 0
        then 'reviewed_again'
        else 'reviewed'
      end::text
    from public.report_sections rs
    where
      rs.id =
        p_report_section_id;

    return;
  end if;


  if v_status <> 'submitted' then
    raise exception
      'Section cannot be reviewed from status: %',
      v_status;
  end if;


  if v_submitted_by is null then
    raise exception
      'Section does not have submitted_by';
  end if;


  v_event_type :=
    case
      when v_correction_round > 0
        then 'reviewed_again'
      else 'reviewed'
    end;


  -- ==========================================================
  -- MARK REVIEWED
  -- ==========================================================

  update public.report_sections rs
  set
    status =
      'reviewed',

    reviewed_by =
      p_actor_user_id,

    reviewed_at =
      v_reviewed_at,

    updated_at =
      v_reviewed_at

  where
    rs.id =
      p_report_section_id;


  -- ==========================================================
  -- AUDIT EVENT
  -- ==========================================================

  insert into public.report_section_events (
    report_section_id,
    event_type,
    actor_user_id,
    actor_name,
    reason,
    question_ids,
    metadata,
    created_at
  )
  values (
    p_report_section_id,
    v_event_type,
    p_actor_user_id,
    nullif(
      trim(
        coalesce(
          p_actor_name,
          ''
        )
      ),
      ''
    ),
    null,
    null,
    jsonb_build_object(
      'correction_round',
      v_correction_round,
      'submitted_by',
      v_submitted_by,
      'submitted_at',
      v_submitted_at
    ),
    v_reviewed_at
  );


  return query
  select
    rs.id,
    rs.status,
    rs.submitted_by,
    rs.submitted_at,
    rs.reviewed_by,
    rs.reviewed_at,
    rs.correction_round,
    v_event_type
  from public.report_sections rs
  where
    rs.id =
      p_report_section_id;

end;
$$;


revoke all on function
  public.review_report_section(
    uuid,
    uuid,
    text
  )
from public;

revoke all on function
  public.review_report_section(
    uuid,
    uuid,
    text
  )
from anon;

revoke all on function
  public.review_report_section(
    uuid,
    uuid,
    text
  )
from authenticated;

grant execute on function
  public.review_report_section(
    uuid,
    uuid,
    text
  )
to service_role;


comment on function
  public.review_report_section(
    uuid,
    uuid,
    text
  )
is
  'Atomically reviews a submitted Production section and records reviewed/reviewed_again audit event.';


commit;
