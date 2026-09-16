begin;

-- ============================================================
-- OPENING_FOH V3 DRAFT — GROUPING CLEANUP
--
-- Source:
--   exact active published OPENING_FOH version at GS
--
-- Result:
--   one new draft only; no publish and no outlet activation.
--
-- Structural change:
--   PARKING_AREA -> ENTRANCE_EXTERIOR
--
--   Entrance / Exterior:
--     OPN_FOH_001 Signage prima
--     OPN_FOH_003 Genset berfungsi
--     OPN_FOH_005 Pembuangan rapih & tidak berbau
--     OPN_FOH_006 Lobby bersih terawat
--     OPN_FOH_008 Tanaman rapih & terawat
--
--   Parking & Valet:
--     OPN_FOH_002 Halaman parkir bersih          [PARKING]
--     OPN_FOH_004 Gerbang parkir terbuka         [PARKING]
--     OPN_FOH_007 Area Vallet bersih terawat     [VALET]
--
-- Published v2 remains immutable and live.
-- ============================================================

create temporary table o3l_opening_foh_v3_context (
  organization_id uuid not null,
  form_id uuid not null,
  source_version_id uuid not null,
  draft_version_id uuid not null,
  version_section_id uuid not null
) on commit drop;

do $$
declare
  v_org_id uuid;
  v_form_id uuid;
  v_source_version_id uuid;
  v_source_version_number integer;
  v_max_version integer;
  v_admin_id uuid;
  v_candidate record;
  v_draft_version_id uuid;
  v_draft_version_number integer;
  v_version_section_id uuid;
  v_count integer;
begin
  select
    o.organization_id,
    f.id,
    ofa.form_version_id,
    fv.version_number
  into
    v_org_id,
    v_form_id,
    v_source_version_id,
    v_source_version_number
  from public.outlets o
  join public.outlet_form_assignments ofa
    on ofa.outlet_id = o.id
   and ofa.is_active = true
  join public.forms f
    on f.id = ofa.form_id
   and f.organization_id = o.organization_id
   and f.is_active = true
  join public.form_versions fv
    on fv.id = ofa.form_version_id
   and fv.form_id = f.id
   and fv.status = 'published'
  where upper(o.code) = 'GS'
    and o.is_active = true
    and upper(f.code) = 'OPENING_FOH';

  if v_source_version_id is null then
    raise exception
      'OPENING_FOH v3 STOP: active published GS source was not found.';
  end if;

  if v_source_version_number <> 2 then
    raise exception
      'OPENING_FOH v3 STOP: expected GS source v2, found v%.',
      v_source_version_number;
  end if;

  select max(fv.version_number)
  into v_max_version
  from public.form_versions fv
  where fv.form_id = v_form_id;

  if v_max_version <> 2 then
    raise exception
      'OPENING_FOH v3 STOP: expected max version 2 before clone, found %.',
      v_max_version;
  end if;

  select count(*)
  into v_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_source_version_id
    and q.is_active = true;

  if v_count <> 59 then
    raise exception
      'OPENING_FOH v3 STOP: expected 59 source questions, found %.',
      v_count;
  end if;

  select count(*)
  into v_count
  from public.question_groups qg
  join public.form_version_sections fvs
    on fvs.id = qg.version_section_id
  where fvs.form_version_id = v_source_version_id
    and qg.is_active = true;

  if v_count <> 6 then
    raise exception
      'OPENING_FOH v3 STOP: expected 6 source groups, found %.',
      v_count;
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
      'OPENING_FOH v3 STOP: active organization admin not found.';
  end if;

  if auth.uid() is distinct from v_admin_id then
    raise exception
      'OPENING_FOH v3 STOP: admin JWT subject was not established.';
  end if;

  v_draft_version_id :=
    public.clone_form_version_to_draft(v_source_version_id);

  if v_draft_version_id is null then
    raise exception
      'OPENING_FOH v3 STOP: clone RPC returned null.';
  end if;

  select fv.version_number
  into v_draft_version_number
  from public.form_versions fv
  where fv.id = v_draft_version_id
    and fv.form_id = v_form_id
    and fv.status = 'draft';

  if v_draft_version_number <> 3 then
    raise exception
      'OPENING_FOH v3 STOP: expected cloned draft v3, found v%.',
      v_draft_version_number;
  end if;

  select fvs.id
  into v_version_section_id
  from public.form_version_sections fvs
  join public.sections s
    on s.id = fvs.section_id
  where fvs.form_version_id = v_draft_version_id
    and upper(s.code) = 'FOH'
    and fvs.is_active = true;

  if v_version_section_id is null then
    raise exception
      'OPENING_FOH v3 STOP: FOH version section not found.';
  end if;

  insert into o3l_opening_foh_v3_context (
    organization_id,
    form_id,
    source_version_id,
    draft_version_id,
    version_section_id
  )
  values (
    v_org_id,
    v_form_id,
    v_source_version_id,
    v_draft_version_id,
    v_version_section_id
  );

  update public.form_versions
  set notes =
    'Opening FOH v3 draft: split Entrance / Exterior from Parking & Valet. '
    || 'No publish or activation performed.'
  where id = v_draft_version_id
    and status = 'draft';
end;
$$;

do $$
declare
  v_draft_version_id uuid;
  v_version_section_id uuid;
  v_entrance_group_id uuid;
  v_parking_group_id uuid;
  v_count integer;
