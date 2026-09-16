begin;

create temporary table dd_smy_context (
  organization_id uuid not null,
  cgu_outlet_id uuid not null,
  smy_outlet_id uuid not null,
  admin_user_id uuid not null
) on commit drop;

create temporary table dd_smy_target_versions (
  form_code text primary key,
  form_id uuid not null,
  form_version_id uuid not null,
  version_number integer not null
) on commit drop;

create temporary table dd_smy_cq_snapshot (
  outlet_code text not null,
  form_code text not null,
  assignment_id uuid not null,
  form_version_id uuid not null,
  primary key (outlet_code, form_code)
) on commit drop;

do $$
declare
  v_org_id uuid;
  v_cgu_id uuid;
  v_smy_id uuid;
  v_admin_id uuid;
  v_count integer;
begin
  if to_regprocedure('public.activate_outlet_form_version(uuid,uuid)') is null then
    raise exception 'DD SMY STOP: activation RPC missing.';
  end if;

  select id, organization_id into v_cgu_id, v_org_id
  from public.outlets
  where upper(code) = 'CGU' and is_active = true
  limit 1;

  select id into v_smy_id
  from public.outlets
  where upper(code) = 'SMY'
    and organization_id = v_org_id
    and is_active = true
  limit 1;

  if v_cgu_id is null or v_smy_id is null or v_org_id is null then
    raise exception 'DD SMY STOP: CGU/SMY context missing.';
  end if;

  select count(*) into v_count
  from public.outlets
  where id in (v_cgu_id, v_smy_id)
    and default_locale = 'en';

  if v_count <> 2 then
    raise exception 'DD SMY STOP: DD default locale must remain en.';
  end if;

  select p.id into v_admin_id
  from public.profiles p
  join public.user_roles ur on ur.user_id = p.id
  join public.roles r
    on r.id = ur.role_id
   and r.organization_id = v_org_id
   and r.is_active = true
   and r.is_admin = true
  where p.organization_id = v_org_id
    and coalesce(p.is_active, true) = true
  order by p.id::text
  limit 1;

  if v_admin_id is null then
    raise exception 'DD SMY STOP: no active org admin found.';
  end if;

  insert into dd_smy_context
  values (v_org_id, v_cgu_id, v_smy_id, v_admin_id);
end;
$$;

insert into dd_smy_target_versions (
  form_code, form_id, form_version_id, version_number
)
select seed.form_code, f.id, fv.id, seed.version_number
from (
  values
    ('OPENING_FOH'::text, 4),
    ('OPENING_BOH'::text, 3),
    ('CLOSING_FOH'::text, 3),
    ('CLOSING_BOH'::text, 3)
) as seed(form_code, version_number)
join public.forms f
  on f.organization_id = (select organization_id from dd_smy_context limit 1)
 and upper(f.code) = seed.form_code
 and f.is_active = true
join public.form_versions fv
  on fv.form_id = f.id
 and fv.version_number = seed.version_number
 and fv.status = 'published';

do $$
declare
  v_count integer;
  v_bad text;
begin
  select count(*) into v_count from dd_smy_target_versions;
  if v_count <> 4 then
    raise exception 'DD SMY STOP: expected 4 exact published DD versions, found %.', v_count;
  end if;

  select count(*) into v_count
  from dd_smy_target_versions tv
  join public.outlet_form_assignments ofa
    on ofa.outlet_id = (select cgu_outlet_id from dd_smy_context limit 1)
   and ofa.form_id = tv.form_id
   and ofa.form_version_id = tv.form_version_id
   and ofa.is_active = true;

  if v_count <> 4 then
    raise exception 'DD SMY STOP: CGU exact split baseline invalid.';
  end if;

  select count(*) into v_count
  from public.outlet_form_assignments ofa
  join public.forms f on f.id = ofa.form_id
  where ofa.outlet_id = (select smy_outlet_id from dd_smy_context limit 1)
    and ofa.is_active = true
    and upper(f.code) in ('OPENING_FOH','OPENING_BOH','CLOSING_FOH','CLOSING_BOH');

  if v_count <> 0 then
    raise exception 'DD SMY STOP: expected 0 active SMY split assignments, found %.', v_count;
  end if;

  select count(*) into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o on o.id = ofa.outlet_id
  join public.forms f on f.id = ofa.form_id
  where o.id in (
      select cgu_outlet_id from dd_smy_context
      union all
      select smy_outlet_id from dd_smy_context
    )
    and ofa.is_active = true
    and upper(f.code) in ('OPENING','CLOSING');

  if v_count <> 4 then
    raise exception 'DD SMY STOP: expected 4 active DD legacy assignments, found %.', v_count;
  end if;

  with expected(code, available) as (
    values
      ('PARKING'::text, false),
      ('VALET'::text, false),
      ('GENSET'::text, false),
      ('PLAYGROUND'::text, true),
      ('KARAOKE'::text, true),
      ('LIFT'::text, true)
  )
  select string_agg(e.code, ', ' order by e.code)
  into v_bad
  from expected e
  left join public.facility_definitions fd
    on fd.organization_id = (select organization_id from dd_smy_context limit 1)
   and fd.code = e.code
   and fd.is_active = true
  left join public.outlet_facilities ofc
    on ofc.outlet_id = (select smy_outlet_id from dd_smy_context limit 1)
   and ofc.facility_id = fd.id
  where fd.id is null
     or ofc.facility_id is null
     or ofc.is_available is distinct from e.available;

  if v_bad is not null then
    raise exception 'DD SMY STOP: facility mismatch: %.', v_bad;
  end if;

  select count(*) into v_count
  from public.questions q
  join public.form_version_sections fvs on fvs.id = q.version_section_id
  join dd_smy_target_versions tv
    on tv.form_version_id = fvs.form_version_id
   and tv.form_code = 'OPENING_FOH'
  where q.code = 'OPN_FOH_060'
    and q.is_active = true
    and q.config ->> 'evidence_mode' = 'always'
    and q.config #>> '{applicability,type}' = 'facility'
    and q.config #>> '{applicability,facility_key}' = 'LIFT';

  if v_count <> 1 then
    raise exception 'DD SMY STOP: lift question is missing or invalid.';
  end if;
