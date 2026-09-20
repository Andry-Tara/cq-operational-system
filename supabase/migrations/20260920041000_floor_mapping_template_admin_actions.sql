begin;

-- ============================================================
-- FLOOR MAPPING TEMPLATE ADMIN ACTIONS
-- ============================================================

create or replace function
public.activate_floor_mapping_template(
  p_template_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_outlet_id uuid;
begin

  select outlet_id
  into v_outlet_id
  from public.floor_mapping_templates
  where id =
    p_template_id;


  if v_outlet_id is null then
    raise exception
      'Floor Mapping template not found.';
  end if;


  update public.floor_mapping_templates
  set
    is_active = false,
    updated_at = now()
  where outlet_id =
      v_outlet_id
    and is_active =
      true
    and id <>
      p_template_id;


  update public.floor_mapping_templates
  set
    is_active = true,
    updated_at = now()
  where id =
    p_template_id;


  if not found then
    raise exception
      'Unable to activate Floor Mapping template.';
  end if;

end;
$$;


revoke all
on function
public.activate_floor_mapping_template(uuid)
from public, anon, authenticated;


grant execute
on function
public.activate_floor_mapping_template(uuid)
to service_role;


commit;
