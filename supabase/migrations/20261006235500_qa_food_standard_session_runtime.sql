begin;

-- ============================================================
-- QA FOOD STANDARD — SESSION RUNTIME GUARD
--
-- One auditor can only have one OPEN QA session
-- per outlet / business date.
-- ============================================================

create unique index if not exists
qa_food_sessions_one_open_per_user_outlet_day_idx
on public.qa_food_sessions (
  outlet_id,
  created_by,
  business_date
)
where status = 'OPEN';

commit;
