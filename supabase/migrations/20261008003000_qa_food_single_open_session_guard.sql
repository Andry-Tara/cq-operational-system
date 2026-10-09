begin;

-- ============================================================
-- QA FOOD — ONE OPEN SESSION PER AUDITOR / OUTLET
-- ============================================================

-- Safely cancel empty duplicate OPEN sessions when another
-- OPEN session already exists for the same user + outlet.
update public.qa_food_sessions s
set
  status = 'CANCELLED',
  cancelled_at = now(),
  cancellation_reason =
    'Automatically cancelled duplicate empty OPEN QA session.'
where
  s.status = 'OPEN'

  and not exists (
    select 1
    from public.qa_food_session_items i
    where i.session_id = s.id
      and i.state <> 'VOIDED'
  )

  and exists (
    select 1
    from public.qa_food_sessions other
    where other.organization_id =
      s.organization_id

      and other.outlet_id =
        s.outlet_id

      and other.created_by =
        s.created_by

      and other.status =
        'OPEN'

      and other.id <>
        s.id

      and (
        other.started_at <
          s.started_at

        or exists (
          select 1
          from public.qa_food_session_items oi
          where oi.session_id =
            other.id
            and oi.state <>
              'VOIDED'
        )
      )
  );


-- Hard race-safe protection.
create unique index if not exists
qa_food_sessions_one_open_per_auditor_outlet_uidx

on public.qa_food_sessions (
  organization_id,
  outlet_id,
  created_by
)

where status = 'OPEN';


commit;
