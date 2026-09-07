begin;

-- ============================================================
-- SECTION-LEVEL CORRECTION STATE
-- ============================================================

alter table public.report_sections
  add column if not exists correction_requested_by uuid
    references auth.users(id)
    on delete set null,

  add column if not exists correction_requested_at timestamptz,

  add column if not exists correction_reason text,

  add column if not exists correction_question_ids uuid[],

  add column if not exists correction_round integer
    not null
    default 0;


create index if not exists
  report_sections_correction_requested_by_idx
on public.report_sections(correction_requested_by);

create index if not exists
  report_sections_correction_requested_at_idx
on public.report_sections(correction_requested_at);


comment on column public.report_sections.correction_requested_by is
  'Leader who returned this section for correction.';

comment on column public.report_sections.correction_requested_at is
  'Timestamp when this section was returned for correction.';

comment on column public.report_sections.correction_reason is
  'Reason supplied by the leader when returning the section.';

comment on column public.report_sections.correction_question_ids is
  'Question IDs explicitly reopened for targeted correction.';

comment on column public.report_sections.correction_round is
  'Number of correction cycles for this report section.';


-- ============================================================
-- IMMUTABLE SECTION EVENT HISTORY
-- ============================================================

create table if not exists public.report_section_events (
  id uuid primary key
    default gen_random_uuid(),

  report_section_id uuid not null
    references public.report_sections(id)
    on delete cascade,

  event_type text not null
    check (
      event_type in (
        'submitted',
        'reviewed',
        'returned_for_correction',
        'resubmitted',
        'reviewed_again'
      )
    ),

  actor_user_id uuid
    references auth.users(id)
    on delete set null,

  actor_name text,

  reason text,

  question_ids uuid[],

  metadata jsonb not null
    default '{}'::jsonb,

  created_at timestamptz not null
    default now()
);


create index if not exists
  report_section_events_report_section_idx
on public.report_section_events(
  report_section_id,
  created_at
);

create index if not exists
  report_section_events_actor_idx
on public.report_section_events(
  actor_user_id
);


-- Mutations will go through trusted server endpoints.
alter table public.report_section_events
  enable row level security;


comment on table public.report_section_events is
  'Immutable audit history for Production section submit, review, correction, resubmit, and re-review lifecycle.';

commit;
