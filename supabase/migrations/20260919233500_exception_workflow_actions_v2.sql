begin;


-- ============================================================
-- EXCEPTION CENTER V2-B
--
-- Atomic workflow actions.
--
-- Only service_role may execute this function.
-- Browser/authenticated clients receive no direct execute grant.
-- ============================================================


create or replace function public.mutate_exception_workflow(
  p_organization_id uuid,
  p_source_type text,
  p_source_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_assigned_to uuid default null,
  p_due_at timestamptz default null,
  p_sla_hours integer default null,
  p_note text default null
)
returns jsonb

language plpgsql
security definer

set search_path = ''

as $function$

declare
  v_source_org uuid;
  v_source_outlet uuid;

  v_workflow
    public.exception_workflows%rowtype;

  v_from_status text;
  v_to_status text;
  v_event_type text;

  v_old_assigned_to uuid;
  v_old_due_at timestamptz;
  v_old_sla_hours integer;

  v_created boolean
    := false;

  v_metadata jsonb
    := '{}'::jsonb;

begin

  -- ==========================================================
  -- BASIC INPUT
  -- ==========================================================

  if p_organization_id is null
     or p_source_id is null
     or p_actor_user_id is null
  then
    raise exception
      'Invalid exception workflow request.';
  end if;


  if p_source_type not in (
    'operations_issue',
    'audit_finding'
  ) then
    raise exception
      'Unsupported exception source.';
  end if;


  if p_action not in (
    'assign',
    'schedule',
    'start',
    'escalate',
    'resolve',
    'verify',
    'close'
  ) then
    raise exception
      'Unsupported exception action.';
  end if;


  if p_sla_hours is not null
     and (
       p_sla_hours < 1
       or p_sla_hours > 8760
     )
  then
    raise exception
      'SLA hours must be between 1 and 8760.';
  end if;


  -- ==========================================================
  -- ACTOR MUST BELONG TO ORGANIZATION
  -- ==========================================================

  if not exists (
    select 1
    from public.profiles p
    where p.id =
        p_actor_user_id
      and p.organization_id =
        p_organization_id
      and p.is_active =
        true
  ) then
    raise exception
      'Workflow actor is not an active organization user.';
  end if;


  -- ==========================================================
  -- SOURCE OWNERSHIP
  -- ==========================================================

  if p_source_type =
      'operations_issue'
  then

    select
      o.organization_id,
      r.outlet_id

    into
      v_source_org,
      v_source_outlet

    from public.issues i

    join public.reports r
      on r.id =
        i.report_id

    join public.outlets o
      on o.id =
        r.outlet_id

    where i.id =
      p_source_id

    limit 1;


  elsif p_source_type =
      'audit_finding'
  then

    select
      s.organization_id,
      s.outlet_id

    into
      v_source_org,
      v_source_outlet

    from public.audit_findings f

    join public.audit_sessions s
      on s.id =
        f.audit_session_id

    where f.id =
      p_source_id

    limit 1;

  end if;


  if v_source_org is null
     or v_source_outlet is null
  then
    raise exception
      'Exception source not found.';
  end if;


  if v_source_org <>
      p_organization_id
  then
    raise exception
      'Exception source belongs to another organization.';
  end if;


  -- ==========================================================
  -- LOAD / CREATE WORKFLOW
  -- ==========================================================

  select *
  into v_workflow

  from public.exception_workflows w

  where w.organization_id =
      p_organization_id
    and w.source_type =
      p_source_type
    and w.source_id =
      p_source_id

  for update;


  if not found then

    insert into public.exception_workflows (
      organization_id,
      outlet_id,
      source_type,
      source_id,
      status,
      created_by
    )
    values (
      p_organization_id,
      v_source_outlet,
      p_source_type,
      p_source_id,
      'open',
      p_actor_user_id
    )
    returning *
    into v_workflow;


    insert into public.exception_workflow_events (
      workflow_id,
      event_type,
      from_status,
      to_status,
      actor_user_id,
      note,
      metadata
    )
    values (
      v_workflow.id,
      'created',
      null,
      'open',
      p_actor_user_id,
      null,
      jsonb_build_object(
        'source_type',
        p_source_type,
        'source_id',
        p_source_id
      )
    );


    v_created :=
      true;

  end if;


  v_from_status :=
    v_workflow.status;

  v_to_status :=
    v_workflow.status;

  v_old_assigned_to :=
    v_workflow.assigned_to;

  v_old_due_at :=
    v_workflow.due_at;

  v_old_sla_hours :=
    v_workflow.sla_hours;


  -- ==========================================================
  -- ASSIGN
  -- ==========================================================

  if p_action =
      'assign'
  then

    if p_assigned_to is null then
      raise exception
        'PIC is required.';
    end if;


    if not exists (
      select 1
      from public.profiles p
      where p.id =
          p_assigned_to
        and p.organization_id =
          p_organization_id
        and p.is_active =
          true
    ) then
      raise exception
        'Selected PIC is not an active organization user.';
    end if;


    if v_workflow.status in (
      'resolved',
      'verified',
      'closed'
    ) then
      raise exception
        'Closed-stage exception cannot be reassigned.';
    end if;


    v_to_status :=
      case
        when v_workflow.status =
          'open'
        then
          'assigned'
        else
          v_workflow.status
      end;


    v_event_type :=
      case
        when v_old_assigned_to
          is null
        then
          'assigned'
        else
          'assignment_changed'
      end;


    update public.exception_workflows
    set
      assigned_to =
        p_assigned_to,

      assigned_by =
        p_actor_user_id,

      assigned_at =
        now(),

      due_at =
        p_due_at,

      sla_hours =
        p_sla_hours,

      status =
        v_to_status

    where id =
      v_workflow.id;


    v_metadata :=
      jsonb_build_object(
        'previous_assigned_to',
        v_old_assigned_to,
        'assigned_to',
        p_assigned_to,
        'previous_due_at',
        v_old_due_at,
        'due_at',
        p_due_at,
        'previous_sla_hours',
        v_old_sla_hours,
        'sla_hours',
        p_sla_hours
      );


  -- ==========================================================
  -- SCHEDULE
  -- ==========================================================

  elsif p_action =
      'schedule'
  then

    if v_workflow.status in (
      'verified',
      'closed'
    ) then
      raise exception
        'Verified or closed exception cannot change SLA.';
    end if;


    update public.exception_workflows
    set
      due_at =
        p_due_at,

      sla_hours =
        p_sla_hours

    where id =
      v_workflow.id;


    v_event_type :=
      'due_date_changed';


    v_metadata :=
      jsonb_build_object(
        'previous_due_at',
        v_old_due_at,
        'due_at',
        p_due_at,
        'previous_sla_hours',
        v_old_sla_hours,
        'sla_hours',
        p_sla_hours
      );


  -- ==========================================================
  -- START PROGRESS
  -- ==========================================================

  elsif p_action =
      'start'
  then

    if v_workflow.status not in (
      'open',
      'assigned'
    ) then
      raise exception
        'Exception cannot enter progress from current status.';
    end if;


    if v_workflow.assigned_to
       is null
    then
      raise exception
        'Assign PIC before starting progress.';
    end if;


    v_to_status :=
      'in_progress';

    v_event_type :=
      'status_changed';


    update public.exception_workflows
    set status =
      v_to_status

    where id =
      v_workflow.id;


  -- ==========================================================
  -- ESCALATE
  -- ==========================================================

  elsif p_action =
      'escalate'
  then

    if v_workflow.status not in (
      'open',
      'assigned',
      'in_progress'
    ) then
      raise exception
        'Only active exceptions can be escalated.';
    end if;


    update public.exception_workflows
    set
      escalated_at =
        now(),

      escalated_by =
        p_actor_user_id

    where id =
      v_workflow.id;


    v_event_type :=
      'escalated';


    v_metadata :=
      jsonb_build_object(
        'escalated',
        true
      );


  -- ==========================================================
  -- RESOLVE
  -- ==========================================================

  elsif p_action =
      'resolve'
  then

    if v_workflow.status not in (
      'open',
      'assigned',
      'in_progress'
    ) then
      raise exception
        'Exception cannot be resolved from current status.';
    end if;


    if nullif(
      trim(
        coalesce(
          p_note,
          ''
        )
      ),
      ''
    ) is null
    then
      raise exception
        'Resolution note is required.';
    end if;


    v_to_status :=
      'resolved';

    v_event_type :=
      'resolution_added';


    update public.exception_workflows
    set
      status =
        v_to_status,

      resolution_note =
        trim(
          p_note
        ),

      resolved_at =
        now(),

      resolved_by =
        p_actor_user_id

    where id =
      v_workflow.id;


  -- ==========================================================
  -- VERIFY
  -- ==========================================================

  elsif p_action =
      'verify'
  then

    if v_workflow.status <>
       'resolved'
    then
      raise exception
        'Only resolved exception can be verified.';
    end if;


    v_to_status :=
      'verified';

    v_event_type :=
      'verified';


    update public.exception_workflows
    set
      status =
        v_to_status,

      verified_at =
        now(),

      verified_by =
        p_actor_user_id

    where id =
      v_workflow.id;


  -- ==========================================================
  -- CLOSE
  -- ==========================================================

  elsif p_action =
      'close'
  then

    if v_workflow.status <>
       'verified'
    then
      raise exception
        'Only verified exception can be closed.';
    end if;


    v_to_status :=
      'closed';

    v_event_type :=
      'closed';


    update public.exception_workflows
    set
      status =
        v_to_status,

      closed_at =
        now(),

      closed_by =
        p_actor_user_id

    where id =
      v_workflow.id;

  end if;


  -- ==========================================================
  -- ACTION EVENT
  -- ==========================================================

  insert into public.exception_workflow_events (
    workflow_id,
    event_type,
    from_status,
    to_status,
    actor_user_id,
    note,
    metadata
  )
  values (
    v_workflow.id,
    v_event_type,
    v_from_status,
    v_to_status,
    p_actor_user_id,
    nullif(
      trim(
        coalesce(
          p_note,
          ''
        )
      ),
      ''
    ),
    v_metadata
  );


  select *
  into v_workflow

  from public.exception_workflows

  where id =
    v_workflow.id;


  return
    to_jsonb(
      v_workflow
    );

end;

$function$;


revoke all
on function public.mutate_exception_workflow(
  uuid,
  text,
  uuid,
  text,
  uuid,
  uuid,
  timestamptz,
  integer,
  text
)
from public,
     anon,
     authenticated;


grant execute
on function public.mutate_exception_workflow(
  uuid,
  text,
  uuid,
  text,
  uuid,
  uuid,
  timestamptz,
  integer,
  text
)
to service_role;


commit;
