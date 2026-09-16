begin;

-- ============================================================
-- DD SPLIT DEDICATED DRAFT VERSIONS
--
-- CGU = DD Canggu
-- SMY = DD Seminyak
--
-- Same split form IDs/codes as CQ, dedicated versions only.
-- No publish, assignment, legacy retirement, or permission change.
-- ============================================================

create temporary table dd_context (
  organization_id uuid not null,
  admin_user_id uuid not null,
  legacy_opening_version_id uuid not null,
  legacy_closing_version_id uuid not null
) on commit drop;

create temporary table dd_version_map (
  form_code text primary key,
  form_id uuid not null,
  source_version_id uuid not null,
  source_version_number integer not null,
  draft_version_id uuid not null,
  draft_version_number integer not null,
  strategy text not null
) on commit drop;

create temporary table dd_target_section_map (
  form_code text primary key,
  version_section_id uuid not null
) on commit drop;

-- ============================================================
-- 1. RESOLVE ARCHITECTURE + LEGACY SOURCES + ADMIN
-- ============================================================

do $$
declare
  v_org_id uuid;
  v_bdg_org_id uuid;
  v_admin_id uuid;
  v_candidate record;
  v_legacy_opening uuid;
  v_legacy_closing uuid;
  v_count integer;
begin
  select o.organization_id
    into v_org_id
  from public.outlets o
  where upper(o.code) = 'CGU'
    and o.is_active = true
  limit 1;

  if v_org_id is null then
    raise exception 'DD DRAFT STOP: active CGU/SMY outlets not found.';
  end if;

  select count(*)
    into v_count
  from public.outlets o
  where upper(o.code) in ('CGU', 'SMY')
    and o.is_active = true
    and o.organization_id = v_org_id;

  if v_count <> 2 then
    raise exception
      'DD DRAFT STOP: expected CGU and SMY in one organization, found % matching rows.',
      v_count;
  end if;

  select o.organization_id
    into v_bdg_org_id
  from public.outlets o
  where upper(o.code) = 'BDG'
    and o.is_active = true
  limit 1;

  if v_bdg_org_id is null
     or v_bdg_org_id <> v_org_id then
    raise exception
      'DD DRAFT STOP: DD and CQ reference outlet are not in the same organization.';
  end if;

  if exists (
    select 1
    from public.outlets o
    where upper(o.code) in ('CGU', 'SMY')
      and o.is_active = true
      and coalesce(o.default_locale, '') <> 'en'
  ) then
    raise exception 'DD DRAFT STOP: CGU/SMY default_locale must remain en.';
  end if;

  if exists (
    select 1
    from public.outlet_form_assignments ofa
    join public.outlets o on o.id = ofa.outlet_id
    join public.forms f on f.id = ofa.form_id
    where upper(o.code) in ('CGU', 'SMY')
      and o.organization_id = v_org_id
      and ofa.is_active = true
      and upper(f.code) in (
        'OPENING_FOH',
        'OPENING_BOH',
        'CLOSING_FOH',
        'CLOSING_BOH'
      )
  ) then
    raise exception 'DD DRAFT STOP: DD already has active split assignments.';
  end if;

  select ofa.form_version_id
    into v_legacy_opening
  from public.outlet_form_assignments ofa
  join public.outlets o on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
   and f.organization_id = v_org_id
  join public.form_versions fv
    on fv.id = ofa.form_version_id
   and fv.form_id = f.id
  where upper(o.code) in ('CGU', 'SMY')
    and ofa.is_active = true
    and upper(f.code) = 'OPENING'
    and fv.status = 'published'
    and fv.version_number = 1
  order by upper(o.code)
  limit 1;

  select count(distinct ofa.form_version_id)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
   and f.organization_id = v_org_id
  where upper(o.code) in ('CGU', 'SMY')
    and ofa.is_active = true
    and upper(f.code) = 'OPENING';

  if v_legacy_opening is null or v_count <> 1 then
    raise exception
      'DD DRAFT STOP: CGU/SMY do not share one active legacy OPENING v1.';
  end if;

  select ofa.form_version_id
    into v_legacy_closing
  from public.outlet_form_assignments ofa
  join public.outlets o on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
   and f.organization_id = v_org_id
  join public.form_versions fv
    on fv.id = ofa.form_version_id
   and fv.form_id = f.id
  where upper(o.code) in ('CGU', 'SMY')
    and ofa.is_active = true
    and upper(f.code) = 'CLOSING'
    and fv.status = 'published'
    and fv.version_number = 1
  order by upper(o.code)
  limit 1;

  select count(distinct ofa.form_version_id)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o on o.id = ofa.outlet_id
  join public.forms f
    on f.id = ofa.form_id
   and f.organization_id = v_org_id
  where upper(o.code) in ('CGU', 'SMY')
    and ofa.is_active = true
    and upper(f.code) = 'CLOSING';

  if v_legacy_closing is null or v_count <> 1 then
    raise exception
      'DD DRAFT STOP: CGU/SMY do not share one active legacy CLOSING v1.';
  end if;

  select count(*)
    into v_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_legacy_opening
    and q.is_active = true;

  if v_count <> 20 then
    raise exception
      'DD DRAFT STOP: expected 20 active legacy OPENING questions, found %.',
      v_count;
  end if;

  select count(*)
    into v_count
  from public.questions q
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  where fvs.form_version_id = v_legacy_closing
    and q.is_active = true;

  if v_count <> 20 then
    raise exception
      'DD DRAFT STOP: expected 20 active legacy CLOSING questions, found %.',
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
    raise exception 'DD DRAFT STOP: active organization admin not found.';
  end if;

  insert into dd_context (
    organization_id,
    admin_user_id,
    legacy_opening_version_id,
    legacy_closing_version_id
  )
  values (
    v_org_id,
    v_admin_id,
    v_legacy_opening,
    v_legacy_closing
  );
