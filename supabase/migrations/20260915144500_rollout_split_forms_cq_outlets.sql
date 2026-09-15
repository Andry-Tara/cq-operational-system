begin;

create temporary table o3f_rollout_outlets (
  outlet_code text primary key,
  genset boolean not null,
  karaoke boolean not null,
  playground boolean not null
) on commit drop;

insert into o3f_rollout_outlets (
  outlet_code,
  genset,
  karaoke,
  playground
)
values
  ('GS',  true,  true,  true),
  ('HT',  true,  true,  false),
  ('MOI', false, true,  true),
  ('PIM', false, false, false),
  ('PL',  true,  true,  false),
  ('PP',  true,  true,  false),
  ('SP',  true,  true,  false),
  ('TBZ', false, true,  false);

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
      'O3F STOP: active BDG outlet not found.';
  end if;

  select count(*)
    into v_count
  from o3f_rollout_outlets r
  join public.outlets o
    on upper(o.code) = r.outlet_code
   and o.is_active = true
   and o.organization_id = v_org_id;

  if v_count <> 8 then
    raise exception
      'O3F STOP: expected 8 active CQ target outlets in Bandung organization, found %.',
      v_count;
  end if;

  if exists (
    select 1
    from o3f_rollout_outlets
    where outlet_code in (
      'BDG',
      'CGU',
      'SMY',
      'CNT'
    )
  ) then
    raise exception
      'O3F STOP: rollout scope contains a protected outlet.';
  end if;

  select count(*)
    into v_count
  from public.facility_definitions fd
  where fd.organization_id = v_org_id
    and fd.is_active = true
    and upper(fd.code) in (
      'GENSET',
      'KARAOKE',
      'PLAYGROUND'
    );

  if v_count <> 3 then
    raise exception
      'O3F STOP: expected GENSET/KARAOKE/PLAYGROUND active definitions, found %.',
      v_count;
  end if;

  select count(*)
    into v_count
  from public.forms f
  where f.organization_id = v_org_id
    and f.is_active = true
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    );

  if v_count <> 4 then
    raise exception
      'O3F STOP: expected 4 active split forms, found %.',
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
   and fv.form_id = f.id
  where upper(o.code) = 'BDG'
    and o.organization_id = v_org_id
    and ofa.is_active = true
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    )
    and fv.status = 'published';

  if v_count <> 4 then
    raise exception
      'O3F STOP: BDG must have exactly 4 active split assignments on published versions, found %.',
      v_count;
  end if;

  select string_agg(
           o.code,
           ', '
           order by o.code
         )
    into v_bad
  from o3f_rollout_outlets r
  join public.outlets o
    on upper(o.code) = r.outlet_code
   and o.organization_id = v_org_id
  where (
    select count(*)
    from public.outlet_form_assignments ofa
    join public.forms f
      on f.id = ofa.form_id
    where ofa.outlet_id = o.id
      and ofa.is_active = true
      and upper(f.code) in (
        'OPENING',
        'CLOSING'
      )
  ) <> 2;

  if v_bad is not null then
    raise exception
      'O3F STOP: target outlets without exactly 2 active legacy assignments: %.',
      v_bad;
  end if;

  select string_agg(
           o.code,
           ', '
           order by o.code
         )
    into v_bad
  from o3f_rollout_outlets r
  join public.outlets o
    on upper(o.code) = r.outlet_code
   and o.organization_id = v_org_id
  where exists (
    select 1
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
  );

  if v_bad is not null then
    raise exception
      'O3F STOP: target outlets already have active split assignments: %.',
      v_bad;
  end if;
end;
$$;

insert into public.outlet_facilities (
  outlet_id,
  facility_id,
  is_available
)
select
  o.id,
  fd.id,
  case upper(fd.code)
    when 'GENSET'
      then r.genset
    when 'KARAOKE'
      then r.karaoke
    when 'PLAYGROUND'
      then r.playground
  end
from o3f_rollout_outlets r
join public.outlets o
  on upper(o.code) = r.outlet_code
join public.facility_definitions fd
  on fd.organization_id = o.organization_id
 and fd.is_active = true
 and upper(fd.code) in (
   'GENSET',
   'KARAOKE',
   'PLAYGROUND'
 )
