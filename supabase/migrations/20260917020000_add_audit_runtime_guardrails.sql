begin;

create unique index audit_sessions_one_draft_per_auditor_outlet_idx
  on public.audit_sessions (auditor_user_id, outlet_id)
  where status = 'draft';

commit;
