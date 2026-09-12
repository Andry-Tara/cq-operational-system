begin;

create or replace function public.prevent_form_version_update()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if old.status is distinct from 'draft' then
    raise exception
      'Published or archived form versions are immutable.'
      using errcode = '55000';
  end if;

  if new.id is distinct from old.id
     or new.form_id is distinct from old.form_id
     or new.version_number is distinct from old.version_number then
    raise exception
      'Form version identity is immutable.'
      using errcode = '55000';
  end if;

  if old.status = 'draft'
     and new.status = 'published' then

    if new.notes is distinct from old.notes then
      raise exception
        'Publishing cannot modify form version notes.'
        using errcode = '55000';
    end if;

    if new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception
        'Publishing cannot modify creation metadata.'
        using errcode = '55000';
    end if;

    perform public.assert_form_version_publishable(old.id);

    new.published_at := now();

    return new;
  end if;

  if new.status is distinct from old.status then
    raise exception
      'Form version status transitions require the controlled version workflow.'
      using errcode = '55000';
  end if;

  if new.published_at is distinct from old.published_at then
    raise exception
      'Publication timestamp is lifecycle-managed.'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

revoke all on function public.prevent_form_version_update()
from public;

revoke all on function public.prevent_form_version_update()
from anon, authenticated;

commit;