on conflict (
  outlet_id,
  facility_id
)
do update set
  is_available =
    excluded.is_available,
  updated_at =
    now();

do $$
declare
  v_org_id uuid;
  v_bad text;
begin
  select o.organization_id
    into v_org_id
  from public.outlets o
  where upper(o.code) = 'BDG'
    and o.is_active = true
  limit 1;

  select string_agg(
           o.code,
           ', '
           order by o.code
         )
    into v_bad
  from o3f_rollout_outlets r
  join public.outlets o
    on upper(o.code) = r.outlet_code
   and o.organization_id = v_org_id
  where (
    select count(distinct fd.code)
    from public.outlet_facilities ofc
    join public.facility_definitions fd
      on fd.id = ofc.facility_id
    where ofc.outlet_id = o.id
      and fd.organization_id = v_org_id
      and fd.is_active = true
      and upper(fd.code) in (
        'PARKING',
        'VALET',
        'VIP_ROOM',
        'GENSET',
        'CCTV',
        'PLAYGROUND',
        'KARAOKE',
        'GUEST_TOILET',
        'GAS_SYSTEM'
      )
  ) <> 9;

  if v_bad is not null then
    raise exception
      'O3F STOP: incomplete 9-facility configuration after upsert for: %.',
      v_bad;
  end if;
end;
$$;

insert into public.outlet_form_assignments (
  outlet_id,
  form_id,
  form_version_id,
  is_active,
  effective_from,
  effective_until
)
select
  target.id,
  source_assignment.form_id,
  source_assignment.form_version_id,
  true,
  current_date,
  null
from o3f_rollout_outlets r
join public.outlets target
  on upper(target.code) = r.outlet_code
join (
  select
    ofa.form_id,
    ofa.form_version_id
  from public.outlet_form_assignments ofa
  join public.outlets source_outlet
    on source_outlet.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
  join public.form_versions fv
    on fv.id = ofa.form_version_id
   and fv.form_id = f.id
  where upper(source_outlet.code) = 'BDG'
    and ofa.is_active = true
    and fv.status = 'published'
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    )
) source_assignment
  on true;

do $$
declare
  v_org_id uuid;
  v_bad text;
  v_count integer;
begin
  select o.organization_id
    into v_org_id
  from public.outlets o
  where upper(o.code) = 'BDG'
    and o.is_active = true
  limit 1;

  select string_agg(
           o.code,
           ', '
           order by o.code
         )
    into v_bad
  from o3f_rollout_outlets r
  join public.outlets o
    on upper(o.code) = r.outlet_code
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
      and upper(f.code) in (
        'OPENING_FOH',
        'OPENING_BOH',
        'CLOSING_FOH',
        'CLOSING_BOH'
      )
      and fv.status = 'published'
  ) <> 4;

  if v_bad is not null then
    raise exception
      'O3F STOP: rollout outlets without 4 published active split assignments: %.',
      v_bad;
  end if;

  select string_agg(
           o.code,
           ', '
           order by o.code
         )
    into v_bad
  from o3f_rollout_outlets r
  join public.outlets o
    on upper(o.code) = r.outlet_code
   and o.organization_id = v_org_id
  where (
    select count(*)
    from public.outlet_form_assignments ofa
    join public.forms f
      on f.id = ofa.form_id
    where ofa.outlet_id = o.id
      and ofa.is_active = true
      and upper(f.code) in (
        'OPENING',
        'CLOSING'
      )
  ) <> 2;

  if v_bad is not null then
    raise exception
      'O3F STOP: legacy OPENING/CLOSING were not preserved for: %.',
      v_bad;
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
      'OPENING',
      'CLOSING'
    );

  if v_count <> 0 then
    raise exception
      'O3F STOP: Bandung legacy assignment unexpectedly became active.';
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
      'O3F STOP: Bandung split assignment count changed unexpectedly: %.',
      v_count;
  end if;

  if exists (
    select 1
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
      )
  ) then
    raise exception
      'O3F STOP: DD Canggu/Seminyak unexpectedly have active split assignments.';
  end if;
end;
$$;

commit;
