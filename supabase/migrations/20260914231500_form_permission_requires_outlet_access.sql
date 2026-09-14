begin;

create or replace function public.has_form_permission(
  p_outlet_id uuid,
  p_form_id uuid,
  p_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_permission text :=
    lower(trim(coalesce(p_permission, '')));
begin
  if auth.uid() is null then
    return false;
  end if;

  if v_permission not in (
    'fill',
    'submit',
    'review',
    'override'
  ) then
    return false;
  end if;

  return exists (
    select 1
    from public.user_form_permissions ufp
    join public.user_outlets uo
      on uo.user_id = ufp.user_id
     and uo.outlet_id = ufp.outlet_id
     and uo.is_active = true
    where ufp.user_id = auth.uid()
      and ufp.outlet_id = p_outlet_id
      and ufp.form_id = p_form_id
      and (
        (v_permission = 'fill' and ufp.can_fill)
        or
        (v_permission = 'submit' and ufp.can_submit)
        or
        (v_permission = 'review' and ufp.can_review)
        or
        (v_permission = 'override' and ufp.can_override)
      )
  );
end;
$$;

revoke all
on function public.has_form_permission(
  uuid,
  uuid,
  text
)
from public;

grant execute
on function public.has_form_permission(
  uuid,
  uuid,
  text
)
to authenticated;

commit;
