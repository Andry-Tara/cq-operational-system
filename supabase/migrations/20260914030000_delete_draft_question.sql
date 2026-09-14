begin;

create or replace function public.delete_draft_question(
  p_form_version_id uuid,
  p_question_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_found boolean;
begin
  if auth.uid() is null then
    raise exception 'Authenticated caller is required.' using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(p_form_version_id);

  select exists (
    select 1
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where q.id = p_question_id
      and fvs.form_version_id = p_form_version_id
  )
  into v_found;

  if not v_found then
    raise exception 'Question was not found in this draft version.'
      using errcode = '22023';
  end if;

  delete from public.question_option_translations qot
  using public.question_options qo
  where qot.option_id = qo.id
    and qo.question_id = p_question_id;

  delete from public.question_options
  where question_id = p_question_id;

  delete from public.question_translations
  where question_id = p_question_id;

  delete from public.question_rules
  where question_id = p_question_id;

  delete from public.questions
  where id = p_question_id;
end;
$$;

revoke all on function public.delete_draft_question(uuid, uuid) from public;
revoke all on function public.delete_draft_question(uuid, uuid) from anon;
revoke all on function public.delete_draft_question(uuid, uuid) from authenticated;
grant execute on function public.delete_draft_question(uuid, uuid) to authenticated;

commit;
