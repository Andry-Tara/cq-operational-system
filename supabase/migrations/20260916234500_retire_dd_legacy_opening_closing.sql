begin;

-- ============================================================
-- DD BALI — RETIRE LEGACY OPENING / CLOSING
--
-- Targets:
--   CGU / DD Canggu
--   SMY / DD Seminyak
--
-- Retire:
--   OPENING
--   CLOSING
--
-- Keep active:
--   OPENING_FOH
--   OPENING_BOH
--   CLOSING_FOH
--   CLOSING_BOH
--
-- Safety:
--   - DD split assignments must already be exactly 4 per outlet
--   - DD split assignments must use the expected published versions
--   - every active DD split form must have Fill+Submit operator coverage
--   - CQ exact 36 active split assignments must remain unchanged/published
--   - no report, permission, user, facility, form, or version mutation
-- ============================================================

create temporary table dd_retire_target_outlets (
  outlet_code text primary key
) on commit drop;

insert into dd_retire_target_outlets (outlet_code)
values
  ('CGU'),
  ('SMY');

create temporary table dd_retire_context (
  organization_id uuid primary key
) on commit drop;

create temporary table dd_retire_cq_snapshot (
  outlet_code text not null,
  form_code text not null,
  assignment_id uuid not null,
  form_version_id uuid not null,
  primary key (outlet_code, form_code)
) on commit drop;


-- ============================================================
-- 1. PRE-FLIGHT
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
  where upper(o.code) = 'CGU'
    and o.is_active = true
  limit 1;

  if v_org_id is null then
    raise exception
      'DD RETIRE STOP: active CGU outlet was not found.';
  end if;

  select count(*)
    into v_count
  from public.outlets o
  join dd_retire_target_outlets t
    on upper(o.code) = t.outlet_code
  where o.organization_id = v_org_id
    and o.is_active = true;

  if v_count <> 2 then
    raise exception
      'DD RETIRE STOP: expected exactly 2 active DD target outlets, found %.',
      v_count;
  end if;

  if exists (
    select 1
    from public.outlets o
    join dd_retire_target_outlets t
      on upper(o.code) = t.outlet_code
    where o.organization_id = v_org_id
      and coalesce(o.default_locale, '') <> 'en'
  ) then
    raise exception
      'DD RETIRE STOP: CGU/SMY default_locale must remain en.';
  end if;

  insert into dd_retire_context (organization_id)
  values (v_org_id);

  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o
    on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
  join dd_retire_target_outlets t
    on upper(o.code) = t.outlet_code
  where o.organization_id = v_org_id
    and f.organization_id = v_org_id
    and ofa.is_active = true
    and upper(f.code) in ('OPENING', 'CLOSING');

  if v_count <> 4 then
    raise exception
      'DD RETIRE STOP: expected exactly 4 active DD legacy assignments, found %.',
      v_count;
  end if;

  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o
    on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
  join dd_retire_target_outlets t
    on upper(o.code) = t.outlet_code
  where o.organization_id = v_org_id
    and f.organization_id = v_org_id
    and ofa.is_active = true
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    );

  if v_count <> 8 then
    raise exception
      'DD RETIRE STOP: expected exactly 8 active DD split assignments, found %.',
      v_count;
  end if;

  select string_agg(
           upper(o.code) || ':' || upper(f.code) || ':v' ||
           fv.version_number::text || ':' || fv.status,
           ', '
           order by upper(o.code), upper(f.code)
         )
    into v_bad
  from public.outlet_form_assignments ofa
  join public.outlets o
    on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
  join public.form_versions fv
    on fv.id = ofa.form_version_id
  join dd_retire_target_outlets t
    on upper(o.code) = t.outlet_code
  where o.organization_id = v_org_id
    and f.organization_id = v_org_id
    and ofa.is_active = true
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    )
    and (
      fv.status <> 'published'
      or fv.version_number <>
        case upper(f.code)
          when 'OPENING_FOH' then 4
          when 'OPENING_BOH' then 3
          when 'CLOSING_FOH' then 3
          when 'CLOSING_BOH' then 3
        end
    );

  if v_bad is not null then
    raise exception
      'DD RETIRE STOP: unexpected DD split version/status: %.',
      v_bad;
  end if;

  select string_agg(
           x.outlet_code || ':' || x.form_code,
           ', '
           order by x.outlet_code, x.form_code
         )
    into v_bad
  from (
    select
      upper(o.code) as outlet_code,
      upper(f.code) as form_code,
      o.id as outlet_id,
      f.id as form_id
    from public.outlet_form_assignments ofa
    join public.outlets o
      on o.id = ofa.outlet_id
    join public.forms f
      on f.id = ofa.form_id
    join dd_retire_target_outlets t
      on upper(o.code) = t.outlet_code
    where o.organization_id = v_org_id
      and f.organization_id = v_org_id
      and ofa.is_active = true
      and upper(f.code) in (
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
    join public.profiles p
      on p.id = ufp.user_id
     and p.organization_id = v_org_id
     and coalesce(p.is_active, true) = true
    where ufp.outlet_id = x.outlet_id
      and ufp.form_id = x.form_id
      and ufp.can_fill = true
      and ufp.can_submit = true
  );

  if v_bad is not null then
    raise exception
      'DD RETIRE STOP: split forms without active Fill+Submit operator coverage: %.',
      v_bad;
  end if;

  insert into dd_retire_cq_snapshot (
    outlet_code,
    form_code,
    assignment_id,
    form_version_id
  )
  select
    upper(o.code),
    upper(f.code),
    ofa.id,
    ofa.form_version_id
  from public.outlet_form_assignments ofa
  join public.outlets o
    on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
  join public.form_versions fv
    on fv.id = ofa.form_version_id
  where upper(o.code) in (
      'BDG','GS','HT','MOI','PIM','PL','PP','SP','TBZ'
    )
    and o.organization_id = v_org_id
    and f.organization_id = v_org_id
    and ofa.is_active = true
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    )
    and fv.status = 'published';

  select count(*)
    into v_count
  from dd_retire_cq_snapshot;

  if v_count <> 36 then
    raise exception
      'DD RETIRE STOP: expected CQ safety snapshot of 36 active published split assignments, found %.',
      v_count;
  end if;
