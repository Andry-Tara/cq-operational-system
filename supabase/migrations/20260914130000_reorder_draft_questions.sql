begin;

create or replace function public.reorder_draft_questions(
  p_form_version_id uuid,
  p_question_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_version_section_id uuid;
  v_question_group_id uuid;
  v_scope_count integer;
  v_unique_count integer;
  v_index integer;
begin
  if auth.uid() is null then
    raise exception 'Authenticated caller is required.' using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(p_form_version_id);

  if p_question_ids is null or cardinality(p_question_ids) = 0 then
    raise exception 'At least one question is required.'
      using errcode = '22023';
  end if;

  select count(distinct id)
    into v_unique_count
  from unnest(p_question_ids) as ids(id);

  if v_unique_count <> cardinality(p_question_ids) then
    raise exception 'Question list contains duplicate ids.'
      using errcode = '22023';
  end if;

  select q.version_section_id, q.question_group_id
    into v_version_section_id, v_question_group_id
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where q.id = p_question_ids[1]
    and fvs.form_version_id = p_form_version_id;

  if not found then
    raise exception 'Question was not found in this draft version.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_question_ids) as ids(id)
    left join public.questions q on q.id = ids.id
    left join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where q.id is null
       or fvs.form_version_id is distinct from p_form_version_id
       or q.version_section_id is distinct from v_version_section_id
       or q.question_group_id is distinct from v_question_group_id
  ) then
    raise exception 'All questions must belong to the same draft section and question group.'
      using errcode = '22023';
  end if;

  select count(*)
    into v_scope_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = p_form_version_id
    and q.version_section_id = v_version_section_id
    and q.question_group_id is not distinct from v_question_group_id;

  if v_scope_count <> cardinality(p_question_ids) then
    raise exception 'Question list must contain every question in the reorder scope.'
      using errcode = '22023';
  end if;

  perform 1
  from public.questions q
  where q.version_section_id = v_version_section_id
    and q.question_group_id is not distinct from v_question_group_id
  for update;

  for v_index in 1..cardinality(p_question_ids) loop
    update public.questions
    set sort_order = v_index - 1
    where id = p_question_ids[v_index];
  end loop;
end;
$$;

revoke all on function public.reorder_draft_questions(uuid, uuid[]) from public;
revoke all on function public.reorder_draft_questions(uuid, uuid[]) from anon;
revoke all on function public.reorder_draft_questions(uuid, uuid[]) from authenticated;
grant execute on function public.reorder_draft_questions(uuid, uuid[]) to authenticated;

commit;