end;
$$;

-- ============================================================
-- 2. EXACT SPLIT SOURCE VERSIONS
-- ============================================================

create temporary table dd_source_seed (
  form_code text primary key,
  expected_source_version integer not null,
  expected_draft_version integer not null,
  strategy text not null
) on commit drop;

insert into dd_source_seed values
  ('OPENING_FOH', 3, 4, 'clone_dd_brand'),
  ('OPENING_BOH', 2, 3, 'replace_with_dd_legacy_opening'),
  ('CLOSING_FOH', 2, 3, 'clone_dd_brand'),
  ('CLOSING_BOH', 2, 3, 'replace_with_dd_legacy_closing');

do $$
declare
  v_org_id uuid;
  v_row record;
  v_form_id uuid;
  v_source_version_id uuid;
  v_max_version integer;
  v_status text;
begin
  select organization_id
    into v_org_id
  from dd_context
  limit 1;

  for v_row in
    select *
    from dd_source_seed
    order by form_code
  loop
    select f.id
      into v_form_id
    from public.forms f
    where f.organization_id = v_org_id
      and upper(f.code) = v_row.form_code
      and f.is_active = true
    limit 1;

    if v_form_id is null then
      raise exception 'DD DRAFT STOP: split form % not found.', v_row.form_code;
    end if;

    select max(fv.version_number)
      into v_max_version
    from public.form_versions fv
    where fv.form_id = v_form_id;

    if v_max_version <> v_row.expected_source_version then
      raise exception
        'DD DRAFT STOP: % expected max version %, found %.',
        v_row.form_code,
        v_row.expected_source_version,
        v_max_version;
    end if;

    select fv.id, fv.status
      into v_source_version_id, v_status
    from public.form_versions fv
    where fv.form_id = v_form_id
      and fv.version_number = v_row.expected_source_version
    limit 1;

    if v_source_version_id is null or v_status <> 'published' then
      raise exception
        'DD DRAFT STOP: % source v% must be published.',
        v_row.form_code,
        v_row.expected_source_version;
    end if;

    insert into dd_version_map (
      form_code,
      form_id,
      source_version_id,
      source_version_number,
      draft_version_id,
      draft_version_number,
      strategy
    )
    values (
      v_row.form_code,
      v_form_id,
      v_source_version_id,
      v_row.expected_source_version,
      '00000000-0000-0000-0000-000000000000'::uuid,
      v_row.expected_draft_version,
      v_row.strategy
    );
  end loop;
end;
$$;

-- ============================================================
-- 3. CLONE FOUR SPLIT SOURCES TO DRAFTS
-- ============================================================

do $$
declare
  v_row record;
  v_draft_id uuid;
  v_actual_version integer;
begin
  for v_row in
    select *
    from dd_version_map
    order by
      case form_code
        when 'OPENING_FOH' then 1
        when 'OPENING_BOH' then 2
        when 'CLOSING_FOH' then 3
        when 'CLOSING_BOH' then 4
        else 99
      end
  loop
    v_draft_id :=
      public.clone_form_version_to_draft(
        v_row.source_version_id
      );

    select fv.version_number
      into v_actual_version
    from public.form_versions fv
    where fv.id = v_draft_id;

    if v_actual_version <> v_row.draft_version_number then
      raise exception
        'DD DRAFT STOP: % clone allocated v%, expected v%.',
        v_row.form_code,
        v_actual_version,
        v_row.draft_version_number;
    end if;

    update dd_version_map
    set draft_version_id = v_draft_id
    where form_code = v_row.form_code;

    drop table if exists pg_temp.tmp_option_map;
    drop table if exists pg_temp.tmp_question_map;
    drop table if exists pg_temp.tmp_group_map;
    drop table if exists pg_temp.tmp_version_section_map;
  end loop;
end;
$$;

-- ============================================================
-- 4. NOTES + SINGLE SECTION MAP
-- ============================================================

update public.form_versions fv
set notes =
  case vm.form_code
    when 'OPENING_FOH'
      then 'DD dedicated bilingual draft (Canggu/Seminyak) - Opening FOH - English default - all photo.'
    when 'OPENING_BOH'
      then 'DD dedicated bilingual draft (Canggu/Seminyak) - Opening BOH - based on DD legacy Opening v1 - English default - all photo.'
    when 'CLOSING_FOH'
      then 'DD dedicated bilingual draft (Canggu/Seminyak) - Closing FOH - English default - all photo.'
    when 'CLOSING_BOH'
      then 'DD dedicated bilingual draft (Canggu/Seminyak) - Closing BOH - based on DD legacy Closing v1 - English default - all photo.'
  end
from dd_version_map vm
where fv.id = vm.draft_version_id;

insert into dd_target_section_map (
  form_code,
  version_section_id
)
select
  vm.form_code,
  (
    select fvs.id
    from public.form_version_sections fvs
    where fvs.form_version_id = vm.draft_version_id
      and fvs.is_active = true
    order by fvs.id::text
    limit 1
  )
from dd_version_map vm;

do $$
declare
  v_bad text;
begin
  select string_agg(vm.form_code, ', ' order by vm.form_code)
    into v_bad
  from dd_version_map vm
  where (
    select count(*)
    from public.form_version_sections fvs
    where fvs.form_version_id = vm.draft_version_id
      and fvs.is_active = true
  ) <> 1;

  if v_bad is not null then
    raise exception
      'DD DRAFT STOP: expected exactly one active section for: %.',
      v_bad;
  end if;
end;
$$;

-- ============================================================
-- 5. REPLACE BOH DRAFT GRAPHS WITH DD LEGACY CONTENT
-- ============================================================

delete from public.questions q
using dd_target_section_map sm
where q.version_section_id = sm.version_section_id
  and sm.form_code in ('OPENING_BOH', 'CLOSING_BOH');