end;
$$;

insert into dd_smy_cq_snapshot (
  outlet_code, form_code, assignment_id, form_version_id
)
select upper(o.code), upper(f.code), ofa.id, ofa.form_version_id
from public.outlet_form_assignments ofa
join public.outlets o on o.id = ofa.outlet_id
join public.forms f on f.id = ofa.form_id
join public.form_versions fv on fv.id = ofa.form_version_id
where o.organization_id = (select organization_id from dd_smy_context limit 1)
  and upper(o.code) in ('BDG','GS','HT','MOI','PIM','PL','PP','SP','TBZ')
  and upper(f.code) in ('OPENING_FOH','OPENING_BOH','CLOSING_FOH','CLOSING_BOH')
  and ofa.is_active = true
  and fv.status = 'published';

do $$
declare
  v_count integer;
begin
  select count(*) into v_count from dd_smy_cq_snapshot;
  if v_count <> 36 then
    raise exception 'DD SMY STOP: expected 36 CQ split assignments, found %.', v_count;
  end if;
end;
$$;

grant select on dd_smy_context, dd_smy_target_versions to authenticated;

do $$
declare
  v_admin_id uuid;
begin
  select admin_user_id into v_admin_id from dd_smy_context limit 1;
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

set local role authenticated;

do $$
declare
  v_smy_id uuid;
  v_row record;
begin
  select smy_outlet_id into v_smy_id from dd_smy_context limit 1;

  for v_row in
    select form_code, form_version_id
    from dd_smy_target_versions
    order by case form_code
      when 'OPENING_FOH' then 1
      when 'OPENING_BOH' then 2
      when 'CLOSING_FOH' then 3
      when 'CLOSING_BOH' then 4
      else 99
    end
  loop
    perform public.activate_outlet_form_version(v_smy_id, v_row.form_version_id);
  end loop;
end;
$$;

reset role;

do $$
declare
  v_count integer;
  v_bad text;
begin
  select count(*) into v_count
  from dd_smy_target_versions tv
  join public.outlet_form_assignments ofa
    on ofa.outlet_id = (select smy_outlet_id from dd_smy_context limit 1)
   and ofa.form_id = tv.form_id
   and ofa.form_version_id = tv.form_version_id
   and ofa.is_active = true;

  if v_count <> 4 then
    raise exception 'DD SMY POSTFLIGHT: expected 4 exact active SMY split assignments, found %.', v_count;
  end if;

  select count(*) into v_count
  from dd_smy_target_versions tv
  join public.outlet_form_assignments ofa
    on ofa.outlet_id = (select cgu_outlet_id from dd_smy_context limit 1)
   and ofa.form_id = tv.form_id
   and ofa.form_version_id = tv.form_version_id
   and ofa.is_active = true;

  if v_count <> 4 then
    raise exception 'DD SMY POSTFLIGHT: CGU changed unexpectedly.';
  end if;

  select count(*) into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o on o.id = ofa.outlet_id
  join public.forms f on f.id = ofa.form_id
  where o.id in (
      select cgu_outlet_id from dd_smy_context
      union all
      select smy_outlet_id from dd_smy_context
    )
    and ofa.is_active = true
    and upper(f.code) in ('OPENING','CLOSING');

  if v_count <> 4 then
    raise exception 'DD SMY POSTFLIGHT: DD legacy assignments changed.';
  end if;

  select string_agg(s.outlet_code || ':' || s.form_code, ', ')
  into v_bad
  from dd_smy_cq_snapshot s
  left join public.outlet_form_assignments ofa
    on ofa.id = s.assignment_id
   and ofa.is_active = true
   and ofa.form_version_id = s.form_version_id
  left join public.form_versions fv
    on fv.id = s.form_version_id
  where ofa.id is null or fv.status <> 'published';

  if v_bad is not null then
    raise exception 'DD SMY POSTFLIGHT: CQ protection failed: %.', v_bad;
  end if;
end;
$$;

commit;
