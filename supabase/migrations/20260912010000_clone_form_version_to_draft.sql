begin;

-- ============================================================
-- CLONE PUBLISHED FORM VERSION TO DRAFT
-- ============================================================

create or replace function public.clone_form_version_to_draft(
  p_source_form_version_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_caller_id uuid;
  v_source_form_id uuid;
  v_organization_id uuid;
  v_source_status text;
  v_new_version_id uuid;
  v_new_version_number integer;
  v_form_id uuid;
  v_new_section_id uuid;
  v_new_group_id uuid;
  v_new_question_id uuid;
  v_new_option_id uuid;
  v_new_group_parent_id uuid;
  v_new_question_parent_id uuid;
  v_new_option_parent_id uuid;
  v_row record;
  v_source_count bigint;
  v_clone_count bigint;
begin
  v_caller_id := auth.uid();

  if v_caller_id is null then
    raise exception
      'Authenticated caller is required.'
      using errcode = '28000';
  end if;

  select
    fv.form_id,
    f.organization_id,
    fv.status
    into
    v_source_form_id,
    v_organization_id,
    v_source_status
  from public.form_versions fv
  join public.forms f
    on f.id = fv.form_id
  where fv.id = p_source_form_version_id;

  if not found then
    raise exception
      'Source form version was not found.'
      using errcode = '22023';
  end if;

  if v_source_status is distinct from 'published' then
    raise exception
      'Only published form versions can be cloned.'
      using errcode = '55000';
  end if;

  if public.is_org_admin(v_organization_id) is distinct from true then
    raise exception
      'Not authorized to clone this form version.'
      using errcode = '42501';
  end if;

  select f.id
    into v_form_id
  from public.forms f
  where f.id = v_source_form_id
  for update;

  if v_form_id is null then
    raise exception
      'Source form was not found.'
      using errcode = '22023';
  end if;

  select coalesce(max(fv.version_number), 0) + 1
    into v_new_version_number
  from public.form_versions fv
  where fv.form_id = v_form_id;

  insert into public.form_versions (
    form_id,
    version_number,
    status,
    notes
  )
  select
    fv.form_id,
    v_new_version_number,
    'draft',
    fv.notes
  from public.form_versions fv
  where fv.id = p_source_form_version_id
  returning id into v_new_version_id;

  create temporary table tmp_version_section_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  create temporary table tmp_group_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  create temporary table tmp_question_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  create temporary table tmp_option_map (
    old_id uuid primary key,
    new_id uuid not null
  ) on commit drop;

  for v_row in
    select fvs.*
    from public.form_version_sections fvs
    where fvs.form_version_id = p_source_form_version_id
    order by fvs.sort_order, fvs.id
  loop
    insert into public.form_version_sections (
      form_version_id,
      section_id,
      display_name,
      description,
      sort_order,
      is_required,
      is_active
    )
    values (
      v_new_version_id,
      v_row.section_id,
      v_row.display_name,
      v_row.description,
      v_row.sort_order,
      v_row.is_required,
      v_row.is_active
    )
    returning id into v_new_section_id;

    insert into tmp_version_section_map (old_id, new_id)
    values (v_row.id, v_new_section_id);
  end loop;

  for v_row in
    select fvst.*
    from public.form_version_section_translations fvst
    join tmp_version_section_map m
      on m.old_id = fvst.version_section_id
  loop
    insert into public.form_version_section_translations (
      version_section_id,
      locale,
      display_name,
      description
    )
    values (
      (select m.new_id from tmp_version_section_map m where m.old_id = v_row.version_section_id),
      v_row.locale,
      v_row.display_name,
      v_row.description
    );
  end loop;

  for v_row in
    select qg.*
    from public.question_groups qg
    join public.form_version_sections fvs
      on fvs.id = qg.version_section_id
    where fvs.form_version_id = p_source_form_version_id
    order by qg.sort_order, qg.id
  loop
    select m.new_id
      into v_new_section_id
    from tmp_version_section_map m
    where m.old_id = v_row.version_section_id;

    if v_new_section_id is null then
      raise exception
        'Question group parent section mapping is missing.'
        using errcode = '23514';
    end if;

    insert into public.question_groups (
      version_section_id,
      code,
      name,
      sort_order,
      is_active
    )
    values (
      v_new_section_id,
      v_row.code,
      v_row.name,
      v_row.sort_order,
      v_row.is_active
    )
    returning id into v_new_group_id;

    insert into tmp_group_map (old_id, new_id)
    values (v_row.id, v_new_group_id);
  end loop;

  for v_row in
    select qgt.*
    from public.question_group_translations qgt
    join tmp_group_map m
      on m.old_id = qgt.question_group_id
  loop
    insert into public.question_group_translations (
      question_group_id,
      locale,
      display_name,
      description
    )
    values (
      (select m.new_id from tmp_group_map m where m.old_id = v_row.question_group_id),
      v_row.locale,
      v_row.display_name,
      v_row.description
    );
  end loop;

  for v_row in
    select q.*
    from public.questions q
    join public.form_version_sections fvs
      on fvs.id = q.version_section_id
    where fvs.form_version_id = p_source_form_version_id
    order by q.sort_order, q.id
  loop
    select m.new_id
      into v_new_section_id
    from tmp_version_section_map m
    where m.old_id = v_row.version_section_id;

    if v_new_section_id is null then
      raise exception
        'Question parent section mapping is missing.'
        using errcode = '23514';
    end if;

    v_new_group_parent_id := null;

    if v_row.question_group_id is not null then
      select m.new_id
        into v_new_group_parent_id
      from tmp_group_map m
      where m.old_id = v_row.question_group_id;

      if v_new_group_parent_id is null then
        raise exception
          'Question group mapping is missing.'
          using errcode = '23514';
      end if;
    end if;

    insert into public.questions (
      version_section_id,
      question_group_id,
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
      is_active
    )
    values (
      v_new_section_id,
      v_new_group_parent_id,
      v_row.code,
      v_row.question_text,
      v_row.help_text,
      v_row.question_type,
      v_row.is_required,
      v_row.unit,
      v_row.min_value,
      v_row.max_value,
      v_row.placeholder,
      v_row.config,
      v_row.sort_order,
      v_row.is_active
    )
    returning id into v_new_question_id;

    insert into tmp_question_map (old_id, new_id)
    values (v_row.id, v_new_question_id);
  end loop;

  for v_row in
    select qt.*
    from public.question_translations qt
    join tmp_question_map m
      on m.old_id = qt.question_id
  loop
    insert into public.question_translations (
      question_id,
      locale,
      question_text,
      help_text
    )
    values (
      (select m.new_id from tmp_question_map m where m.old_id = v_row.question_id),
      v_row.locale,
      v_row.question_text,
      v_row.help_text
    );
  end loop;

  for v_row in
    select qr.*
    from public.question_rules qr
    join tmp_question_map m
      on m.old_id = qr.question_id
  loop
    insert into public.question_rules (
      question_id,
      rule_type,
      condition,
      action_config,
      sort_order,
      is_active
    )
    values (
      (select m.new_id from tmp_question_map m where m.old_id = v_row.question_id),
      v_row.rule_type,
      v_row.condition,
      v_row.action_config,
      v_row.sort_order,
      v_row.is_active
    );
  end loop;

  for v_row in
    select qo.*
    from public.question_options qo
    join tmp_question_map m
      on m.old_id = qo.question_id
  loop
    select m.new_id
      into v_new_question_parent_id
    from tmp_question_map m
    where m.old_id = v_row.question_id;

    insert into public.question_options (
      question_id,
      value,
      label,
      sort_order,
      is_failure
    )
    values (
      v_new_question_parent_id,
      v_row.value,
      v_row.label,
      v_row.sort_order,
      v_row.is_failure
    )
    returning id into v_new_option_id;

    insert into tmp_option_map (old_id, new_id)
    values (v_row.id, v_new_option_id);
  end loop;

  for v_row in
    select qot.*
    from public.question_option_translations qot
    join tmp_option_map m
      on m.old_id = qot.option_id
  loop
    select m.new_id
      into v_new_option_parent_id
    from tmp_option_map m
    where m.old_id = v_row.option_id;

    insert into public.question_option_translations (
      option_id,
      locale,
      label
    )
    values (
      v_new_option_parent_id,
      v_row.locale,
      v_row.label
    );
  end loop;

  select count(*) into v_source_count
  from public.form_version_sections fvs
  where fvs.form_version_id = p_source_form_version_id;

  select count(*) into v_clone_count
  from public.form_version_sections fvs
  where fvs.form_version_id = v_new_version_id;

  if v_source_count <> v_clone_count then
    raise exception 'Cloned form_version_sections count mismatch.' using errcode = '23514';
  end if;

  select count(*) into v_source_count
  from public.form_version_section_translations fvst
  join public.form_version_sections fvs on fvs.id = fvst.version_section_id
  where fvs.form_version_id = p_source_form_version_id;

  select count(*) into v_clone_count
  from public.form_version_section_translations fvst
  join public.form_version_sections fvs on fvs.id = fvst.version_section_id
  where fvs.form_version_id = v_new_version_id;

  if v_source_count <> v_clone_count then
    raise exception 'Cloned section translation count mismatch.' using errcode = '23514';
  end if;

  select count(*) into v_source_count
  from public.question_groups qg
  join public.form_version_sections fvs on fvs.id = qg.version_section_id
  where fvs.form_version_id = p_source_form_version_id;

  select count(*) into v_clone_count
  from public.question_groups qg
  join public.form_version_sections fvs on fvs.id = qg.version_section_id
  where fvs.form_version_id = v_new_version_id;

  if v_source_count <> v_clone_count then
    raise exception 'Cloned question_groups count mismatch.' using errcode = '23514';
  end if;

  select count(*) into v_source_count
  from public.question_group_translations qgt
  join public.question_groups qg on qg.id = qgt.question_group_id
  join public.form_version_sections fvs on fvs.id = qg.version_section_id
  where fvs.form_version_id = p_source_form_version_id;

  select count(*) into v_clone_count
  from public.question_group_translations qgt
  join public.question_groups qg on qg.id = qgt.question_group_id
  join public.form_version_sections fvs on fvs.id = qg.version_section_id
  where fvs.form_version_id = v_new_version_id;

  if v_source_count <> v_clone_count then
    raise exception 'Cloned group translation count mismatch.' using errcode = '23514';
  end if;

  select count(*) into v_source_count
  from public.questions q
  join public.form_version_sections fvs on fvs.id = q.version_section_id
  where fvs.form_version_id = p_source_form_version_id;

  select count(*) into v_clone_count
  from public.questions q
  join public.form_version_sections fvs on fvs.id = q.version_section_id
  where fvs.form_version_id = v_new_version_id;

  if v_source_count <> v_clone_count then
    raise exception 'Cloned questions count mismatch.' using errcode = '23514';
  end if;

  select count(*) into v_source_count
  from public.question_translations qt
  join public.questions q on q.id = qt.question_id
  join public.form_version_sections fvs on fvs.id = q.version_section_id
  where fvs.form_version_id = p_source_form_version_id;

  select count(*) into v_clone_count
  from public.question_translations qt
  join public.questions q on q.id = qt.question_id
  join public.form_version_sections fvs on fvs.id = q.version_section_id
  where fvs.form_version_id = v_new_version_id;

  if v_source_count <> v_clone_count then
    raise exception 'Cloned question translation count mismatch.' using errcode = '23514';
  end if;

  select count(*) into v_source_count
  from public.question_rules qr
  join public.questions q on q.id = qr.question_id
  join public.form_version_sections fvs on fvs.id = q.version_section_id
  where fvs.form_version_id = p_source_form_version_id;

  select count(*) into v_clone_count
  from public.question_rules qr
  join public.questions q on q.id = qr.question_id
  join public.form_version_sections fvs on fvs.id = q.version_section_id
  where fvs.form_version_id = v_new_version_id;

  if v_source_count <> v_clone_count then
    raise exception 'Cloned question_rules count mismatch.' using errcode = '23514';
  end if;

  select count(*) into v_source_count
  from public.question_options qo
  join public.questions q on q.id = qo.question_id
  join public.form_version_sections fvs on fvs.id = q.version_section_id
  where fvs.form_version_id = p_source_form_version_id;

  select count(*) into v_clone_count
  from public.question_options qo
  join public.questions q on q.id = qo.question_id
  join public.form_version_sections fvs on fvs.id = q.version_section_id
  where fvs.form_version_id = v_new_version_id;

  if v_source_count <> v_clone_count then
    raise exception 'Cloned question_options count mismatch.' using errcode = '23514';
  end if;

  select count(*) into v_source_count
  from public.question_option_translations qot
  join public.question_options qo on qo.id = qot.option_id
  join public.questions q on q.id = qo.question_id
  join public.form_version_sections fvs on fvs.id = q.version_section_id
  where fvs.form_version_id = p_source_form_version_id;

  select count(*) into v_clone_count
  from public.question_option_translations qot
  join public.question_options qo on qo.id = qot.option_id
  join public.questions q on q.id = qo.question_id
  join public.form_version_sections fvs on fvs.id = q.version_section_id
  where fvs.form_version_id = v_new_version_id;

  if v_source_count <> v_clone_count then
    raise exception 'Cloned option translation count mismatch.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.form_version_sections source_fvs
    join tmp_version_section_map m on m.old_id = source_fvs.id
    join public.form_version_sections clone_fvs on clone_fvs.id = m.new_id
    where source_fvs.section_id is distinct from clone_fvs.section_id
  ) then
    raise exception 'Stable section references changed during clone.' using errcode = '23514';
  end if;

  return v_new_version_id;
end;
$$;

revoke all on function public.clone_form_version_to_draft(uuid)
from public;

revoke all on function public.clone_form_version_to_draft(uuid)
from anon;

grant execute on function public.clone_form_version_to_draft(uuid)
to authenticated;

commit;