delete from public.question_groups qg
using dd_target_section_map sm
where qg.version_section_id = sm.version_section_id
  and sm.form_code in ('OPENING_BOH', 'CLOSING_BOH');

create temporary table dd_group_seed (
  form_code text not null,
  group_code text not null,
  en_name text not null,
  id_name text not null,
  sort_order integer not null,
  primary key (form_code, group_code)
) on commit drop;

insert into dd_group_seed values
  ('OPENING_BOH', 'CLEANING_HYGIENE', 'Cleaning & Hygiene', 'Kebersihan & Higienitas', 10),
  ('OPENING_BOH', 'STORAGE_FOOD_SAFETY', 'Storage & Food Safety', 'Penyimpanan & Keamanan Pangan', 20),
  ('OPENING_BOH', 'TEMPERATURE', 'Temperature', 'Suhu', 30),
  ('OPENING_BOH', 'PREPARATION_MISE_EN_PLACE', 'Preparation & Mise en Place', 'Persiapan & Mise en Place', 40),
  ('OPENING_BOH', 'EQUIPMENT_READINESS', 'Equipment Readiness', 'Kesiapan Peralatan', 50),
  ('OPENING_BOH', 'SAFETY_FINAL_READINESS', 'Safety & Final Readiness', 'Keselamatan & Kesiapan Akhir', 60),
  ('CLOSING_BOH', 'CLEANING_HYGIENE', 'Cleaning & Hygiene', 'Kebersihan & Higienitas', 10),
  ('CLOSING_BOH', 'STORAGE_FOOD_SAFETY', 'Storage & Food Safety', 'Penyimpanan & Keamanan Pangan', 20),
  ('CLOSING_BOH', 'TEMPERATURE', 'Temperature', 'Suhu', 30),
  ('CLOSING_BOH', 'EQUIPMENT_SAFETY', 'Equipment & Safety', 'Peralatan & Keselamatan', 40),
  ('CLOSING_BOH', 'PEST_CONTROL', 'Pest Control', 'Pengendalian Hama', 50),
  ('CLOSING_BOH', 'SECURITY_FINAL_CHECK', 'Security & Final Check', 'Keamanan & Pemeriksaan Akhir', 60);

create temporary table dd_group_map (
  form_code text not null,
  group_code text not null,
  new_group_id uuid not null unique,
  primary key (form_code, group_code)
) on commit drop;

insert into dd_group_map
select
  gs.form_code,
  gs.group_code,
  gen_random_uuid()
from dd_group_seed gs;

insert into public.question_groups (
  id,
  version_section_id,
  code,
  name,
  sort_order,
  is_active
)
select
  gm.new_group_id,
  sm.version_section_id,
  gs.group_code,
  gs.en_name,
  gs.sort_order,
  true
from dd_group_seed gs
join dd_group_map gm
  on gm.form_code = gs.form_code
 and gm.group_code = gs.group_code
join dd_target_section_map sm
  on sm.form_code = gs.form_code;

insert into public.question_group_translations (
  question_group_id,
  locale,
  display_name,
  description
)
select gm.new_group_id, 'en', gs.en_name, null
from dd_group_seed gs
join dd_group_map gm
  on gm.form_code = gs.form_code
 and gm.group_code = gs.group_code
union all
select gm.new_group_id, 'id-ID', gs.id_name, null
from dd_group_seed gs
join dd_group_map gm
  on gm.form_code = gs.form_code
 and gm.group_code = gs.group_code;

-- ============================================================
-- 6. BOH QUESTION TRANSLATION SEED
-- ============================================================

create temporary table dd_question_text_seed (
  form_code text not null,
  question_code text not null,
  group_code text not null,
  en_text text not null,
  id_text text not null,
  primary key (form_code, question_code)
) on commit drop;

