begin;

do $$
declare
  v_org_id uuid;
  v_form_id uuid;
  v_source_version_id uuid;
  v_draft_version_id uuid;
  v_admin_id uuid;
  v_housekeeping_id uuid;
  v_candidate record;
  v_max_version integer;
  v_draft_version integer;
  v_count integer;
  v_source_questions integer;
  v_draft_questions integer;
begin
  select
    f.organization_id,
    f.id,
    fv.id
  into
    v_org_id,
    v_form_id,
    v_source_version_id
  from public.forms f
  join public.form_versions fv
    on fv.form_id = f.id
  where f.code = 'OPENING_FOH'
    and f.operational_scope = 'restaurant'
    and f.is_active = true
    and fv.version_number = 5
    and fv.status = 'published'
  limit 1;

  if v_source_version_id is null then
    raise exception
      'HK DRAFT STOP: published OPENING_FOH v5 not found.';
  end if;

  select max(version_number)
  into v_max_version
  from public.form_versions
  where form_id = v_form_id;

  if v_max_version <> 6 then
    raise exception
      'HK DRAFT STOP: expected max version 6, found %.',
      v_max_version;
  end if;

  select count(*)
  into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o
    on o.id = ofa.outlet_id
  where ofa.form_id = v_form_id
    and ofa.form_version_id = v_source_version_id
    and ofa.is_active = true
    and upper(o.code) in (
      'BDG','GS','HT','MOI','PIM',
      'PL','PP','SP','TBZ'
    );

  if v_count <> 9 then
    raise exception
      'HK DRAFT STOP: expected 9 CQ outlets active on v5, found %.',
      v_count;
  end if;

  select fd.id
  into v_housekeeping_id
  from public.facility_definitions fd
  where fd.organization_id = v_org_id
    and fd.code = 'HOUSEKEEPING'
    and fd.is_active = true
  limit 1;

  if v_housekeeping_id is null then
    raise exception
      'HK DRAFT STOP: HOUSEKEEPING facility definition missing.';
  end if;

  insert into public.outlet_facilities (
    outlet_id,
    facility_id,
    is_available,
    notes
  )
  select
    o.id,
    v_housekeeping_id,
    true,
    'Confirmed housekeeping available 2026-09-22'
  from public.outlets o
  where o.organization_id = v_org_id
    and o.is_active = true
    and upper(o.code) in (
      'BDG','GS','HT','PL','PP','SP','TBZ'
    )
  on conflict (
    outlet_id,
    facility_id
  )
  do update set
    is_available = true,
    notes = excluded.notes,
    updated_at = now();

  select count(*)
  into v_count
  from public.outlets o
  join public.outlet_facilities ofa
    on ofa.outlet_id = o.id
   and ofa.facility_id = v_housekeeping_id
  where o.organization_id = v_org_id
    and upper(o.code) in (
      'BDG','GS','HT','PL','PP','SP','TBZ'
    )
    and ofa.is_available = true;

  if v_count <> 7 then
    raise exception
      'HK DRAFT STOP: expected 7 HOUSEKEEPING=true CQ outlets, found %.',
      v_count;
  end if;

  select count(*)
  into v_count
  from public.outlets o
  join public.outlet_facilities ofa
    on ofa.outlet_id = o.id
   and ofa.facility_id = v_housekeeping_id
  where o.organization_id = v_org_id
    and upper(o.code) in ('PIM','MOI')
    and ofa.is_available = false;

  if v_count <> 2 then
    raise exception
      'HK DRAFT STOP: PIM and MOI must both be HOUSEKEEPING=false.';
  end if;

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
      'HK DRAFT STOP: active ORG_ADMIN not found.';
  end if;

  v_draft_version_id :=
    public.clone_form_version_to_draft(
      v_source_version_id
    );

  if v_draft_version_id is null then
    raise exception
      'HK DRAFT STOP: clone returned null.';
  end if;

  select fv.version_number
  into v_draft_version
  from public.form_versions fv
  where fv.id = v_draft_version_id
    and fv.status = 'draft';

  if v_draft_version <> 7 then
    raise exception
      'HK DRAFT STOP: expected draft v7, found v%.',
      v_draft_version;
  end if;

  update public.form_versions
  set notes =
    'CQ OPENING_FOH v7 - housekeeping facility applicability for OPN_FOH_047.'
  where id = v_draft_version_id
    and status = 'draft';

  update public.questions q
  set config =
    jsonb_set(
      coalesce(q.config, '{}'::jsonb),
      '{applicability}',
      jsonb_build_object(
        'type',
        'facility',
        'facility_key',
        'HOUSEKEEPING'
      ),
      true
    )
  from public.form_version_sections fvs
  where fvs.id = q.version_section_id
    and fvs.form_version_id = v_draft_version_id
    and q.code = 'OPN_FOH_047'
    and q.is_active = true;

  select count(*)
  into v_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_draft_version_id
    and q.code = 'OPN_FOH_047'
    and q.is_active = true
    and q.config ->> 'evidence_mode' = 'always'
    and q.config #>> '{applicability,type}' = 'facility'
    and q.config #>> '{applicability,facility_key}' = 'HOUSEKEEPING';

  if v_count <> 1 then
    raise exception
      'HK DRAFT POSTCHECK: OPN_FOH_047 configuration invalid.';
  end if;

  select count(*)
  into v_source_questions
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_source_version_id
    and q.is_active = true;

  select count(*)
  into v_draft_questions
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_draft_version_id
    and q.is_active = true;

  if v_source_questions <> v_draft_questions then
    raise exception
      'HK DRAFT POSTCHECK: question count changed source=% draft=%.',
      v_source_questions,
      v_draft_questions;
  end if;
end;
$$;

commit;
