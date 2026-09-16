begin;

-- ============================================================
-- O3K-C — ROLLOUT ALL-PHOTO BILINGUAL V2 TO CQ OUTLETS
--
-- Pilot source:
--   GS / CQ Gading Serpong
--
-- Target set:
--   BDG, HT, MOI, PIM, PL, PP, SP, TBZ
--
-- IMPORTANT:
--   Activation is idempotent. If an outlet/form is already on
--   the exact GS pilot version (for example HT), it is skipped.
--
-- DD CGU / SMY and CK are untouched.
-- ============================================================

create temporary table o3kc_target_outlets (
  outlet_code text primary key
) on commit drop;

insert into o3kc_target_outlets (outlet_code)
values
  ('BDG'), ('HT'), ('MOI'), ('PIM'),
  ('PL'), ('PP'), ('SP'), ('TBZ');

create temporary table o3kc_target_forms (
  form_code text primary key,
  expected_questions integer not null
) on commit drop;

insert into o3kc_target_forms (form_code, expected_questions)
values
  ('OPENING_FOH', 59),
  ('OPENING_BOH', 33),
  ('CLOSING_FOH', 12),
  ('CLOSING_BOH', 21);

create temporary table o3kc_source_versions (
  form_code text primary key,
  form_id uuid not null unique,
  form_version_id uuid not null unique,
  version_number integer not null
) on commit drop;

do $$
declare
  v_org_id uuid;
  v_count integer;
  v_bad text;
begin
  select o.organization_id
  into v_org_id
  from public.outlets o
  where upper(o.code) = 'GS'
    and o.is_active = true
  limit 1;

  if v_org_id is null then
    raise exception 'O3K-C STOP: active GS pilot outlet not found.';
  end if;

  insert into o3kc_source_versions (
    form_code,
    form_id,
    form_version_id,
    version_number
  )
  select
    upper(f.code),
    f.id,
    ofa.form_version_id,
    fv.version_number
  from public.outlets o
  join public.outlet_form_assignments ofa
    on ofa.outlet_id = o.id
   and ofa.is_active = true
  join public.forms f
    on f.id = ofa.form_id
   and f.organization_id = o.organization_id
   and f.operational_scope = 'restaurant'
   and f.is_active = true
  join o3kc_target_forms tf
    on tf.form_code = upper(f.code)
  join public.form_versions fv
    on fv.id = ofa.form_version_id
   and fv.form_id = f.id
   and fv.status = 'published'
  where upper(o.code) = 'GS'
    and o.organization_id = v_org_id
    and o.is_active = true;

  if (select count(*) from o3kc_source_versions) <> 4 then
    raise exception
      'O3K-C STOP: GS must have exactly 4 active published split versions.';
  end if;

  select string_agg(
    form_code || ':v' || version_number::text,
    ', ' order by form_code
  )
  into v_bad
  from o3kc_source_versions
  where version_number < 2;

  if v_bad is not null then
    raise exception
      'O3K-C STOP: GS is not on v2+ for: %.',
      v_bad;
  end if;

  select count(*)
  into v_count
  from o3kc_target_outlets t
  join public.outlets o
    on upper(o.code) = t.outlet_code
   and o.organization_id = v_org_id
   and o.is_active = true;

  if v_count <> 8 then
    raise exception
      'O3K-C STOP: expected 8 active target CQ outlets, found %.',
      v_count;
  end if;

  if exists (
    select 1
    from o3kc_target_outlets
    where outlet_code in ('GS', 'CGU', 'SMY', 'CNT')
  ) then
    raise exception
      'O3K-C STOP: protected outlet included in target set.';
  end if;

  select string_agg(o.code, ', ' order by o.code)
  into v_bad
  from o3kc_target_outlets t
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
      'O3K-C STOP: target outlet missing 4 active published split assignments: %.',
      v_bad;
  end if;

  select count(*)
  into v_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  join o3kc_source_versions sv
    on sv.form_version_id = fvs.form_version_id
  where q.is_active = true
    and q.config ->> 'evidence_mode' = 'always';

  if v_count <> 125 then
    raise exception
      'O3K-C STOP: expected 125 all-photo questions in GS source versions, found %.',
      v_count;
  end if;

  select count(*)
  into v_count
  from public.question_translations qt
  join public.questions q
    on q.id = qt.question_id
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  join o3kc_source_versions sv
    on sv.form_version_id = fvs.form_version_id
  where q.is_active = true
    and qt.locale in ('en', 'id-ID')
    and nullif(trim(qt.question_text), '') is not null;

  if v_count <> 250 then
    raise exception
      'O3K-C STOP: expected 250 EN/ID question translations, found %.',
      v_count;
  end if;

  select string_agg(
    o.code || ':' || sv.form_code,
    ', ' order by o.code, sv.form_code
  )
  into v_bad
  from o3kc_target_outlets t
  join public.outlets o
    on upper(o.code) = t.outlet_code
   and o.organization_id = v_org_id
  cross join o3kc_source_versions sv
  where not exists (
    select 1
    from public.user_form_permissions ufp
    join public.user_outlets uo
      on uo.user_id = ufp.user_id
     and uo.outlet_id = ufp.outlet_id
     and uo.is_active = true
    where ufp.outlet_id = o.id
      and ufp.form_id = sv.form_id
      and ufp.can_fill = true
      and ufp.can_submit = true
  );

  if v_bad is not null then
    raise exception
      'O3K-C STOP: no active fill+submit operator for: %.',
      v_bad;
  end if;
end;
$$;

