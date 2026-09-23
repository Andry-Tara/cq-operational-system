begin;

create table if not exists public.exception_workflow_evidence (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.exception_workflows(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  source_type text not null,
  source_id uuid not null,
  evidence_type text not null default 'resolution_photo',
  storage_bucket text not null default 'operational-photos',
  storage_path text not null,
  original_filename text,
  mime_type text,
  file_size bigint,
  note text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz not null default now(),
  constraint exception_workflow_evidence_source_type_chk
    check (source_type in ('operations_issue', 'audit_finding')),
  constraint exception_workflow_evidence_type_chk
    check (evidence_type in ('resolution_photo')),
  constraint exception_workflow_evidence_storage_path_chk
    check (length(btrim(storage_path)) > 0),
  constraint exception_workflow_evidence_file_size_chk
    check (file_size is null or file_size >= 0)
);

create index if not exists exception_workflow_evidence_workflow_idx
on public.exception_workflow_evidence (
  workflow_id,
  uploaded_at desc
);

create index if not exists exception_workflow_evidence_source_idx
on public.exception_workflow_evidence (
  organization_id,
  source_type,
  source_id,
  uploaded_at desc
);

alter table public.exception_workflow_evidence
  enable row level security;

revoke all
on public.exception_workflow_evidence
from public,
     anon,
     authenticated;

grant all
on public.exception_workflow_evidence
to service_role;

commit;