end;
$$;


-- ============================================================
-- 2. RETIRE DD LEGACY ASSIGNMENTS
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
     dd_retire_target_outlets t,
     dd_retire_context c
where f.id = ofa.form_id
  and o.id = ofa.outlet_id
  and upper(o.code) = t.outlet_code
  and o.organization_id = c.organization_id
  and f.organization_id = c.organization_id
  and ofa.is_active = true
  and upper(f.code) in (
    'OPENING',
    'CLOSING'
  );


-- ============================================================
-- 3. POST-FLIGHT
-- ============================================================

do $$
declare
  v_org_id uuid;
  v_count integer;
  v_bad text;
begin
  select organization_id
    into v_org_id
  from dd_retire_context
  limit 1;

  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o
    on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
  join dd_retire_target_outlets t
    on upper(o.code) = t.outlet_code
  where o.organization_id = v_org_id
    and f.organization_id = v_org_id
    and ofa.is_active = true
    and upper(f.code) in ('OPENING', 'CLOSING');

  if v_count <> 0 then
    raise exception
      'DD RETIRE POSTFLIGHT: % active DD legacy assignment(s) remain.',
      v_count;
  end if;

  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o
    on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
  join public.form_versions fv
    on fv.id = ofa.form_version_id
  join dd_retire_target_outlets t
    on upper(o.code) = t.outlet_code
  where o.organization_id = v_org_id
    and f.organization_id = v_org_id
    and ofa.is_active = true
    and fv.status = 'published'
    and (
      (upper(f.code) = 'OPENING_FOH' and fv.version_number = 4)
      or
      (
        upper(f.code) in (
          'OPENING_BOH',
          'CLOSING_FOH',
          'CLOSING_BOH'
        )
        and fv.version_number = 3
      )
    );

  if v_count <> 8 then
    raise exception
      'DD RETIRE POSTFLIGHT: expected 8 exact active published DD split assignments, found %.',
      v_count;
  end if;

  select string_agg(
           snap.outlet_code || ':' || snap.form_code,
           ', '
           order by snap.outlet_code, snap.form_code
         )
    into v_bad
  from dd_retire_cq_snapshot snap
  left join public.outlet_form_assignments ofa
    on ofa.id = snap.assignment_id
   and ofa.is_active = true
   and ofa.form_version_id = snap.form_version_id
  left join public.form_versions fv
    on fv.id = snap.form_version_id
  where ofa.id is null
     or fv.status <> 'published';

  if v_bad is not null then
    raise exception
      'DD RETIRE POSTFLIGHT: CQ assignment protection failed: %.',
      v_bad;
  end if;

  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o
    on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
  where upper(o.code) in (
      'BDG','GS','HT','MOI','PIM','PL','PP','SP','TBZ'
    )
    and o.organization_id = v_org_id
    and f.organization_id = v_org_id
    and ofa.is_active = true
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    );

  if v_count <> 36 then
    raise exception
      'DD RETIRE POSTFLIGHT: CQ active split assignment count changed: %.',
      v_count;
  end if;
end;
$$;

commit;
