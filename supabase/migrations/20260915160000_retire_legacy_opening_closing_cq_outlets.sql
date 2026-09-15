begin;

-- ============================================================
-- O3H - RETIRE LEGACY OPENING/CLOSING FOR 8 CQ OUTLETS
--
-- Targets:
--   GS, HT, MOI, PIM, PL, PP, SP, TBZ
--
-- Preconditions:
--   - exactly 2 active legacy assignments per target outlet
--   - exactly 4 active split assignments per target outlet
--   - every split assignment uses a published version
--   - every split form has at least one active Fill+Submit operator
--
-- Preserves:
--   - Bandung
--   - DD Canggu / DD Seminyak
--   - Central Kitchen
--   - historical reports
--   - historical assignment rows
--
-- Effect:
--   After this migration the dashboard switches these outlets
--   from legacy completion semantics to split-form semantics.
-- ============================================================

create temporary table o3h_target_outlets (
  outlet_code text primary key
) on commit drop;

insert into o3h_target_outlets (outlet_code)
values
  ('GS'),
  ('HT'),
  ('MOI'),
  ('PIM'),
  ('PL'),
  ('PP'),
  ('SP'),
  ('TBZ');


do $$
declare
  v_org_id uuid;
  v_count integer;
  v_bad text;
begin
  select o.organization_id
    into v_org_id
  from public.outlets o
  where upper(o.code) = 'BDG'
    and o.is_active = true
  limit 1;

  if v_org_id is null then
    raise exception
      'O3H STOP: active BDG outlet not found.';
  end if;


  -- Exact target set must exist and be active in the CQ org.
  select count(*)
    into v_count
  from o3h_target_outlets t
  join public.outlets o
    on upper(o.code) = t.outlet_code
   and o.is_active = true
   and o.organization_id = v_org_id;

  if v_count <> 8 then
    raise exception
      'O3H STOP: expected 8 active CQ target outlets, found %.',
      v_count;
  end if;


  -- Scope guard.
  if exists (
    select 1
    from o3h_target_outlets
    where outlet_code in (
      'BDG',
      'CGU',
      'SMY',
      'CNT'
    )
  ) then
    raise exception
      'O3H STOP: protected outlet included in target set.';
  end if;


  -- Each target must still have exactly 2 active legacy forms.
  select string_agg(
           o.code,
           ', '
           order by o.code
         )
    into v_bad
  from o3h_target_outlets t
  join public.outlets o
    on upper(o.code) = t.outlet_code
   and o.organization_id = v_org_id
  where (
    select count(*)
    from public.outlet_form_assignments ofa
    join public.forms f
      on f.id = ofa.form_id
    where ofa.outlet_id = o.id
      and ofa.is_active = true
      and f.organization_id = v_org_id
      and upper(f.code) in (
        'OPENING',
        'CLOSING'
      )
  ) <> 2;

  if v_bad is not null then
    raise exception
      'O3H STOP: target outlets without exactly 2 active legacy assignments: %.',
      v_bad;
  end if;


  -- Each target must have all 4 split forms active and published.
  select string_agg(
           o.code,
           ', '
           order by o.code
         )
    into v_bad
  from o3h_target_outlets t
  join public.outlets o
    on upper(o.code) = t.outlet_code
   and o.organization_id = v_org_id
  where (
    select count(*)
    from public.outlet_form_assignments ofa
    join public.forms f
      on f.id = ofa.form_id
    join public.form_versions fv
      on fv.id = ofa.form_version_id
     and fv.form_id = f.id
    where ofa.outlet_id = o.id
      and ofa.is_active = true
      and f.organization_id = v_org_id
      and fv.status = 'published'
      and upper(f.code) in (
        'OPENING_FOH',
        'OPENING_BOH',
        'CLOSING_FOH',
        'CLOSING_BOH'
      )
  ) <> 4;

  if v_bad is not null then
    raise exception
      'O3H STOP: target outlets without 4 active published split assignments: %.',
      v_bad;
  end if;


  -- Every split form must have at least one active Fill+Submit operator.
  select string_agg(
           x.outlet_code || ':' || x.form_code,
           ', '
           order by x.outlet_code, x.form_code
         )
    into v_bad
  from (
    select
      o.code as outlet_code,
      f.code as form_code,
      o.id as outlet_id,
      f.id as form_id
    from o3h_target_outlets t
    join public.outlets o
      on upper(o.code) = t.outlet_code
     and o.organization_id = v_org_id
    join public.outlet_form_assignments ofa
      on ofa.outlet_id = o.id
     and ofa.is_active = true
    join public.forms f
      on f.id = ofa.form_id
     and f.organization_id = v_org_id
    where upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    )
  ) x
  where not exists (
    select 1
    from public.user_form_permissions ufp
    join public.user_outlets uo
      on uo.user_id = ufp.user_id
     and uo.outlet_id = x.outlet_id
     and uo.is_active = true
    where ufp.outlet_id = x.outlet_id
      and ufp.form_id = x.form_id
      and ufp.can_fill = true
      and ufp.can_submit = true
  );

  if v_bad is not null then
    raise exception
      'O3H STOP: split forms without active Fill+Submit operator coverage: %.',
      v_bad;
  end if;
