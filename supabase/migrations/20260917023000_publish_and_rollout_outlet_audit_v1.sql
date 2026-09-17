begin;

create temporary table a53_context (
  organization_id uuid not null,
  form_id uuid not null,
  form_version_id uuid not null,
  admin_user_id uuid not null
) on commit drop;

create temporary table a53_target_outlets (
  outlet_id uuid primary key,
  outlet_code text not null,
  outlet_name text not null
) on commit drop;

do $$
declare
  v_org_id uuid;
  v_form_id uuid;
  v_version_id uuid;
  v_admin_id uuid;
  v_count integer;
begin
  select f.organization_id, f.id, fv.id
    into v_org_id, v_form_id, v_version_id
  from public.forms f
  join public.form_versions fv
    on fv.form_id = f.id
   and fv.version_number = 1
  where upper(f.code) = 'OUTLET_AUDIT'
    and f.operational_scope = 'restaurant'
    and f.is_active = true
    and fv.status = 'draft'
  limit 1;

  if v_form_id is null or v_version_id is null then
    raise exception 'A5.3 STOP: OUTLET_AUDIT V1 draft not found.';
  end if;

  select p.id
    into v_admin_id
  from public.profiles p
  join public.user_roles ur
    on ur.user_id = p.id
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
    raise exception 'A5.3 STOP: no active admin user available.';
  end if;

  select count(*)
    into v_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_version_id
    and q.is_active = true;

  if v_count <> 98 then
    raise exception 'A5.3 STOP: expected 98 active audit points, found %.', v_count;
  end if;

  select count(*)
    into v_count
  from public.question_groups qg
  join public.form_version_sections fvs
    on fvs.id = qg.version_section_id
  where fvs.form_version_id = v_version_id
    and qg.is_active = true;

  if v_count <> 7 then
    raise exception 'A5.3 STOP: expected 7 active audit groups, found %.', v_count;
  end if;

  insert into a53_context
    (organization_id, form_id, form_version_id, admin_user_id)
  values
    (v_org_id, v_form_id, v_version_id, v_admin_id);
end;
$$;

insert into a53_target_outlets (outlet_id, outlet_code, outlet_name)
select distinct
  o.id,
  upper(o.code),
  o.name
from public.outlets o
join public.outlet_form_assignments ofa
  on ofa.outlet_id = o.id
 and ofa.is_active = true
join public.forms f
  on f.id = ofa.form_id
 and f.organization_id = o.organization_id
 and upper(f.code) = 'OPENING_FOH'
join public.form_versions fv
  on fv.id = ofa.form_version_id
 and fv.form_id = f.id
 and fv.status = 'published'
where o.organization_id = (
    select organization_id from a53_context limit 1
  )
  and o.is_active = true;

do $$
declare
  v_count integer;
  v_codes text;
begin
  select count(*) into v_count from a53_target_outlets;
  select string_agg(outlet_code, ', ' order by outlet_code)
    into v_codes
  from a53_target_outlets;

  if v_count <> 11 then
    raise exception
      'A5.3 STOP: expected 11 restaurant rollout outlets, found % (%).',
      v_count, coalesce(v_codes, '-');
  end if;

  if exists (
    select 1 from a53_target_outlets where outlet_code = 'CNT'
  ) then
    raise exception 'A5.3 STOP: CNT must not be in restaurant rollout.';
  end if;
end;
$$;

do $$
declare
  v_admin_id uuid;
begin
  select admin_user_id
    into v_admin_id
  from a53_context
  limit 1;

  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
end;
$$;

do $$
declare
  v_version_id uuid;
begin
  select form_version_id
    into v_version_id
  from a53_context
  limit 1;

  perform public.publish_form_version(v_version_id);
end;
$$;

do $$
declare
  v_version_id uuid;
  v_outlet record;
begin
  select form_version_id
    into v_version_id
  from a53_context
  limit 1;

  for v_outlet in
    select outlet_id, outlet_code
    from a53_target_outlets
    order by outlet_code
  loop
    perform public.activate_outlet_form_version(
      v_outlet.outlet_id,
      v_version_id
    );
  end loop;
end;
$$;

do $$
declare
  v_form_id uuid;
  v_version_id uuid;
  v_count integer;
begin
  select form_id, form_version_id
    into v_form_id, v_version_id
  from a53_context
  limit 1;

  select count(*)
    into v_count
  from public.form_versions fv
  where fv.id = v_version_id
    and fv.status = 'published'
    and fv.published_at is not null;

  if v_count <> 1 then
    raise exception 'A5.3 POSTCHECK: V1 was not published correctly.';
  end if;

  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join a53_target_outlets t
    on t.outlet_id = ofa.outlet_id
  where ofa.form_id = v_form_id
    and ofa.form_version_id = v_version_id
    and ofa.is_active = true
    and ofa.effective_until is null;

  if v_count <> 11 then
    raise exception
      'A5.3 POSTCHECK: expected 11 active audit assignments, found %.',
      v_count;
  end if;

  if exists (
    select 1
    from public.outlet_form_assignments ofa
    join public.outlets o on o.id = ofa.outlet_id
    where ofa.form_id = v_form_id
      and ofa.is_active = true
      and upper(o.code) = 'CNT'
  ) then
    raise exception 'A5.3 POSTCHECK: CNT must not have active audit assignment.';
  end if;
end;
$$;

commit;