insert into dd_question_text_seed values
  ('OPENING_BOH','OPN_CLEAN_01','CLEANING_HYGIENE',
    'Kitchen floor and working areas are clean and ready for operation?',
    'Lantai dapur dan area kerja bersih dan siap untuk operasional?'),
  ('OPENING_BOH','OPN_CLEAN_02','CLEANING_HYGIENE',
    'Preparation tables and food-contact surfaces are clean and sanitized?',
    'Meja persiapan dan permukaan yang bersentuhan dengan makanan bersih dan tersanitasi?'),
  ('OPENING_BOH','OPN_CLEAN_03','CLEANING_HYGIENE',
    'Hand washing station is clean, functional and fully supplied?',
    'Area cuci tangan bersih, berfungsi, dan perlengkapannya lengkap?'),
  ('OPENING_BOH','OPN_STORE_01','STORAGE_FOOD_SAFETY',
    'Raw and ready-to-eat food are stored separately and safely?',
    'Bahan makanan mentah dan siap santap disimpan terpisah dan aman?'),
  ('OPENING_BOH','OPN_STORE_02','STORAGE_FOOD_SAFETY',
    'All prepared and opened food items have proper label and date?',
    'Semua makanan yang sudah dipersiapkan dan dibuka memiliki label dan tanggal yang sesuai?'),
  ('OPENING_BOH','OPN_STORE_03','STORAGE_FOOD_SAFETY',
    'FIFO / FEFO storage arrangement is properly implemented?',
    'Penataan penyimpanan FIFO / FEFO sudah diterapkan dengan benar?'),
  ('OPENING_BOH','OPN_STORE_04','STORAGE_FOOD_SAFETY',
    'There are no expired, spoiled or unsafe food items in storage?',
    'Tidak ada bahan makanan kedaluwarsa, rusak, atau tidak aman di area penyimpanan?'),
  ('OPENING_BOH','OPN_TEMP_01','TEMPERATURE',
    'Chiller temperature',
    'Suhu chiller'),
  ('OPENING_BOH','OPN_TEMP_02','TEMPERATURE',
    'Freezer temperature',
    'Suhu freezer'),
  ('OPENING_BOH','OPN_PREP_01','PREPARATION_MISE_EN_PLACE',
    'Required ingredients and mise en place are prepared for opening service?',
    'Bahan yang diperlukan dan mise en place sudah siap untuk pelayanan pembukaan?'),
  ('OPENING_BOH','OPN_PREP_02','PREPARATION_MISE_EN_PLACE',
    'Sauces, condiments and kitchen preparation items are ready for service?',
    'Saus, kondimen, dan bahan persiapan dapur sudah siap untuk pelayanan?'),
  ('OPENING_BOH','OPN_PREP_03','PREPARATION_MISE_EN_PLACE',
    'Kitchen utensils and food containers are clean and ready to use?',
    'Peralatan dapur dan wadah makanan bersih dan siap digunakan?'),
  ('OPENING_BOH','OPN_PREP_04','PREPARATION_MISE_EN_PLACE',
    'Opening stock quantity is sufficient for initial service?',
    'Jumlah stok pembukaan mencukupi untuk pelayanan awal?'),
  ('OPENING_BOH','OPN_EQUIP_01','EQUIPMENT_READINESS',
    'Cooking equipment required for operation is functioning normally?',
    'Peralatan memasak yang dibutuhkan untuk operasional berfungsi normal?'),
  ('OPENING_BOH','OPN_EQUIP_02','EQUIPMENT_READINESS',
    'Chiller and freezer units are operating normally?',
    'Unit chiller dan freezer berfungsi normal?'),
  ('OPENING_BOH','OPN_EQUIP_03','EQUIPMENT_READINESS',
    'Exhaust hood and ventilation system are functioning normally?',
    'Exhaust hood dan sistem ventilasi berfungsi normal?'),
  ('OPENING_BOH','OPN_EQUIP_04','EQUIPMENT_READINESS',
    'Gas, electrical and water supply are available with no visible safety issue?',
    'Pasokan gas, listrik, dan air tersedia tanpa masalah keselamatan yang terlihat?'),
  ('OPENING_BOH','OPN_FINAL_01','SAFETY_FINAL_READINESS',
    'Fire extinguisher and emergency access are unobstructed and ready?',
    'APAR dan akses darurat tidak terhalang dan siap digunakan?'),
  ('OPENING_BOH','OPN_FINAL_02','SAFETY_FINAL_READINESS',
    'There are no visible signs of pest activity in the kitchen?',
    'Tidak ada tanda aktivitas hama yang terlihat di area dapur?'),
  ('OPENING_BOH','OPN_FINAL_03','SAFETY_FINAL_READINESS',
    'Kitchen / BOH is fully ready to begin restaurant operations?',
    'Kitchen / BOH sepenuhnya siap memulai operasional restoran?'),

  ('CLOSING_BOH','KITCHEN_CLEAN_001','CLEANING_HYGIENE',
    'All tables are clean.',
    'Seluruh meja bersih.'),
  ('CLOSING_BOH','KITCHEN_CLEAN_002','CLEANING_HYGIENE',
    'All floors are clean.',
    'Seluruh lantai bersih.'),
  ('CLOSING_BOH','KITCHEN_CLEAN_003','CLEANING_HYGIENE',
    'All equipment is clean and stored covered in its proper place.',
    'Seluruh peralatan bersih dan tersimpan tertutup pada tempatnya.'),
  ('CLOSING_BOH','KITCHEN_CLEAN_004','CLEANING_HYGIENE',
    'All machines are clean and stored covered in their proper place.',
    'Seluruh mesin bersih dan tersimpan tertutup pada tempatnya.'),
  ('CLOSING_BOH','KITCHEN_CLEAN_005','CLEANING_HYGIENE',
    'Grease trap is clean.',
    'Grease Trap bersih.'),
  ('CLOSING_BOH','KITCHEN_CLEAN_006','CLEANING_HYGIENE',
    'All waste has been placed in the disposal area.',
    'Seluruh sampah sudah ditaruh di tempat pembuangan.'),
  ('CLOSING_BOH','KITCHEN_CLEAN_007','CLEANING_HYGIENE',
    'All trash bins are clean and lined with new clean plastic.',
    'Seluruh tempat sampah sudah bersih dan terlapisi dengan plastik yang baru dan bersih.'),
  ('CLOSING_BOH','KITCHEN_CLEAN_008','CLEANING_HYGIENE',
    'Gutter / drainage is clean.',
    'Gutter / Gorong-Gorong bersih.'),
  ('CLOSING_BOH','KITCHEN_STORAGE_001','STORAGE_FOOD_SAFETY',
    'All wet stock is stored at the correct temperature, hygienically, covered, and labeled with name and date.',
    'Seluruh stock basah disimpan dengan suhu tepat serta higienis dan tertutup serta diberi label nama dan tanggal.'),
  ('CLOSING_BOH','KITCHEN_TEMP_001','TEMPERATURE',
    'Chiller temperature',
    'Suhu Chiller'),
  ('CLOSING_BOH','KITCHEN_TEMP_002','TEMPERATURE',
    'Freezer temperature',
    'Suhu Freezer'),
  ('CLOSING_BOH','KITCHEN_EQUIP_001','EQUIPMENT_SAFETY',
    'Fryer and oven have cooled down; soup warmer and rice cooker are clean.',
    'Fryer & oven sudah dingin, soupwarmer & ricecooker bersih.'),
  ('CLOSING_BOH','KITCHEN_EQUIP_002','EQUIPMENT_SAFETY',
    'All BOH stoves are in a safe condition.',
    'Kompor BOH dalam kondisi aman seluruhnya.'),
  ('CLOSING_BOH','KITCHEN_EQUIP_003','EQUIPMENT_SAFETY',
    'BOH gas and stoves are turned off (central gas pipe).',
    'Kondisi gas dan kompor BOH sudah dalam keadaan mati (pipa gas sentral).'),
  ('CLOSING_BOH','KITCHEN_EQUIP_004','EQUIPMENT_SAFETY',
    'Fixer and wall-corner area, Sogemerner and Rice Cooker are clean.',
    'Fixer & Area sudut dinding, Sogemerner & Rice Cooker Bersih.'),
  ('CLOSING_BOH','KITCHEN_EQUIP_005','EQUIPMENT_SAFETY',
    'All lights have been turned off.',
    'Seluruh lampu telah dipadamkan.'),
  ('CLOSING_BOH','KITCHEN_PEST_001','PEST_CONTROL',
    'Pest traps have been checked.',
    'Pest Trap sudah diperiksa.'),
  ('CLOSING_BOH','KITCHEN_PEST_002','PEST_CONTROL',
    'There are no pest droppings or pests in the entire area.',
    'Tidak ada kotoran hama / hama di seluruh area.'),
  ('CLOSING_BOH','KITCHEN_PEST_003','PEST_CONTROL',
    'No foreign items are visible to guests.',
    'Tidak ada barang asing yang terlihat oleh tamu.'),
  ('CLOSING_BOH','KITCHEN_SECURITY_001','SECURITY_FINAL_CHECK',
    'The outlet is properly locked.',
    'Outlet sudah terkunci dengan baik.');

