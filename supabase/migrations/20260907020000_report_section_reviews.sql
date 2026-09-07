begin;

alter table public.report_sections
  add column if not exists reviewed_by uuid
    references auth.users(id)
    on delete set null,
  add column if not exists reviewed_at timestamptz;

create index if not exists
  report_sections_reviewed_by_idx
on public.report_sections(reviewed_by);

create index if not exists
  report_sections_reviewed_at_idx
on public.report_sections(reviewed_at);

comment on column public.report_sections.reviewed_by is
  'User who explicitly reviewed this submitted section.';

comment on column public.report_sections.reviewed_at is
  'Timestamp when the section was explicitly marked reviewed.';

commit;
