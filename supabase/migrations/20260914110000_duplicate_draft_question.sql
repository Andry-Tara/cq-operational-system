begin;

create or replace function public.duplicate_draft_question(
  p_form_version_id uuid,
  p_question_id uuid
)
returns public.questions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_source public.questions%rowtype;
  v_new public.questions%rowtype;
  v_option public.question_options%rowtype;
  v_new_option_id uuid;
  v_base_code text;
  v_code text;
  v_suffix integer := 2;
  v_sort_order integer;
begin
  if auth.uid() is null then
    raise exception 'Authenticated caller is required.' using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(p_form_version_id);

  select q.*
    into v_source
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where q.id = p_question_id
    and fvs.form_version_id = p_form_version_id;

  if not found then
    raise exception 'Question was not found in this draft version.'
      using errcode = '22023';
  end if;

  v_base_code := v_source.code || '_COPY';
  v_code := v_base_code;

  while exists (
    select 1
    from public.questions q
    where q.version_section_id = v_source.version_section_id
      and q.code = v_code
  ) loop
    v_code := v_base_code || '_' || v_suffix::text;
    v_suffix := v_suffix + 1;
  end loop;

  select coalesce(max(q.sort_order), -1) + 1
    into v_sort_order
  from public.questions q
  where q.version_section_id = v_source.version_section_id
    and q.question_group_id is not distinct from v_source.question_group_id;

  insert into public.questions (
    version_section_id,
    code,
    question_text,
    help_text,
    question_type,
    is_required,
    unit,
    min_value,
    max_value,
    placeholder,
    config,
    sort_order,
    is_active,
    question_group_id
  )
  values (
    v_source.version_section_id,
    v_code,
    v_source.question_text,
    v_source.help_text,
    v_source.question_type,
    v_source.is_required,
    v_source.unit,
    v_source.min_value,
    v_source.max_value,
    v_source.placeholder,
    v_source.config,
    v_sort_order,
    v_source.is_active,
    v_source.question_group_id
  )
  returning * into v_new;

  insert into public.question_translations (
    question_id,
    locale,
    question_text,
    help_text
  )
  select
    v_new.id,
    qt.locale,
    qt.question_text,
    qt.help_text
  from public.question_translations qt
  where qt.question_id = p_question_id;

  for v_option in
    select qo.*
    from public.question_options qo
    where qo.question_id = p_question_id
    order by qo.sort_order, qo.id
  loop
    insert into public.question_options (
      question_id,
      value,
      label,
      sort_order,
      is_failure
    )
    values (
      v_new.id,
      v_option.value,
      v_option.label,
      v_option.sort_order,
      v_option.is_failure
    )
    returning id into v_new_option_id;

    insert into public.question_option_translations (
      option_id,
      locale,
      label
    )
    select
      v_new_option_id,
      qot.locale,
      qot.label
    from public.question_option_translations qot
    where qot.option_id = v_option.id;
  end loop;

  insert into public.question_rules (
    question_id,
    rule_type,
    condition,
    action_config,
    sort_order,
    is_active
  )
  select
    v_new.id,
    qr.rule_type,
    qr.condition,
    qr.action_config,
    qr.sort_order,
    qr.is_active
  from public.question_rules qr
  where qr.question_id = p_question_id;

  return v_new;
end;
$$;

revoke all on function public.duplicate_draft_question(uuid, uuid) from public;
revoke all on function public.duplicate_draft_question(uuid, uuid) from anon;
revoke all on function public.duplicate_draft_question(uuid, uuid) from authenticated;
grant execute on function public.duplicate_draft_question(uuid, uuid) to authenticated;

commit;
