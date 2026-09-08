-- ============================================================
-- SECTION AREA OWNERSHIP
--
-- Internal codes:
-- STORE      = Warehouse
-- PRODUCTION = Production
--
-- Nullable by design for non-CK forms.
-- Scoped users fail closed when area_code is not assigned.
-- ============================================================

alter table public.sections
add column if not exists area_code text;


comment on column public.sections.area_code is
'Operational ownership area. STORE is displayed as Warehouse; PRODUCTION is displayed as Production.';


-- ============================================================
-- CK WAREHOUSE
-- Opening + Closing
-- ============================================================

update public.sections s
set area_code = 'STORE'
from public.forms f
where
  f.id = s.form_id
  and f.code in (
    'OPENING_CK',
    'CLOSING_CK'
  )
  and s.code in (
    'MAIN_WAREHOUSE',
    'SECONDARY_WAREHOUSE'
  )
  and s.area_code is distinct from 'STORE';


-- ============================================================
-- CK PRODUCTION
-- Closing
-- ============================================================

update public.sections s
set area_code = 'PRODUCTION'
from public.forms f
where
  f.id = s.form_id
  and f.code = 'CLOSING_CK'
  and s.code in (
    'BEVERAGE',
    'BUTCHER',
    'COLD_KITCHEN',
    'HDS',
    'HOT_KITCHEN',
    'PREMIX',
    'STEWARD',
    'PRODUCTION'
  )
  and s.area_code is distinct from 'PRODUCTION';


create index if not exists
sections_form_area_code_idx
on public.sections (
  form_id,
  area_code
);
