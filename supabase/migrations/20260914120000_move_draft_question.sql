begin;

create or replace function public.move_draft_question(
  p_form_version_id uuid,
  p_question_id uuid,
  p_direction text
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source public.questions%rowtype;
  v_ids uuid[];
  v_position integer;
  v_target_position integer;
  v_temp uuid;
  v_index integer;
begin
  if auth.uid() is null then
    raise exception 'Authenticated caller is required.' using errcode = '28000';
  end if;

  if p_direction not in ('up', 'down') then
    raise exception 'Invalid move direction.' using errcode = '22023';
  end if;

  perform public.assert_draft_form_version_access(p_form_version_id);

  select q.*
    into v_source
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where q.id = p_question_id
    and fvs.form_version_id = p_form_version_id
  for update of q;

  if not found then
    raise exception 'Question was not found in this draft version.'
      using errcode = '22023';
  end if;

  select array_agg(q.id order by q.sort_order, q.created_at, q.id)
    into v_ids
  from public.questions q
  where q.version_section_id = v_source.version_section_id
    and q.question_group_id is not distinct from v_source.question_group_id;

  v_position := array_position(v_ids, p_question_id);

  if v_position is null then
    raise exception 'Question ordering could not be resolved.'
      using errcode = '22023';
  end if;

  if p_direction = 'up' then
    v_target_position := v_position - 1;
  else
    v_target_position := v_position + 1;
  end if;

  if v_target_position < 1
     or v_target_position > coalesce(array_length(v_ids, 1), 0) then
    return;
  end if;

  v_temp := v_ids[v_position];
  v_ids[v_position] := v_ids[v_target_position];
  v_ids[v_target_position] := v_temp;

  for v_index in 1..array_length(v_ids, 1) loop
    update public.questions
    set sort_order = v_index - 1
    where id = v_ids[v_index];
  end loop;
end;
$$;

revoke all on function public.move_draft_question(uuid, uuid, text) from public;
revoke all on function public.move_draft_question(uuid, uuid, text) from anon;
revoke all on function public.move_draft_question(uuid, uuid, text) from authenticated;
grant execute on function public.move_draft_question(uuid, uuid, text) to authenticated;

commit;