-- ============================================================
-- 7. LEGACY QUESTION -> NEW DD QUESTION MAP
-- ============================================================

create temporary table dd_question_map (
  form_code text not null,
  old_question_id uuid not null,
  new_question_id uuid not null unique,
  question_code text not null,
  primary key (form_code, old_question_id)
) on commit drop;

insert into dd_question_map
select
  'OPENING_BOH',
  q.id,
  gen_random_uuid(),
  q.code
from public.questions q
join public.form_version_sections fvs
  on fvs.id = q.version_section_id
join dd_context ctx on true
where fvs.form_version_id = ctx.legacy_opening_version_id
  and q.is_active = true;

insert into dd_question_map
select
  'CLOSING_BOH',
  q.id,
  gen_random_uuid(),
  q.code
from public.questions q
join public.form_version_sections fvs
  on fvs.id = q.version_section_id
join dd_context ctx on true
where fvs.form_version_id = ctx.legacy_closing_version_id
  and q.is_active = true;

do $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from dd_question_map
  where form_code = 'OPENING_BOH';

  if v_count <> 20 then
    raise exception
      'DD DRAFT STOP: OPENING_BOH map expected 20 questions, found %.',
      v_count;
  end if;

  select count(*) into v_count
  from dd_question_map
  where form_code = 'CLOSING_BOH';

  if v_count <> 20 then
    raise exception
      'DD DRAFT STOP: CLOSING_BOH map expected 20 questions, found %.',
      v_count;
  end if;

  if exists (
    select 1
    from dd_question_map qm
    left join dd_question_text_seed ts
      on ts.form_code = qm.form_code
     and ts.question_code = qm.question_code
    where ts.question_code is null
  ) then
    raise exception
      'DD DRAFT STOP: translation/group seed missing for one or more BOH questions.';
  end if;

  if exists (
    select 1
    from dd_question_text_seed ts
    left join dd_question_map qm
      on qm.form_code = ts.form_code
     and qm.question_code = ts.question_code
    where qm.question_code is null
  ) then
    raise exception
      'DD DRAFT STOP: seeded BOH question not found in legacy source.';
  end if;
end;
$$;

-- ============================================================
-- 8. INSERT DD BOH QUESTIONS
-- ============================================================

insert into public.questions (
  id,
  version_section_id,
  question_group_id,
  code,
  question_text,
  help_text,
  question_type,
  is_required,
  unit,
  min_value,
  max_value,
  placeholder,
  config,
  sort_order,
  is_active
)
select
  qm.new_question_id,
  sm.version_section_id,
  gm.new_group_id,
  q.code,
  ts.en_text,
  null,
  q.question_type,
  q.is_required,
  q.unit,
  q.min_value,
  q.max_value,
  q.placeholder,
  coalesce(q.config, '{}'::jsonb)
    || jsonb_build_object(
      'evidence_mode',
      'always',
      'applicability',
      case
        when qm.form_code = 'CLOSING_BOH'
         and q.code = 'KITCHEN_EQUIP_003'
          then jsonb_build_object(
            'type',
            'facility',
            'facility_key',
            'GAS_SYSTEM'
          )
        else jsonb_build_object(
          'type',
          'global'
        )
      end
    ),
  q.sort_order,
  true
from dd_question_map qm
join public.questions q
  on q.id = qm.old_question_id
join dd_question_text_seed ts
  on ts.form_code = qm.form_code
 and ts.question_code = qm.question_code
join dd_target_section_map sm
  on sm.form_code = qm.form_code
join dd_group_map gm
  on gm.form_code = qm.form_code
 and gm.group_code = ts.group_code;

insert into public.question_translations (
  question_id,
  locale,
  question_text,
  help_text
)
select
  qm.new_question_id,
  'en',
  ts.en_text,
  null
from dd_question_map qm
join dd_question_text_seed ts
  on ts.form_code = qm.form_code
 and ts.question_code = qm.question_code
union all
select
  qm.new_question_id,
  'id-ID',
  ts.id_text,
  null
from dd_question_map qm
join dd_question_text_seed ts
  on ts.form_code = qm.form_code
 and ts.question_code = qm.question_code;

-- ============================================================
-- 9. BOH RULES
-- ============================================================

insert into public.question_rules (
  question_id,
  rule_type,
  condition,
  action_config,
  sort_order,
  is_active
)
select
  qm.new_question_id,
  qr.rule_type,
  qr.condition,
  qr.action_config,
  qr.sort_order,
  qr.is_active
from dd_question_map qm
join public.question_rules qr
  on qr.question_id = qm.old_question_id
