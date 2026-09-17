begin;

-- ============================================================
-- A5.7.4 — SECURE AUDIT REPORT SHARING
--
-- Raw public tokens are NEVER stored.
-- Only SHA-256 hashes are persisted.
--
-- Public links:
-- - default validity: 7 days
-- - can be revoked
-- - only expose the persisted PDF
-- - do not expose dashboard/history/evidence APIs
-- ============================================================

create table public.audit_report_shares (
  id uuid
    primary key
    default gen_random_uuid(),

  audit_session_id uuid
    not null
    references public.audit_sessions(id)
    on delete cascade,

  organization_id uuid
    not null
    references public.organizations(id)
    on delete restrict,

  created_by uuid
    not null
    references auth.users(id)
    on delete restrict,

  token_hash text
    not null
    unique,

  expires_at timestamptz
    not null,

  revoked_at timestamptz,

  created_at timestamptz
    not null
    default now(),

  constraint audit_report_shares_expiry_check
    check (
      expires_at > created_at
    )
);

create index audit_report_shares_session_idx
  on public.audit_report_shares (
    audit_session_id,
    created_at desc
  );

create index audit_report_shares_expiry_idx
  on public.audit_report_shares (
    expires_at
  );

-- At most one non-revoked share per audit.
-- Expired links are revoked automatically when a new share is created.
create unique index audit_report_shares_active_session_key
  on public.audit_report_shares (
    audit_session_id
  )
  where revoked_at is null;

alter table public.audit_report_shares
enable row level security;

revoke all
on table public.audit_report_shares
from anon, authenticated;

comment on table public.audit_report_shares is
'Secure public sharing records for submitted Outlet Audit PDFs. Raw share tokens are never persisted.';

comment on column public.audit_report_shares.token_hash is
'SHA-256 hash of the public share token.';

commit;
