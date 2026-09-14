begin;

create or replace function public.add_draft_question_group(
  p_form_version_id uuid,
  p_version_section_id uuid,
  p_code text,
  p_name text,
  p_is_active boolean default true
)
returns public.question_groups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_group public.question_groups%rowtype;
  v_code text;
  v_name text;
  v_sort_order integer;
begin
  if auth.uid() is null then
    raise exception 'Authenticated caller is required.'
      using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(p_form_version_id);

  v_code := btrim(coalesce(p_code, ''));
  v_name := btrim(coalesce(p_name, ''));

  if v_code = '' then
    raise exception 'Group code is required.'
      using errcode = '22023';
  end if;

  if v_name = '' then
    raise exception 'Group name is required.'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.form_version_sections fvs
    where fvs.id = p_version_section_id
      and fvs.form_version_id = p_form_version_id
  ) then
    raise exception 'Section was not found in this draft version.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.question_groups qg
    where qg.version_section_id = p_version_section_id
      and lower(qg.code) = lower(v_code)
  ) then
    raise exception 'A question group with this code already exists in the section.'
      using errcode = '23505';
  end if;

  select coalesce(max(qg.sort_order), -1) + 1
    into v_sort_order
  from public.question_groups qg
  where qg.version_section_id = p_version_section_id;

  insert into public.question_groups (
    version_section_id,
    code,
    name,
    sort_order,
    is_active
  )
  values (
    p_version_section_id,
    v_code,
    v_name,
    v_sort_order,
    coalesce(p_is_active, true)
  )
  returning * into v_group;

  return v_group;
end;
$$;

revoke all on function public.add_draft_question_group(
  uuid,
  uuid,
  text,
  text,
  boolean
) from public;

revoke all on function public.add_draft_question_group(
  uuid,
  uuid,
  text,
  text,
  boolean
) from anon;

revoke all on function public.add_draft_question_group(
  uuid,
  uuid,
  text,
  text,
  boolean
) from authenticated;

grant execute on function public.add_draft_question_group(
  uuid,
  uuid,
  text,
  text,
  boolean
) to authenticated;

commit;