begin
  select
    draft_version_id,
    version_section_id
  into
    v_draft_version_id,
    v_version_section_id
  from o3l_opening_foh_v3_context
  limit 1;

  select qg.id
  into v_entrance_group_id
  from public.question_groups qg
  where qg.version_section_id = v_version_section_id
    and upper(qg.code) = 'PARKING_AREA'
    and qg.is_active = true;

  if v_entrance_group_id is null then
    raise exception
      'OPENING_FOH v3 STOP: cloned PARKING_AREA group not found.';
  end if;

  update public.question_groups
  set
    code = 'ENTRANCE_EXTERIOR',
    name = 'Entrance / Exterior',
    sort_order = 10
  where id = v_entrance_group_id;

  update public.question_group_translations
  set
    display_name = case locale
      when 'en' then 'Entrance / Exterior'
      when 'id-ID' then 'Area Masuk / Eksterior'
      else display_name
    end,
    description = case locale
      when 'en' then 'Entrance, exterior, lobby, signage and supporting facilities.'
      when 'id-ID' then 'Area masuk, eksterior, lobby, signage, dan fasilitas pendukung.'
      else description
    end
  where question_group_id = v_entrance_group_id
    and locale in ('en', 'id-ID');

  select count(*)
  into v_count
  from public.question_group_translations qgt
  where qgt.question_group_id = v_entrance_group_id
    and qgt.locale in ('en', 'id-ID')
    and nullif(trim(qgt.display_name), '') is not null;

  if v_count <> 2 then
    raise exception
      'OPENING_FOH v3 STOP: Entrance / Exterior requires EN and ID translations.';
  end if;

  insert into public.question_groups (
    version_section_id,
    code,
    name,
    sort_order,
    is_active
  )
  values (
    v_version_section_id,
    'PARKING_VALET',
    'Parking & Valet',
    15,
    true
  )
  returning id into v_parking_group_id;

  insert into public.question_group_translations (
    question_group_id,
    locale,
    display_name,
    description
  )
  values
    (
      v_parking_group_id,
      'en',
      'Parking & Valet',
      'Parking and valet checks shown only when the related facility is available.'
    ),
    (
      v_parking_group_id,
      'id-ID',
      'Parkir & Valet',
      'Pemeriksaan parkir dan valet hanya tampil bila fasilitas terkait tersedia.'
    );

  update public.questions
  set question_group_id = v_parking_group_id
  where version_section_id = v_version_section_id
    and code in (
      'OPN_FOH_002',
      'OPN_FOH_004',
      'OPN_FOH_007'
    );

  get diagnostics v_count = row_count;

  if v_count <> 3 then
    raise exception
      'OPENING_FOH v3 STOP: expected to move 3 Parking/Valet questions, moved %.',
      v_count;
  end if;

  select count(*)
  into v_count
  from public.questions q
  where q.version_section_id = v_version_section_id
    and q.question_group_id = v_entrance_group_id
    and q.code in (
      'OPN_FOH_001',
      'OPN_FOH_003',
      'OPN_FOH_005',
      'OPN_FOH_006',
      'OPN_FOH_008'
    );

  if v_count <> 5 then
    raise exception
      'OPENING_FOH v3 STOP: Entrance / Exterior exact membership failed.';
  end if;

  select count(*)
  into v_count
  from public.questions q
  where q.version_section_id = v_version_section_id
    and q.question_group_id = v_parking_group_id
    and q.code in (
      'OPN_FOH_002',
      'OPN_FOH_004',
      'OPN_FOH_007'
    );

  if v_count <> 3 then
    raise exception
      'OPENING_FOH v3 STOP: Parking & Valet exact membership failed.';
  end if;

  if exists (
    select 1
    from public.questions q
    where q.version_section_id = v_version_section_id
      and (
        (
          q.code in ('OPN_FOH_002', 'OPN_FOH_004')
          and (
            q.config -> 'applicability' ->> 'type' <> 'facility'
            or q.config -> 'applicability' ->> 'facility_key' <> 'PARKING'
          )
        )
        or
        (
          q.code = 'OPN_FOH_007'
          and (
            q.config -> 'applicability' ->> 'type' <> 'facility'
            or q.config -> 'applicability' ->> 'facility_key' <> 'VALET'
          )
        )
      )
  ) then
    raise exception
      'OPENING_FOH v3 STOP: PARKING/VALET applicability changed unexpectedly.';
  end if;

  select count(*)
  into v_count
  from public.questions q
  where q.version_section_id = v_version_section_id
    and q.is_active = true
    and q.config ->> 'evidence_mode' = 'always';

  if v_count <> 59 then
    raise exception
      'OPENING_FOH v3 STOP: expected 59 all-photo questions, found %.',
      v_count;
  end if;

  select count(*)
  into v_count
  from public.question_groups qg
  where qg.version_section_id = v_version_section_id
    and qg.is_active = true;

  if v_count <> 7 then
    raise exception
      'OPENING_FOH v3 STOP: expected 7 draft groups after split, found %.',
      v_count;
  end if;

  select count(*)
  into v_count
  from public.questions q
  where q.version_section_id = v_version_section_id
    and q.is_active = true;

  if v_count <> 59 then
    raise exception
      'OPENING_FOH v3 STOP: expected 59 draft questions after regroup, found %.',
      v_count;
  end if;

  if exists (
    select 1
    from public.outlet_form_assignments ofa
    where ofa.form_version_id = v_draft_version_id
  ) then
    raise exception
      'OPENING_FOH v3 STOP: draft was unexpectedly assigned to an outlet.';
  end if;
end;
$$;

commit;
