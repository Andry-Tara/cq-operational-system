begin;

create or replace function public.reorder_draft_sections(
  p_form_version_id uuid,
  p_version_section_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_scope_count integer;
  v_unique_count integer;
  v_index integer;
begin
  if auth.uid() is null then
    raise exception 'Authenticated caller is required.' using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(p_form_version_id);

  if p_version_section_ids is null
     or cardinality(p_version_section_ids) = 0 then
    raise exception 'At least one section is required.'
      using errcode = '22023';
  end if;

  select count(distinct id)
    into v_unique_count
  from unnest(p_version_section_ids) as ids(id);

  if v_unique_count <> cardinality(p_version_section_ids) then
    raise exception 'Section list contains duplicate ids.'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from unnest(p_version_section_ids) as ids(id)
    left join public.form_version_sections fvs
      on fvs.id = ids.id
    where fvs.id is null
       or fvs.form_version_id is distinct from p_form_version_id
  ) then
    raise exception 'All sections must belong to this draft version.'
      using errcode = '22023';
  end if;

  select count(*)
    into v_scope_count
  from public.form_version_sections fvs
  where fvs.form_version_id = p_form_version_id;

  if v_scope_count <> cardinality(p_version_section_ids) then
    raise exception 'Section list must contain every section in the draft version.'
      using errcode = '22023';
  end if;

  perform 1
  from public.form_version_sections fvs
  where fvs.form_version_id = p_form_version_id
  for update;

  for v_index in 1..cardinality(p_version_section_ids) loop
    update public.form_version_sections
    set sort_order = v_index - 1
    where id = p_version_section_ids[v_index]
      and form_version_id = p_form_version_id;
  end loop;
end;
$$;

revoke all on function public.reorder_draft_sections(uuid, uuid[]) from public;
revoke all on function public.reorder_draft_sections(uuid, uuid[]) from anon;
revoke all on function public.reorder_draft_sections(uuid, uuid[]) from authenticated;
grant execute on function public.reorder_draft_sections(uuid, uuid[]) to authenticated;

commit;