-- ============================================================
-- O3K-C AUTHENTICATED ADMIN CONTEXT
--
-- activate_outlet_form_version() is intentionally auth-guarded.
-- Supabase CLI migrations do not carry a JWT subject, so select
-- an existing organization admin and establish transaction-local JWT
-- claims only for the controlled activation RPCs.
--
-- IMPORTANT: do NOT SET ROLE authenticated here. The rollout uses temporary
-- tables created by the migration session role; changing the DB role would
-- lose access to those temp tables. The activation RPC authorizes via
-- auth.uid() + has_org_permission(), so JWT claims are sufficient.
-- ============================================================

create temporary table o3kc_auth_context (
  admin_user_id uuid primary key,
  organization_id uuid not null
) on commit drop;

do $$
declare
  v_org_id uuid;
  v_admin_user_id uuid;
begin
  select o.organization_id
  into v_org_id
  from public.outlets o
  where upper(o.code) = 'GS'
    and o.is_active = true
  limit 1;

  if v_org_id is null then
    raise exception
      'O3K-C STOP: GS organization could not be resolved for auth context.';
  end if;

  select p.id
  into v_admin_user_id
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
  order by p.id
  limit 1;

  if v_admin_user_id is null then
    raise exception
      'O3K-C STOP: no active organization admin was found for rollout authentication.';
  end if;

  perform set_config(
    'request.jwt.claim.sub',
    v_admin_user_id::text,
    true
  );

  perform set_config(
    'request.jwt.claim.role',
    'authenticated',
    true
  );

  insert into o3kc_auth_context (
    admin_user_id,
    organization_id
  )
  values (
    v_admin_user_id,
    v_org_id
  );
end;
$$;


do $$
declare
  v_admin_user_id uuid;
  v_org_id uuid;
begin
  select
    admin_user_id,
    organization_id
  into
    v_admin_user_id,
    v_org_id
  from o3kc_auth_context
  limit 1;

  if auth.uid() is distinct from v_admin_user_id then
    raise exception
      'O3K-C STOP: authenticated rollout subject was not established correctly.';
  end if;

  if public.is_org_admin(v_org_id) is distinct from true then
    raise exception
      'O3K-C STOP: selected rollout subject is not an organization admin.';
  end if;
end;
$$;


-- Activate only when the exact GS pilot version is not already active.
do $$
declare
  v_row record;
begin
  for v_row in
    select
      o.id as outlet_id,
      o.code as outlet_code,
      sv.form_code,
      sv.form_id,
      sv.form_version_id
    from o3kc_target_outlets t
    join public.outlets o
      on upper(o.code) = t.outlet_code
     and o.is_active = true
    cross join o3kc_source_versions sv
    where not exists (
      select 1
      from public.outlet_form_assignments ofa
      where ofa.outlet_id = o.id
        and ofa.form_id = sv.form_id
        and ofa.form_version_id = sv.form_version_id
        and ofa.is_active = true
    )
    order by o.code, sv.form_code
  loop
    perform public.activate_outlet_form_version(
      v_row.outlet_id,
      v_row.form_version_id
    );
  end loop;
end;
$$;

-- Keep the migration session DB role; only JWT claims are impersonated.

do $$
declare
  v_count integer;
  v_bad text;
begin
  select count(*)
  into v_count
  from o3kc_target_outlets t
  join public.outlets o
    on upper(o.code) = t.outlet_code
   and o.is_active = true
  join public.outlet_form_assignments ofa
    on ofa.outlet_id = o.id
   and ofa.is_active = true
  join o3kc_source_versions sv
    on sv.form_id = ofa.form_id
   and sv.form_version_id = ofa.form_version_id;

  if v_count <> 32 then
    raise exception
      'O3K-C STOP: expected 32 active target assignments on GS versions, found %.',
      v_count;
  end if;

  select string_agg(
    o.code || ':' || sv.form_code,
    ', ' order by o.code, sv.form_code
  )
  into v_bad
  from o3kc_target_outlets t
  join public.outlets o
    on upper(o.code) = t.outlet_code
   and o.is_active = true
  cross join o3kc_source_versions sv
  where (
    select count(*)
    from public.outlet_form_assignments ofa
    where ofa.outlet_id = o.id
      and ofa.form_id = sv.form_id
      and ofa.is_active = true
      and ofa.form_version_id = sv.form_version_id
  ) <> 1;

  if v_bad is not null then
    raise exception
      'O3K-C STOP: active-version verification failed: %.',
      v_bad;
  end if;

  select count(*)
  into v_count
  from public.outlets o
  join public.outlet_form_assignments ofa
    on ofa.outlet_id = o.id
   and ofa.is_active = true
  join o3kc_source_versions sv
    on sv.form_id = ofa.form_id
   and sv.form_version_id = ofa.form_version_id
  where upper(o.code) = 'GS';

  if v_count <> 4 then
    raise exception
      'O3K-C STOP: GS pilot assignment changed unexpectedly.';
  end if;

  if exists (
    select 1
    from public.outlets o
    join public.outlet_form_assignments ofa
      on ofa.outlet_id = o.id
     and ofa.is_active = true
    join public.forms f
      on f.id = ofa.form_id
    where upper(o.code) in ('CGU', 'SMY')
      and upper(f.code) in (
        'OPENING_FOH',
        'OPENING_BOH',
        'CLOSING_FOH',
        'CLOSING_BOH'
      )
  ) then
    raise exception
      'O3K-C STOP: DD unexpectedly has an active split assignment.';
  end if;
end;
$$;

commit;