where qr.rule_type <> 'require_photo';

delete from public.question_rules qr
using dd_question_map qm,
      public.questions q
where qr.question_id = qm.new_question_id
  and q.id = qm.new_question_id
  and q.question_type = 'yes_no'
  and qr.rule_type in (
    'require_notes',
    'flag_issue',
    'require_corrective_action'
  );

insert into public.question_rules (
  question_id,
  rule_type,
  condition,
  action_config,
  sort_order,
  is_active
)
select q.id, 'require_notes',
  jsonb_build_object('operator','equals','value',false),
  '{}'::jsonb, 10, true
from public.questions q
join dd_question_map qm on qm.new_question_id = q.id
where q.question_type = 'yes_no'
union all
select q.id, 'flag_issue',
  jsonb_build_object('operator','equals','value',false),
  '{}'::jsonb, 30, true
from public.questions q
join dd_question_map qm on qm.new_question_id = q.id
where q.question_type = 'yes_no'
union all
select q.id, 'require_corrective_action',
  jsonb_build_object('operator','equals','value',false),
  '{}'::jsonb, 40, true
from public.questions q
join dd_question_map qm on qm.new_question_id = q.id
where q.question_type = 'yes_no';

-- ============================================================
-- 10. BOH OPTIONS + BILINGUAL OPTION LABELS
-- ============================================================

create temporary table dd_option_map (
  old_option_id uuid primary key,
  new_option_id uuid not null unique,
  new_question_id uuid not null
) on commit drop;

insert into dd_option_map
select
  qo.id,
  gen_random_uuid(),
  qm.new_question_id
from public.question_options qo
join dd_question_map qm
  on qm.old_question_id = qo.question_id;

insert into public.question_options (
  id,
  question_id,
  value,
  label,
  sort_order,
  is_failure,
  updated_at
)
select
  om.new_option_id,
  om.new_question_id,
  qo.value,
  qo.label,
  qo.sort_order,
  qo.is_failure,
  now()
from dd_option_map om
join public.question_options qo
  on qo.id = om.old_option_id;

insert into public.question_option_translations (
  option_id,
  locale,
  label
)
select
  om.new_option_id,
  t.locale,
  t.label
from dd_option_map om
join public.question_option_translations t
  on t.option_id = om.old_option_id
on conflict (option_id, locale)
do update set label = excluded.label;

insert into public.question_option_translations (
  option_id,
  locale,
  label
)
select
  om.new_option_id,
  'en',
  case
    when lower(trim(qo.value)) in ('true','yes','y','1') then 'Yes'
    when lower(trim(qo.value)) in ('false','no','n','0') then 'No'
    else qo.label
  end
from dd_option_map om
join public.question_options qo on qo.id = om.old_option_id
on conflict (option_id, locale)
do update set label = excluded.label;

insert into public.question_option_translations (
  option_id,
  locale,
  label
)
select
  om.new_option_id,
  'id-ID',
  case
    when lower(trim(qo.value)) in ('true','yes','y','1') then 'Ya'
    when lower(trim(qo.value)) in ('false','no','n','0') then 'Tidak'
    else qo.label
  end
from dd_option_map om
join public.question_options qo on qo.id = om.old_option_id
on conflict (option_id, locale)
do update set label = excluded.label;

-- ============================================================
-- 11. SECTION TRANSLATIONS
-- ============================================================

create temporary table dd_section_seed (
  form_code text primary key,
  en_name text not null,
  id_name text not null,
  en_description text not null,
  id_description text not null
) on commit drop;

insert into dd_section_seed values
  (
    'OPENING_FOH',
    'Front of House',
    'Front of House',
    'DD front-of-house opening readiness checklist.',
    'Daftar periksa kesiapan pembukaan front-of-house DD.'
  ),
  (
    'OPENING_BOH',
    'BOH / Kitchen',
    'BOH / Kitchen',
    'DD kitchen and BOH opening readiness checklist.',
    'Daftar periksa kesiapan pembukaan kitchen dan BOH DD.'
  ),
  (
    'CLOSING_FOH',
    'Front of House',
    'Front of House',
    'DD front-of-house closing checklist.',
    'Daftar periksa penutupan front-of-house DD.'
  ),
  (
    'CLOSING_BOH',
    'BOH / Kitchen',
    'BOH / Kitchen',
    'DD kitchen and BOH closing checklist.',
    'Daftar periksa penutupan kitchen dan BOH DD.'
  );

update public.form_version_sections fvs
set
  display_name = ss.en_name,
  description = ss.en_description
from dd_target_section_map sm
join dd_section_seed ss
  on ss.form_code = sm.form_code
where fvs.id = sm.version_section_id;

insert into public.form_version_section_translations (
  version_section_id,
  locale,
  display_name,
  description
)
select
  sm.version_section_id,
  'en',
  ss.en_name,
  ss.en_description
from dd_target_section_map sm
join dd_section_seed ss
  on ss.form_code = sm.form_code
on conflict (version_section_id, locale)
do update set
  display_name = excluded.display_name,
  description = excluded.description;

insert into public.form_version_section_translations (
  version_section_id,
  locale,
  display_name,
  description
)
select
  sm.version_section_id,
  'id-ID',
  ss.id_name,
  ss.id_description
from dd_target_section_map sm
join dd_section_seed ss
  on ss.form_code = sm.form_code
on conflict (version_section_id, locale)
do update set
  display_name = excluded.display_name,
  description = excluded.description;

-- ============================================================
-- 12. DD BRANDING FOR OPENING FOH
-- ============================================================

create temporary table dd_opening_foh_brand_seed (
  question_code text primary key,
  en_text text not null,
  id_text text not null
) on commit drop;