end;
$$;


-- ============================================================
-- RETIRE LEGACY ASSIGNMENTS
--
-- No deletes. Historical assignment rows remain available.
-- ============================================================

update public.outlet_form_assignments ofa
set
  is_active = false,
  effective_until = coalesce(
    ofa.effective_until,
    current_date
  )
from public.forms f,
     public.outlets o,
     o3h_target_outlets t
where f.id = ofa.form_id
  and o.id = ofa.outlet_id
  and upper(o.code) = t.outlet_code
  and f.organization_id = o.organization_id
  and ofa.is_active = true
  and upper(f.code) in (
    'OPENING',
    'CLOSING'
  );


-- ============================================================
-- POST-FLIGHT
-- ============================================================

do $$
declare
  v_org_id uuid;
  v_count integer;
  v_bad text;
begin
  select o.organization_id
    into v_org_id
  from public.outlets o
  where upper(o.code) = 'BDG'
    and o.is_active = true
  limit 1;


  -- No active legacy remains on rollout targets.
  select string_agg(
           o.code,
           ', '
           order by o.code
         )
    into v_bad
  from o3h_target_outlets t
  join public.outlets o
    on upper(o.code) = t.outlet_code
   and o.organization_id = v_org_id
  where exists (
    select 1
    from public.outlet_form_assignments ofa
    join public.forms f
      on f.id = ofa.form_id
    where ofa.outlet_id = o.id
      and ofa.is_active = true
      and upper(f.code) in (
        'OPENING',
        'CLOSING'
      )
  );

  if v_bad is not null then
    raise exception
      'O3H STOP: legacy assignments remained active for: %.',
      v_bad;
  end if;


  -- All 4 split forms must still be active on every target.
  select string_agg(
           o.code,
           ', '
           order by o.code
         )
    into v_bad
  from o3h_target_outlets t
  join public.outlets o
    on upper(o.code) = t.outlet_code
   and o.organization_id = v_org_id
  where (
    select count(*)
    from public.outlet_form_assignments ofa
    join public.forms f
      on f.id = ofa.form_id
    where ofa.outlet_id = o.id
      and ofa.is_active = true
      and upper(f.code) in (
        'OPENING_FOH',
        'OPENING_BOH',
        'CLOSING_FOH',
        'CLOSING_BOH'
      )
  ) <> 4;

  if v_bad is not null then
    raise exception
      'O3H STOP: split assignment coverage changed unexpectedly for: %.',
      v_bad;
  end if;


  -- Bandung stays fully cut over.
  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o
    on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
  where upper(o.code) = 'BDG'
    and ofa.is_active = true
    and upper(f.code) in (
      'OPENING',
      'CLOSING'
    );

  if v_count <> 0 then
    raise exception
      'O3H STOP: Bandung legacy assignment unexpectedly active.';
  end if;

  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o
    on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
  where upper(o.code) = 'BDG'
    and ofa.is_active = true
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    );

  if v_count <> 4 then
    raise exception
      'O3H STOP: Bandung split assignment count changed unexpectedly: %.',
      v_count;
  end if;


  -- DD stays on legacy only.
  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o
    on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
  where upper(o.code) in (
      'CGU',
      'SMY'
    )
    and ofa.is_active = true
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    );

  if v_count <> 0 then
    raise exception
      'O3H STOP: DD Canggu/Seminyak unexpectedly gained split assignments.';
  end if;
end;
$$;

commit;
