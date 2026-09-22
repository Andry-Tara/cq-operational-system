begin;

create temporary table hk_moi_context (
  organization_id uuid not null,
  form_id uuid not null,
  moi_outlet_id uuid not null,
  v5_id uuid not null,
  v7_id uuid not null,
  admin_user_id uuid null
) on commit drop;

create temporary table hk_moi_assignment_snapshot (
  outlet_id uuid primary key,
  outlet_code text not null,
  assignment_id uuid not null,
  form_version_id uuid not null
) on commit drop;

do $$
declare
  v_org_id uuid;
  v_form_id uuid;
  v_moi_id uuid;
  v5_id uuid;
  v7_id uuid;
  v_count integer;
begin
  select
    o.organization_id,
    o.id
  into
    v_org_id,
    v_moi_id
  from public.outlets o
  where upper(o.code) = 'MOI'
    and o.is_active = true
  limit 1;

  if v_moi_id is null then
    raise exception
      'MOI V7 STOP: active MOI outlet not found.';
  end if;

  select f.id
  into v_form_id
  from public.forms f
  where f.organization_id = v_org_id
    and f.code = 'OPENING_FOH'
    and f.operational_scope = 'restaurant'
    and f.is_active = true
  limit 1;

  if v_form_id is null then
    raise exception
      'MOI V7 STOP: OPENING_FOH form not found.';
  end if;

  select fv.id
  into v5_id
  from public.form_versions fv
  where fv.form_id = v_form_id
    and fv.version_number = 5
    and fv.status = 'published'
  limit 1;

  select fv.id
  into v7_id
  from public.form_versions fv
  where fv.form_id = v_form_id
    and fv.version_number = 7
    and fv.status = 'draft'
  limit 1;

  if v5_id is null then
    raise exception
      'MOI V7 STOP: published v5 missing.';
  end if;

  if v7_id is null then
    raise exception
      'MOI V7 STOP: draft v7 missing.';
  end if;

  select count(*)
  into v_count
  from public.outlet_form_assignments ofa
  where ofa.outlet_id = v_moi_id
    and ofa.form_id = v_form_id
    and ofa.form_version_id = v5_id
    and ofa.is_active = true;

  if v_count <> 1 then
    raise exception
      'MOI V7 STOP: expected exactly one active MOI v5 assignment, found %.',
      v_count;
  end if;

  if exists (
    select 1
    from public.reports r
    where r.outlet_id = v_moi_id
      and r.form_id = v_form_id
      and r.form_version_id = v5_id
      and lower(r.status) in (
        'draft',
        'in_progress',
        'reopened',
        'needs_correction'
      )
  ) then
    raise exception
      'MOI V7 STOP: unfinished MOI v5 report exists.';
  end if;

  insert into hk_moi_context (
    organization_id,
    form_id,
    moi_outlet_id,
    v5_id,
    v7_id
  )
  values (
    v_org_id,
    v_form_id,
    v_moi_id,
    v5_id,
    v7_id
  );
end;
$$;

do $$
declare
  v7_id uuid;
  v_count integer;
begin
  select ctx.v7_id
  into v7_id
  from hk_moi_context ctx
  limit 1;

  select count(*)
  into v_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v7_id
    and q.code = 'OPN_FOH_047'
    and q.is_active = true
    and q.config ->> 'evidence_mode' = 'always'
    and q.config #>> '{applicability,type}' = 'facility'
    and q.config #>> '{applicability,facility_key}' = 'HOUSEKEEPING';

  if v_count <> 1 then
    raise exception
      'MOI V7 STOP: OPN_FOH_047 housekeeping config invalid.';
  end if;
end;
$$;

insert into hk_moi_assignment_snapshot (
  outlet_id,
  outlet_code,
  assignment_id,
  form_version_id
)
select
  o.id,
  upper(o.code),
  ofa.id,
  ofa.form_version_id
from public.outlet_form_assignments ofa
join public.outlets o
  on o.id = ofa.outlet_id
join hk_moi_context ctx
  on ctx.form_id = ofa.form_id
where o.organization_id = ctx.organization_id
  and upper(o.code) in (
    'BDG',
    'GS',
    'HT',
    'PIM',
    'PL',
    'PP',
    'SP',
    'TBZ',
    'CGU',
    'SMY'
  )
  and ofa.is_active = true;

do $$
declare
  v_org_id uuid;
  v_admin_id uuid;
  v_candidate record;
begin
  select organization_id
  into v_org_id
  from hk_moi_context
  limit 1;

  for v_candidate in
    select p.id
    from public.profiles p
    where p.organization_id = v_org_id
      and p.is_active = true
    order by p.id
  loop
    perform set_config(
      'request.jwt.claim.sub',
      v_candidate.id::text,
      true
    );

    perform set_config(
      'request.jwt.claim.role',
      'authenticated',
      true
    );

    if public.is_org_admin(v_org_id) then
      v_admin_id := v_candidate.id;
      exit;
    end if;
  end loop;

  if v_admin_id is null then
    raise exception
      'MOI V7 STOP: active organization admin not found.';
  end if;

  update hk_moi_context
  set admin_user_id = v_admin_id;
end;
$$;

grant select
on hk_moi_context
to authenticated;

set local role authenticated;

do $$
declare
  v7_id uuid;
begin
  select ctx.v7_id
  into v7_id
  from hk_moi_context ctx
  limit 1;

  perform public.publish_form_version(
    v7_id
  );
end;
$$;

do $$
declare
  v_moi_id uuid;
  v7_id uuid;
begin
  select
    ctx.moi_outlet_id,
    ctx.v7_id
  into
    v_moi_id,
    v7_id
  from hk_moi_context ctx
  limit 1;

  perform public.activate_outlet_form_version(
    v_moi_id,
    v7_id
  );
end;
$$;

reset role;

do $$
declare
  v_form_id uuid;
  v_moi_id uuid;
  v7_id uuid;
  v_count integer;
  v_bad text;
begin
  select
    ctx.form_id,
    ctx.moi_outlet_id,
    ctx.v7_id
  into
    v_form_id,
    v_moi_id,
    v7_id
  from hk_moi_context ctx
  limit 1;

  select count(*)
  into v_count
  from public.form_versions fv
  where fv.id = v7_id
    and fv.status = 'published'
    and fv.published_at is not null;

  if v_count <> 1 then
    raise exception
      'MOI V7 POSTCHECK: v7 not published.';
  end if;

  select count(*)
  into v_count
  from public.outlet_form_assignments ofa
  where ofa.outlet_id = v_moi_id
    and ofa.form_id = v_form_id
    and ofa.form_version_id = v7_id
    and ofa.is_active = true;

  if v_count <> 1 then
    raise exception
      'MOI V7 POSTCHECK: MOI is not active on v7.';
  end if;

  select string_agg(
    snap.outlet_code,
    ', '
    order by snap.outlet_code
  )
  into v_bad
  from hk_moi_assignment_snapshot snap
  left join public.outlet_form_assignments ofa
    on ofa.id = snap.assignment_id
   and ofa.outlet_id = snap.outlet_id
   and ofa.form_version_id = snap.form_version_id
   and ofa.is_active = true
  where ofa.id is null;

  if v_bad is not null then
    raise exception
      'MOI V7 POSTCHECK: non-MOI assignment changed: %.',
      v_bad;
  end if;
end;
$$;

commit;