insert into dd_opening_foh_brand_seed values
  (
    'OPN_FOH_015',
    'Music is played according to DD standards.',
    'Musik diputar sesuai standar DD.'
  ),
  (
    'OPN_FOH_026',
    'Tabletop items are arranged according to DD standards.',
    'Perlengkapan di atas meja tertata sesuai standar DD.'
  ),
  (
    'OPN_FOH_042',
    'There are no displays that do not comply with DD standards.',
    'Tidak ada pajangan yang tidak sesuai standar DD.'
  ),
  (
    'OPN_FOH_044',
    'FOH appearance complies with DD grooming standards (uniform neatness, hair, makeup, no accessories, black shoes).',
    'Penampilan FOH sesuai standar grooming DD (kerapihan seragam, rambut, makeup, tanpa aksesori, sepatu hitam).'
  ),
  (
    'OPN_FOH_058',
    'Toilet fragrance complies with DD standards.',
    'Pewangi toilet sesuai standar DD.'
  );

update public.questions q
set question_text = bs.en_text
from dd_opening_foh_brand_seed bs,
     dd_target_section_map sm
where sm.form_code = 'OPENING_FOH'
  and q.version_section_id = sm.version_section_id
  and q.code = bs.question_code;

insert into public.question_translations (
  question_id,
  locale,
  question_text,
  help_text
)
select
  q.id,
  'en',
  bs.en_text,
  qt.help_text
from dd_opening_foh_brand_seed bs
join dd_target_section_map sm
  on sm.form_code = 'OPENING_FOH'
join public.questions q
  on q.version_section_id = sm.version_section_id
 and q.code = bs.question_code
left join public.question_translations qt
  on qt.question_id = q.id
 and qt.locale = 'en'
on conflict (question_id, locale)
do update set question_text = excluded.question_text;

insert into public.question_translations (
  question_id,
  locale,
  question_text,
  help_text
)
select
  q.id,
  'id-ID',
  bs.id_text,
  qt.help_text
from dd_opening_foh_brand_seed bs
join dd_target_section_map sm
  on sm.form_code = 'OPENING_FOH'
join public.questions q
  on q.version_section_id = sm.version_section_id
 and q.code = bs.question_code
left join public.question_translations qt
  on qt.question_id = q.id
 and qt.locale = 'id-ID'
on conflict (question_id, locale)
do update set question_text = excluded.question_text;

-- ============================================================
-- 13. NORMALIZE ALL 4 DD DRAFTS TO ALL-PHOTO
-- ============================================================

update public.questions q
set config =
  coalesce(q.config, '{}'::jsonb)
  || jsonb_build_object('evidence_mode','always')
from dd_target_section_map sm
where q.version_section_id = sm.version_section_id
  and q.is_active = true;

delete from public.question_rules qr
using public.questions q,
      dd_target_section_map sm
where qr.question_id = q.id
  and q.version_section_id = sm.version_section_id
  and qr.rule_type = 'require_photo';

insert into public.question_rules (
  question_id,
  rule_type,
  condition,
  action_config,
  sort_order,
  is_active
)
select
  q.id,
  'require_photo',
  jsonb_build_object('operator','always'),
  jsonb_build_object('required',true),
  5,
  true
from public.questions q
join dd_target_section_map sm
  on sm.version_section_id = q.version_section_id
where q.is_active = true;

-- ============================================================
-- 14. ENGLISH CANONICAL CONTENT FOR DD
-- ============================================================

update public.questions q
set
  question_text = qt.question_text,
  help_text = qt.help_text
from public.question_translations qt,
     dd_target_section_map sm
where q.version_section_id = sm.version_section_id
  and qt.question_id = q.id
  and qt.locale = 'en';

update public.question_groups qg
set name = qgt.display_name
from public.question_group_translations qgt,
     dd_target_section_map sm
where qg.version_section_id = sm.version_section_id
  and qgt.question_group_id = qg.id
  and qgt.locale = 'en';

-- ============================================================
-- 15. POST-FLIGHT
-- ============================================================

do $$
declare
  v_count integer;
  v_bad text;
