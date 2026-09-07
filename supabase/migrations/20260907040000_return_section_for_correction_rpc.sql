begin;

create or replace function public.return_report_section_for_correction(
  p_report_section_id uuid,
  p_actor_user_id uuid,
  p_actor_name text,
  p_reason text,
  p_question_ids uuid[]
)
returns table (
  report_section_id uuid,
  status text,
  correction_round integer,
  correction_requested_by uuid,
  correction_requested_at timestamptz,
  correction_reason text,
  correction_question_ids uuid[]
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  v_round integer;
  v_reviewed_by uuid;
  v_reviewed_at timestamptz;
  v_submitted_by uuid;
  v_submitted_at timestamptz;
  v_now timestamptz := now();
begin
  if p_report_section_id is null then
    raise exception 'report_section_id is required';
  end if;

  if p_actor_user_id is null then
    raise exception 'actor_user_id is required';
  end if;

  if length(trim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Correction reason must contain at least 5 characters';
  end if;

  if p_question_ids is null or cardinality(p_question_ids) = 0 then
    raise exception 'At least one correction question is required';
  end if;

  select
    lower(trim(coalesce(rs.status, ''))),
    coalesce(rs.correction_round, 0),
    rs.reviewed_by,
    rs.reviewed_at,
    rs.submitted_by,
    rs.submitted_at
  into
    v_status,
    v_round,
    v_reviewed_by,
    v_reviewed_at,
    v_submitted_by,
    v_submitted_at
  from public.report_sections rs
  where rs.id = p_report_section_id
  for update;

  if not found then
    raise exception 'Report section not found';
  end if;

  if v_status not in ('submitted', 'reviewed') then
    raise exception
      'Section cannot be returned for correction from status: %',
      v_status;
  end if;

  v_round := v_round + 1;

  update public.report_sections rs
  set
    status = 'needs_correction',
    correction_requested_by = p_actor_user_id,
    correction_requested_at = v_now,
    correction_reason = trim(p_reason),
    correction_question_ids = p_question_ids,
    correction_round = v_round,
    updated_at = v_now
  where rs.id = p_report_section_id;

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
    'returned_for_correction',
    p_actor_user_id,
    nullif(trim(coalesce(p_actor_name, '')), ''),
    trim(p_reason),
    p_question_ids,
    jsonb_build_object(
      'previous_status', v_status,
      'previous_submitted_by', v_submitted_by,
      'previous_submitted_at', v_submitted_at,
      'previous_reviewed_by', v_reviewed_by,
      'previous_reviewed_at', v_reviewed_at,
      'correction_round', v_round
    ),
    v_now
  );

  return query
  select
    rs.id,
    rs.status,
    rs.correction_round,
    rs.correction_requested_by,
    rs.correction_requested_at,
    rs.correction_reason,
    rs.correction_question_ids
  from public.report_sections rs
  where rs.id = p_report_section_id;
end;
$$;


-- Only trusted server/service-role code may execute this mutation.
revoke all on function public.return_report_section_for_correction(
  uuid,
  uuid,
  text,
  text,
  uuid[]
) from public;

revoke all on function public.return_report_section_for_correction(
  uuid,
  uuid,
  text,
  text,
  uuid[]
) from anon;

revoke all on function public.return_report_section_for_correction(
  uuid,
  uuid,
  text,
  text,
  uuid[]
) from authenticated;

grant execute on function public.return_report_section_for_correction(
  uuid,
  uuid,
  text,
  text,
  uuid[]
) to service_role;

commit;
