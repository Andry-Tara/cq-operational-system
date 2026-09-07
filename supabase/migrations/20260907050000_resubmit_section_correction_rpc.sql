begin;

create or replace function public.resubmit_report_section_correction(
  p_report_section_id uuid
)
returns table (
  report_section_id uuid,
  status text,
  correction_round integer,
  submitted_by uuid,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_user_id uuid;
  v_actor_name text;

  v_status text;
  v_report_id uuid;
  v_section_id uuid;
  v_outlet_id uuid;
  v_form_id uuid;
  v_round integer;

  v_now timestamptz :=
    now();
begin

  -- ==========================================================
  -- AUTH
  -- ==========================================================

  v_actor_user_id :=
    auth.uid();

  if v_actor_user_id is null then
    raise exception
      'Authenticated user is required';
  end if;


  if p_report_section_id is null then
    raise exception
      'report_section_id is required';
  end if;


  -- ==========================================================
  -- LOCK CURRENT SECTION
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
    rs.report_id,
    rs.section_id,
    r.outlet_id,
    r.form_id,
    coalesce(
      rs.correction_round,
      0
    )
  into
    v_status,
    v_report_id,
    v_section_id,
    v_outlet_id,
    v_form_id,
    v_round
  from public.report_sections rs
  join public.reports r
    on r.id =
      rs.report_id
  where
    rs.id =
      p_report_section_id
  for update of rs;


  if not found then
    raise exception
      'Report section not found';
  end if;


  if v_status <>
    'needs_correction'
  then
    raise exception
      'Section cannot be resubmitted from status: %',
      v_status;
  end if;


  -- ==========================================================
  -- EXACT SECTION SUBMIT PERMISSION
  --
  -- Allows:
  -- - assigned PIC
  -- - Production Leader backup
  --
  -- Rejects unrelated users.
  -- ==========================================================

  if not exists (
    select 1
    from public.user_section_permissions usp
    where
      usp.user_id =
        v_actor_user_id

      and usp.outlet_id =
        v_outlet_id

      and usp.form_id =
        v_form_id

      and usp.section_id =
        v_section_id

      and usp.can_submit =
        true
  ) then
    raise exception
      'User does not have submit permission for this section';
  end if;


  -- ==========================================================
  -- ACTOR SNAPSHOT
  -- ==========================================================

  select
    nullif(
      trim(
        coalesce(
          p.full_name,
          ''
        )
      ),
      ''
    )
  into
    v_actor_name
  from public.profiles p
  where
    p.id =
      v_actor_user_id;


  -- ==========================================================
  -- RESUBMIT
  --
  -- Previous review is no longer the current approval.
  -- Historical review remains preserved in event history.
  -- ==========================================================

  update public.report_sections rs
  set
    status =
      'submitted',

    submitted_by =
      v_actor_user_id,

    submitted_at =
      v_now,

    reviewed_by =
      null,

    reviewed_at =
      null,

    updated_at =
      v_now

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
    'resubmitted',
    v_actor_user_id,
    coalesce(
      v_actor_name,
      'Section PIC'
    ),
    null,
    (
      select
        rs.correction_question_ids
      from public.report_sections rs
      where
        rs.id =
          p_report_section_id
    ),
    jsonb_build_object(
      'correction_round',
      v_round
    ),
    v_now
  );


  return query
  select
    rs.id,
    rs.status,
    rs.correction_round,
    rs.submitted_by,
    rs.submitted_at
  from public.report_sections rs
  where
    rs.id =
      p_report_section_id;

end;
$$;


revoke all on function
  public.resubmit_report_section_correction(
    uuid
  )
from public;

revoke all on function
  public.resubmit_report_section_correction(
    uuid
  )
from anon;

grant execute on function
  public.resubmit_report_section_correction(
    uuid
  )
to authenticated;


comment on function
  public.resubmit_report_section_correction(
    uuid
  )
is
  'Atomically transitions a targeted section correction back to submitted and records its resubmission audit event.';


commit;