begin
  if (select count(*) from dd_version_map) <> 4 then
    raise exception 'DD DRAFT POSTFLIGHT: expected 4 version-map rows.';
  end if;

  if exists (
    select 1
    from dd_version_map vm
    join public.form_versions fv
      on fv.id = vm.draft_version_id
    where fv.status <> 'draft'
       or fv.form_id <> vm.form_id
       or fv.version_number <> vm.draft_version_number
  ) then
    raise exception 'DD DRAFT POSTFLIGHT: draft identity/status mismatch.';
  end if;

  select string_agg(
    vm.form_code ||
    '(q=' || x.q_count ||
    ',g=' || x.g_count ||
    ',facility=' || x.facility_count ||
    ',always=' || x.always_count ||
    ',photo=' || x.photo_count || ')',
    ', ' order by vm.form_code
  )
  into v_bad
  from dd_version_map vm
  join lateral (
    select
      (
        select count(*)
        from public.questions q
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where fvs.form_version_id = vm.draft_version_id
          and q.is_active = true
      ) as q_count,
      (
        select count(*)
        from public.question_groups qg
        join public.form_version_sections fvs
          on fvs.id = qg.version_section_id
        where fvs.form_version_id = vm.draft_version_id
          and qg.is_active = true
      ) as g_count,
      (
        select count(*)
        from public.questions q
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where fvs.form_version_id = vm.draft_version_id
          and q.is_active = true
          and q.config #>> '{applicability,type}' = 'facility'
      ) as facility_count,
      (
        select count(*)
        from public.questions q
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where fvs.form_version_id = vm.draft_version_id
          and q.is_active = true
          and q.config ->> 'evidence_mode' = 'always'
      ) as always_count,
      (
        select count(*)
        from public.question_rules qr
        join public.questions q
          on q.id = qr.question_id
        join public.form_version_sections fvs
          on fvs.id = q.version_section_id
        where fvs.form_version_id = vm.draft_version_id
          and q.is_active = true
          and qr.rule_type = 'require_photo'
          and qr.is_active = true
          and qr.condition ->> 'operator' = 'always'
          and coalesce(
            (qr.action_config ->> 'required')::boolean,
            false
          ) = true
      ) as photo_count
  ) x on true
  where
    (vm.form_code = 'OPENING_FOH'
      and (
        x.q_count <> 59
        or x.g_count <> 7
        or x.facility_count <> 21
        or x.always_count <> 59
        or x.photo_count <> 59
      ))
    or
    (vm.form_code = 'OPENING_BOH'
      and (
        x.q_count <> 20
        or x.g_count <> 6
        or x.facility_count <> 0
        or x.always_count <> 20
        or x.photo_count <> 20
      ))
    or
    (vm.form_code = 'CLOSING_FOH'
      and (
        x.q_count <> 12
        or x.g_count <> 0
        or x.facility_count <> 1
        or x.always_count <> 12
        or x.photo_count <> 12
      ))
    or
    (vm.form_code = 'CLOSING_BOH'
      and (
        x.q_count <> 20
        or x.g_count <> 6
        or x.facility_count <> 1
        or x.always_count <> 20
        or x.photo_count <> 20
      ));

  if v_bad is not null then
    raise exception 'DD DRAFT POSTFLIGHT: graph mismatch: %.', v_bad;
  end if;

  if exists (
    select 1
    from dd_target_section_map sm
    join public.questions q
      on q.version_section_id = sm.version_section_id
     and q.is_active = true
    where (
      select count(distinct qt.locale)
      from public.question_translations qt
      where qt.question_id = q.id
        and qt.locale in ('en','id-ID')
    ) <> 2
  ) then
    raise exception
      'DD DRAFT POSTFLIGHT: one or more questions lack EN + id-ID translations.';
  end if;

  if exists (
    select 1
    from dd_target_section_map sm
    join public.question_groups qg
      on qg.version_section_id = sm.version_section_id
     and qg.is_active = true
    where (
      select count(distinct qgt.locale)
      from public.question_group_translations qgt
      where qgt.question_group_id = qg.id
        and qgt.locale in ('en','id-ID')
    ) <> 2
  ) then
    raise exception
      'DD DRAFT POSTFLIGHT: one or more groups lack EN + id-ID translations.';
  end if;

  if exists (
    select 1
    from dd_target_section_map sm
    where (
      select count(distinct fvst.locale)
      from public.form_version_section_translations fvst
      where fvst.version_section_id = sm.version_section_id
        and fvst.locale in ('en','id-ID')
    ) <> 2
  ) then
    raise exception
      'DD DRAFT POSTFLIGHT: one or more sections lack EN + id-ID translations.';
  end if;

  if exists (
    select 1
    from dd_target_section_map sm
    join public.questions q
      on q.version_section_id = sm.version_section_id
    where sm.form_code = 'OPENING_FOH'
      and q.is_active = true
      and upper(coalesce(q.question_text,'')) like '%CQ%'
  ) then
    raise exception
      'DD DRAFT POSTFLIGHT: CQ branding remains in DD OPENING_FOH canonical text.';
  end if;

  if exists (
    select 1
    from dd_target_section_map sm
    join public.questions q
      on q.version_section_id = sm.version_section_id
    join public.question_translations qt
      on qt.question_id = q.id
    where sm.form_code = 'OPENING_FOH'
      and q.is_active = true
      and upper(coalesce(qt.question_text,'')) like '%CQ%'
  ) then
    raise exception
      'DD DRAFT POSTFLIGHT: CQ branding remains in DD OPENING_FOH translations.';
  end if;

  if exists (
    select 1
    from dd_version_map vm
    join public.outlet_form_assignments ofa
      on ofa.form_version_id = vm.draft_version_id
  ) then
    raise exception 'DD DRAFT POSTFLIGHT: a DD draft is unexpectedly assigned.';
  end if;

  if exists (
    select 1
    from dd_version_map vm
    join public.reports r
      on r.form_version_id = vm.draft_version_id
  ) then
    raise exception
      'DD DRAFT POSTFLIGHT: a DD draft is unexpectedly referenced by a report.';
  end if;

  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o on o.id = ofa.outlet_id
  join public.forms f on f.id = ofa.form_id
  where upper(o.code) in ('CGU','SMY')
    and ofa.is_active = true
    and upper(f.code) in ('OPENING','CLOSING');

  if v_count <> 4 then
    raise exception
      'DD DRAFT POSTFLIGHT: expected 4 active DD legacy assignments, found %.',
      v_count;
  end if;

  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o on o.id = ofa.outlet_id
  join public.forms f on f.id = ofa.form_id
  where upper(o.code) in ('CGU','SMY')
    and ofa.is_active = true
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    );

  if v_count <> 0 then
    raise exception 'DD DRAFT POSTFLIGHT: DD split assignments were changed.';
  end if;

  select count(*)
    into v_count
  from public.outlet_form_assignments ofa
  join public.outlets o on o.id = ofa.outlet_id
  join public.forms f on f.id = ofa.form_id
  where upper(o.code) in (
      'BDG','GS','HT','MOI','PIM','PL','PP','SP','TBZ'
    )
    and ofa.is_active = true
    and upper(f.code) in (
      'OPENING_FOH',
      'OPENING_BOH',
      'CLOSING_FOH',
      'CLOSING_BOH'
    );

  if v_count <> 36 then
    raise exception
      'DD DRAFT POSTFLIGHT: CQ active split assignment count changed: %.',
      v_count;
  end if;

  if exists (
    select 1
    from public.outlets o
    where upper(o.code) in ('CGU','SMY')
      and o.is_active = true
      and coalesce(o.default_locale,'') <> 'en'
  ) then
    raise exception 'DD DRAFT POSTFLIGHT: DD outlet default locale changed.';
  end if;
end;
$$;

commit;
