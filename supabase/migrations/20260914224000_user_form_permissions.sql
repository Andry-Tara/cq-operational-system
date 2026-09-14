begin;

-- ============================================================
-- OUTLET FORM-LEVEL OPERATION PERMISSIONS
--
-- Purpose:
--   user_outlets           = outlet membership / visibility
--   user_form_permissions  = operational authority on a form
--   user_section_permissions = optional section-level assignment
--
-- This table is intentionally generic and is NOT CK-specific.
-- ============================================================

create table if not exists public.user_form_permissions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  outlet_id uuid not null
    references public.outlets(id)
    on delete cascade,

  form_id uuid not null
    references public.forms(id)
    on delete cascade,

  can_fill boolean not null default false,
  can_submit boolean not null default false,
  can_review boolean not null default false,
  can_override boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint user_form_permissions_user_outlet_form_key
    unique (
      user_id,
      outlet_id,
      form_id
    ),

  constraint user_form_permissions_has_capability
    check (
      can_fill
      or can_submit
      or can_review
      or can_override
    )
);

create index if not exists
  user_form_permissions_user_id_idx
on public.user_form_permissions (
  user_id
);

create index if not exists
  user_form_permissions_outlet_form_idx
on public.user_form_permissions (
  outlet_id,
  form_id
);

-- ============================================================
-- RLS
-- ============================================================

alter table public.user_form_permissions
  enable row level security;

drop policy if exists
  "user_form_permissions_select_own"
on public.user_form_permissions;

create policy
  "user_form_permissions_select_own"
on public.user_form_permissions
for select
to authenticated
using (
  user_id = auth.uid()
);

grant select
on public.user_form_permissions
to authenticated;

revoke insert, update, delete
on public.user_form_permissions
from authenticated;

-- ============================================================
-- AUTHORIZATION HELPER
-- ============================================================

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
