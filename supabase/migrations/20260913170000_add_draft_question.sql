begin;

create or replace function public.add_draft_question(
  p_form_version_id uuid,
  p_version_section_id uuid,
  p_question_group_id uuid default null,
  p_code text default null,
  p_question_text text default null,
  p_question_type text default null,
  p_is_required boolean default false,
  p_help_text text default null,
  p_unit text default null,
  p_min_value numeric default null,
  p_max_value numeric default null
)
returns public.questions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_question public.questions;
  v_sort_order integer;
begin
  if auth.uid() is null then
    raise exception 'Authenticated caller is required.' using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(p_form_version_id);

  if p_code is null or btrim(p_code) = ''
     or p_question_text is null or btrim(p_question_text) = ''
     or p_question_type not in ('yes_no', 'temperature')
     or p_is_required is null then
    raise exception 'Invalid question input.' using errcode = '22023';
  end if;

  if p_min_value is not null and p_max_value is not null
     and p_min_value > p_max_value then
    raise exception 'Question minimum cannot exceed maximum.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.form_version_sections fvs
    where fvs.id = p_version_section_id
      and fvs.form_version_id = p_form_version_id
  ) then
    raise exception 'Version section was not found in this form version.' using errcode = '22023';
  end if;

  if p_question_group_id is not null and not exists (
    select 1 from public.question_groups qg
    where qg.id = p_question_group_id
      and qg.version_section_id = p_version_section_id
  ) then
    raise exception 'Question group was not found in this version section.' using errcode = '22023';
  end if;

  select coalesce(max(q.sort_order), -1) + 1 into v_sort_order
  from public.questions q
  where q.version_section_id = p_version_section_id;

  insert into public.questions (
    version_section_id, question_group_id, code, question_text, help_text,
    question_type, is_required, unit, min_value, max_value, sort_order, is_active
  ) values (
    p_version_section_id, p_question_group_id, btrim(p_code), btrim(p_question_text),
    p_help_text, p_question_type, p_is_required, p_unit, p_min_value, p_max_value,
    v_sort_order, true
  ) returning * into v_question;

  return v_question;
exception
  when unique_violation then
    raise exception 'Question code already exists in this form version.' using errcode = '23505';
end;
$$;

revoke all on function public.add_draft_question(uuid, uuid, uuid, text, text, text, boolean, text, text, numeric, numeric) from public;
revoke all on function public.add_draft_question(uuid, uuid, uuid, text, text, text, boolean, text, text, numeric, numeric) from anon;
revoke all on function public.add_draft_question(uuid, uuid, uuid, text, text, text, boolean, text, text, numeric, numeric) from authenticated;
grant execute on function public.add_draft_question(uuid, uuid, uuid, text, text, text, boolean, text, text, numeric, numeric) to authenticated;

commit;
