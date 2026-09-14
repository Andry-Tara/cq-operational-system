begin;

create or replace function public.add_draft_form_version_section(
  p_form_version_id uuid,
  p_code text,
  p_display_name text,
  p_description text default null,
  p_is_required boolean default true,
  p_is_active boolean default true,
  p_area_code text default null
)
returns public.form_version_sections
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_form_id uuid;
  v_section_id uuid;
  v_sort_order integer;
  v_version_section public.form_version_sections;
  v_code text;
  v_display_name text;
  v_description text;
  v_area_code text;
begin
  if auth.uid() is null then
    raise exception 'Authenticated caller is required.' using errcode = '28000';
  end if;

  perform public.assert_draft_form_version_access(p_form_version_id);

  v_code := upper(btrim(coalesce(p_code, '')));
  v_display_name := btrim(coalesce(p_display_name, ''));
  v_description := nullif(btrim(coalesce(p_description, '')), '');
  v_area_code := nullif(upper(btrim(coalesce(p_area_code, ''))), '');

  if v_code = '' or v_display_name = ''
     or p_is_required is null
     or p_is_active is null then
    raise exception 'Invalid section input.' using errcode = '22023';
  end if;

  if v_area_code is not null
     and v_area_code not in ('STORE', 'PRODUCTION') then
    raise exception 'Invalid section area.' using errcode = '22023';
  end if;

  select fv.form_id
    into v_form_id
  from public.form_versions fv
  where fv.id = p_form_version_id;

  if v_form_id is null then
    raise exception 'Form version was not found.' using errcode = '22023';
  end if;

  select coalesce(max(fvs.sort_order), -1) + 1
    into v_sort_order
  from public.form_version_sections fvs
  where fvs.form_version_id = p_form_version_id;

  insert into public.sections (
    form_id,
    code,
    name,
    description,
    is_active,
    area_code
  ) values (
    v_form_id,
    v_code,
    v_display_name,
    v_description,
    p_is_active,
    v_area_code
  )
  returning id into v_section_id;

  insert into public.form_version_sections (
    form_version_id,
    section_id,
    display_name,
    description,
    sort_order,
    is_required,
    is_active
  ) values (
    p_form_version_id,
    v_section_id,
    v_display_name,
    v_description,
    v_sort_order,
    p_is_required,
    p_is_active
  )
  returning * into v_version_section;

  return v_version_section;
exception
  when unique_violation then
    raise exception 'Section code already exists in this form.' using errcode = '23505';
end;
$$;

revoke all on function public.add_draft_form_version_section(uuid, text, text, text, boolean, boolean, text) from public;
revoke all on function public.add_draft_form_version_section(uuid, text, text, text, boolean, boolean, text) from anon;
revoke all on function public.add_draft_form_version_section(uuid, text, text, text, boolean, boolean, text) from authenticated;
grant execute on function public.add_draft_form_version_section(uuid, text, text, text, boolean, boolean, text) to authenticated;

commit;
