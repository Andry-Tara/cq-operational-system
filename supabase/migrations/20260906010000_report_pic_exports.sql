-- ============================================================
-- CQ OPERATIONAL SYSTEM
-- Central Kitchen - PDF export per PIC
--
-- One CK parent report may have multiple PDF exports:
--   report A + Muzza
--   report A + Wahyu
--
-- Do NOT store CK PIC PDFs in reports.pdf_storage_path because
-- that field represents only one PDF path per parent report.
-- ============================================================

create table if not exists public.report_pic_exports (
  id uuid primary key default gen_random_uuid(),

  report_id uuid not null
    references public.reports(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  pic_name text,

  pdf_storage_path text not null,

  pdf_generated_at timestamptz not null
    default now(),

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint report_pic_exports_report_user_unique
    unique (report_id, user_id)
);

create index if not exists
  report_pic_exports_report_id_idx
on public.report_pic_exports(report_id);

create index if not exists
  report_pic_exports_user_id_idx
on public.report_pic_exports(user_id);

alter table public.report_pic_exports
  enable row level security;

drop policy if exists
  "report_pic_exports_select_own"
on public.report_pic_exports;

create policy
  "report_pic_exports_select_own"
on public.report_pic_exports
for select
to authenticated
using (
  user_id = auth.uid()
);

drop policy if exists
  "report_pic_exports_insert_own"
on public.report_pic_exports;

create policy
  "report_pic_exports_insert_own"
on public.report_pic_exports
for insert
to authenticated
with check (
  user_id = auth.uid()
);

drop policy if exists
  "report_pic_exports_update_own"
on public.report_pic_exports;

create policy
  "report_pic_exports_update_own"
on public.report_pic_exports
for update
to authenticated
using (
  user_id = auth.uid()
)
with check (
  user_id = auth.uid()
);

comment on table public.report_pic_exports is
  'Stores one generated operational PDF per parent report and PIC/user. Used by section-scoped Central Kitchen operations.';

comment on column public.report_pic_exports.report_id is
  'Shared parent operational report.';

comment on column public.report_pic_exports.user_id is
  'Authenticated PIC who owns this PDF export.';

comment on column public.report_pic_exports.pdf_storage_path is
  'Private operational-reports storage path for this PIC PDF.';
