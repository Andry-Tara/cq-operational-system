begin;

-- ============================================================
-- OUTLET DEFAULT LOCALE SEED
--
-- Uses stable outlet codes rather than outlet names. The expected
-- code and uniqueness checks intentionally fail the transaction if
-- production configuration does not match the known outlet set.
-- ============================================================

do $seed$
declare
  expected_count integer := 12;
  candidate_organization_count integer;
  target_organization_id uuid;
  target_outlet_count integer;
begin
  with expected(code) as (
    values
      ('BDG'), ('CNT'), ('GS'), ('HT'), ('MOI'), ('PIM'), ('PL'),
      ('PP'), ('SP'), ('TBZ'), ('CGU'), ('SMY')
  )
  select count(*)
    into candidate_organization_count
  from (
    select o.organization_id
    from public.outlets o
    join expected e
      on e.code = o.code
    group by o.organization_id
    having count(*) = expected_count
  ) as candidates;

  if candidate_organization_count = 0 then
    raise exception
      'No organization contains all % expected outlet codes.',
      expected_count;
  end if;

  if candidate_organization_count > 1 then
    raise exception
      'More than one organization contains all % expected outlet codes (% organizations found).',
      expected_count,
      candidate_organization_count;
  end if;

  with expected(code) as (
    values
      ('BDG'), ('CNT'), ('GS'), ('HT'), ('MOI'), ('PIM'), ('PL'),
      ('PP'), ('SP'), ('TBZ'), ('CGU'), ('SMY')
  )
  select o.organization_id
    into target_organization_id
  from public.outlets o
  join expected e
    on e.code = o.code
  group by o.organization_id
  having count(*) = expected_count;

  select count(*)
    into target_outlet_count
  from public.outlets
  where organization_id = target_organization_id
    and code in (
      'BDG', 'CNT', 'GS', 'HT', 'MOI', 'PIM', 'PL', 'PP', 'SP', 'TBZ',
      'CGU', 'SMY'
    );

  if target_outlet_count <> expected_count then
    raise exception
      'Target organization must contain exactly % expected outlet rows, found %.',
      expected_count,
      target_outlet_count;
  end if;

  update public.outlets
  set default_locale = case code
    when 'BDG' then 'id-ID'
    when 'CNT' then 'id-ID'
    when 'GS' then 'id-ID'
    when 'HT' then 'id-ID'
    when 'MOI' then 'id-ID'
    when 'PIM' then 'id-ID'
    when 'PL' then 'id-ID'
    when 'PP' then 'id-ID'
    when 'SP' then 'id-ID'
    when 'TBZ' then 'id-ID'
    when 'CGU' then 'en'
    when 'SMY' then 'en'
  end
  where organization_id = target_organization_id
    and code in (
      'BDG', 'CNT', 'GS', 'HT', 'MOI', 'PIM', 'PL', 'PP', 'SP', 'TBZ',
      'CGU', 'SMY'
    );
end;
$seed$;

do $verify$
declare
  target_organization_id uuid;
  candidate_organization_count integer;
  target_outlet_count integer;
  mismatch_count integer;
  mismatch_codes text;
begin
  with expected(code) as (
    values
      ('BDG'), ('CNT'), ('GS'), ('HT'), ('MOI'), ('PIM'), ('PL'),
      ('PP'), ('SP'), ('TBZ'), ('CGU'), ('SMY')
  )
  select count(*)
    into candidate_organization_count
  from (
    select o.organization_id
    from public.outlets o
    join expected e
      on e.code = o.code
    group by o.organization_id
    having count(*) = 12
  ) as candidates;

  if candidate_organization_count <> 1 then
    raise exception
      'Final locale validation expected exactly one target organization, found %.',
      candidate_organization_count;
  end if;

  with expected(code) as (
    values
      ('BDG'), ('CNT'), ('GS'), ('HT'), ('MOI'), ('PIM'), ('PL'),
      ('PP'), ('SP'), ('TBZ'), ('CGU'), ('SMY')
  )
  select o.organization_id
    into target_organization_id
  from public.outlets o
  join expected e
    on e.code = o.code
  group by o.organization_id
  having count(*) = 12;

  select count(*)
    into target_outlet_count
  from public.outlets
  where organization_id = target_organization_id
    and code in (
      'BDG', 'CNT', 'GS', 'HT', 'MOI', 'PIM', 'PL', 'PP', 'SP', 'TBZ',
      'CGU', 'SMY'
    );

  if target_outlet_count <> 12 then
    raise exception
      'Final locale validation expected exactly 12 target rows, found %.',
      target_outlet_count;
  end if;

  select count(*)
    into mismatch_count
  from public.outlets o
  join (
    values
      ('BDG', 'id-ID'),
      ('CNT', 'id-ID'),
      ('GS', 'id-ID'),
      ('HT', 'id-ID'),
      ('MOI', 'id-ID'),
      ('PIM', 'id-ID'),
      ('PL', 'id-ID'),
      ('PP', 'id-ID'),
      ('SP', 'id-ID'),
      ('TBZ', 'id-ID'),
      ('CGU', 'en'),
      ('SMY', 'en')
  ) as expected(code, expected_locale)
    on expected.code = o.code
   and o.organization_id = target_organization_id
  where o.default_locale is distinct from expected.expected_locale;

  if mismatch_count <> 0 then
    select string_agg(o.code, ', ' order by o.code)
      into mismatch_codes
    from public.outlets o
    join (
      values
        ('BDG', 'id-ID'),
        ('CNT', 'id-ID'),
        ('GS', 'id-ID'),
        ('HT', 'id-ID'),
        ('MOI', 'id-ID'),
        ('PIM', 'id-ID'),
        ('PL', 'id-ID'),
        ('PP', 'id-ID'),
        ('SP', 'id-ID'),
        ('TBZ', 'id-ID'),
        ('CGU', 'en'),
        ('SMY', 'en')
    ) as expected(code, expected_locale)
      on expected.code = o.code
     and o.organization_id = target_organization_id
    where o.default_locale is distinct from expected.expected_locale;

    raise exception
      'Outlet default locale validation failed for codes: %.',
      mismatch_codes;
  end if;
end;
$verify$;

commit;
