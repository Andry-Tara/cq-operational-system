begin;

-- ============================================================
-- SPLIT OUTLET OPERATIONS
--
-- Existing OPENING / CLOSING are intentionally preserved.
--
-- New independent forms:
--   OPENING_FOH
--   OPENING_BOH
--   CLOSING_FOH
--   CLOSING_BOH
--
-- Each form receives Draft v1 only.
-- No outlet activation is performed in this migration.
-- ============================================================

-- ------------------------------------------------------------
-- 1. FORM MASTERS
-- Seed into every organization that already owns the legacy
-- restaurant OPENING / CLOSING forms.
-- ------------------------------------------------------------

insert into public.forms (
  organization_id,
  code,
  name,
  description,
  operational_scope,
  is_active
)
select
  source.organization_id,
  seed.code,
  seed.name,
  seed.description,
  'restaurant',
  true
from (
  select distinct organization_id
  from public.forms
  where code in (
    'OPENING',
    'CLOSING'
  )
    and operational_scope = 'restaurant'
) source
cross join (
  values
    (
      'OPENING_FOH',
      'Opening FOH',
      'Front of House opening operational checklist.'
    ),
    (
      'OPENING_BOH',
      'Opening BOH',
      'Back of House opening operational checklist.'
    ),
    (
      'CLOSING_FOH',
      'Closing FOH',
      'Front of House closing operational checklist.'
    ),
    (
      'CLOSING_BOH',
      'Closing BOH',
      'Back of House closing operational checklist.'
    )
) as seed(
  code,
  name,
  description
)
where not exists (
  select 1
  from public.forms existing
  where existing.organization_id =
        source.organization_id
    and existing.code =
        seed.code
);

-- ------------------------------------------------------------
-- 2. INITIAL DRAFT VERSION
-- ------------------------------------------------------------

insert into public.form_versions (
  form_id,
  version_number,
  status
)
select
  form.id,
  1,
  'draft'
from public.forms form
where form.code in (
  'OPENING_FOH',
  'OPENING_BOH',
  'CLOSING_FOH',
  'CLOSING_BOH'
)
  and form.operational_scope = 'restaurant'
  and not exists (
    select 1
    from public.form_versions existing_version
    where existing_version.form_id =
          form.id
  );

commit;
