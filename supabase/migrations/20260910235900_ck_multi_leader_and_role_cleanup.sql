-- ============================================================
-- CENTRAL KITCHEN
-- Multi-leader support + CK role permission cleanup
-- ============================================================

-- Allow multiple leaders for the same outlet/form/area,
-- while preventing duplicate assignment of the same user.
alter table public.form_area_leaders
drop constraint if exists
  form_area_leaders_outlet_form_area_key;

alter table public.form_area_leaders
drop constraint if exists
  form_area_leaders_outlet_form_area_user_key;

alter table public.form_area_leaders
add constraint
  form_area_leaders_outlet_form_area_user_key
unique (
  outlet_id,
  form_id,
  area_code,
  user_id
);

-- ------------------------------------------------------------
-- Central Kitchen roles must not inherit administrator status.
-- ------------------------------------------------------------

update public.roles
set
  name = 'Central Kitchen Leader',
  description =
    'Central Kitchen area leader. Operational section access is controlled by user_section_permissions; review and finalization authority is controlled by form_area_leaders.',
  is_admin = false
where code = 'CK_MANAGER';

update public.roles
set
  description =
    'Central Kitchen operational PIC. Section access is controlled by user_section_permissions.',
  is_admin = false
where code = 'CK_STAFF';

-- Remove administrator-only permissions from CK Staff.
delete from public.role_permissions rp
using public.roles r,
      public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.code = 'CK_STAFF'
  and p.code in (
    'admin.access',
    'forms.manage',
    'permissions.manage',
    'questions.manage',
    'users.manage',
    'reports.all_outlets',
    'reports.reopen'
  );

-- Ensure both CK roles retain operational navigation/access gates.
insert into public.role_permissions (
  role_id,
  permission_id
)
select
  r.id,
  p.id
from public.roles r
cross join public.permissions p
where r.code in (
  'CK_STAFF',
  'CK_MANAGER'
)
and p.code in (
  'dashboard.view',
  'reports.view',
  'opening.submit',
  'closing.submit'
)
on conflict do nothing;
