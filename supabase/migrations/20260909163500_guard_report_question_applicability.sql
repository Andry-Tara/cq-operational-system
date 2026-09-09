begin;

-- ============================================================
-- REPORT QUESTION APPLICABILITY — VERSION SECTION GUARD
--
-- Prevents a snapshot row from linking:
--
-- report_section from Form Version / Section A
-- to a question belonging to Form Version / Section B.
--
-- Historical applicability must always correspond to the exact
-- version_section stored by the report section.
-- ============================================================

create or replace function
public.validate_report_question_applicability_section()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report_version_section_id uuid;
  v_question_version_section_id uuid;
begin
  select rs.version_section_id
    into v_report_version_section_id
  from public.report_sections rs
  where rs.id = new.report_section_id;

  if not found then
    raise exception
      'Report section % does not exist.',
      new.report_section_id;
  end if;

  select q.version_section_id
    into v_question_version_section_id
  from public.questions q
  where q.id = new.question_id;

  if not found then
    raise exception
      'Question % does not exist.',
      new.question_id;
  end if;

  if v_report_version_section_id is null then
    raise exception
      'Report section % has no version_section_id.',
      new.report_section_id;
  end if;

  if v_question_version_section_id
     is distinct from
     v_report_version_section_id
  then
    raise exception
      'Question does not belong to the report section form version.';
  end if;

  return new;
end;
$$;

create trigger
  report_question_applicability_validate_section
before insert or update of
  report_section_id,
  question_id
on public.report_question_applicability
for each row
execute function
  public.validate_report_question_applicability_section();

commit;
