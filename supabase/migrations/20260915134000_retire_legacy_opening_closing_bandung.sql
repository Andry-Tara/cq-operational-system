begin;

-- ============================================================
-- O3E - RETIRE LEGACY OPENING / CLOSING FOR CQ BANDUNG ONLY
--
-- Retire only:
--   BDG + OPENING
--   BDG + CLOSING
--
-- Keep active:
--   OPENING_FOH
--   OPENING_BOH
--   CLOSING_FOH
--   CLOSING_BOH
--
-- Historical reports and all other outlets are untouched.
-- ============================================================

do $$
declare
  v_outlet_id uuid;
  v_org_id uuid;
  v_active_legacy integer;
  v_active_split integer;
  v_published_split integer;
  v_split_with_operator integer;
begin

  select
    o.id,
    o.organization_id
  into
    v_outlet_id,
    v_org_id
  from public.outlets o
  where upper(o.code) = 'BDG'
    and o.is_active = true
  limit 1;

  if v_outlet_id is null then
    raise exception
      'Active CQ Bandung outlet (code BDG) was not found.';
  end if;

  select count(*)
  into v_active_legacy
  from public.outlet_form_assignments ofa
  join public.forms f
    on f.id = ofa.form_id
  where ofa.outlet_id = v_outlet_id
    and ofa.is_active = true
    and f.organization_id = v_org_id
    and upper(f.code) in (
      'OPENING',
      'CLOSING'
    );

  if v_active_legacy <> 2 then
    raise exception
      'Expected exactly 2 active Bandung legacy assignments (OPENING + CLOSING), found %.',
      v_active_legacy;
  end if;

  select count(*)
  into v_active_split
  from public.outlet_form_assignments ofa
  join public.forms f
    on f.id = ofa.form_id
  where ofa.outlet_id = v_outlet_id
    and ofa.is_active = true
    and f.organization_id = v_org_id
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    );

  if v_active_split <> 4 then
    raise exception
      'Expected 4 active Bandung split assignments, found %.',
      v_active_split;
  end if;

  select count(*)
  into v_published_split
  from public.outlet_form_assignments ofa
  join public.forms f
    on f.id = ofa.form_id
  join public.form_versions fv
    on fv.id = ofa.form_version_id
   and fv.form_id = f.id
  where ofa.outlet_id = v_outlet_id
    and ofa.is_active = true
    and f.organization_id = v_org_id
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    )
    and fv.status = 'published';

  if v_published_split <> 4 then
    raise exception
      'Expected all 4 Bandung split assignments to use published versions, found %.',
      v_published_split;
  end if;

  select count(*)
  into v_split_with_operator
  from public.forms f
  where f.organization_id = v_org_id
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    )
    and exists (
      select 1
      from public.user_form_permissions ufp
      join public.user_outlets uo
        on uo.user_id = ufp.user_id
       and uo.outlet_id = v_outlet_id
       and uo.is_active = true
      where ufp.outlet_id = v_outlet_id
        and ufp.form_id = f.id
        and ufp.can_fill = true
        and ufp.can_submit = true
    );

  if v_split_with_operator <> 4 then
    raise exception
      'Expected Fill+Submit operator coverage for all 4 Bandung split forms, found %.',
      v_split_with_operator;
  end if;

  update public.outlet_form_assignments ofa
  set
    is_active = false,
    effective_until = coalesce(
      ofa.effective_until,
      now()
    )
  from public.forms f
  where f.id = ofa.form_id
    and ofa.outlet_id = v_outlet_id
    and ofa.is_active = true
    and f.organization_id = v_org_id
    and upper(f.code) in (
      'OPENING',
      'CLOSING'
    );

  if exists (
    select 1
    from public.outlet_form_assignments ofa
    join public.forms f
      on f.id = ofa.form_id
    where ofa.outlet_id = v_outlet_id
      and ofa.is_active = true
      and f.organization_id = v_org_id
      and upper(f.code) in (
        'OPENING',
        'CLOSING'
      )
  ) then
    raise exception
      'Bandung legacy OPENING/CLOSING assignment remained active after update.';
  end if;

  select count(*)
  into v_active_split
  from public.outlet_form_assignments ofa
  join public.forms f
    on f.id = ofa.form_id
  where ofa.outlet_id = v_outlet_id
    and ofa.is_active = true
    and f.organization_id = v_org_id
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    );

  if v_active_split <> 4 then
    raise exception
      'Bandung split assignments changed unexpectedly; active count is %.',
      v_active_split;
  end if;

end;
$$;

commit;
