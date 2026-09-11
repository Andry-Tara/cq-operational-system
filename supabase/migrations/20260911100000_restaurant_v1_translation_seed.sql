begin;

-- ============================================================
-- RESTAURANT V1 TRANSLATION SEED
--
-- Seeds only explicit translations for the published Restaurant V1
-- Opening and Closing forms. Canonical published content is never
-- updated.
-- ============================================================

create temporary table expected_v1_groups (
  form_code text not null,
  code text not null,
  display_name text not null,
  description text not null,
  primary key (form_code, code)
) on commit drop;

insert into expected_v1_groups (
  form_code,
  code,
  display_name,
  description
)
values
  ('OPENING', 'CLEANING', 'Kebersihan & Higiene', 'Kesiapan kebersihan dan higiene sebelum operasional.'),
  ('OPENING', 'STORAGE', 'Penyimpanan & Keamanan Pangan', 'Kesiapan penyimpanan, pelabelan, dan keamanan pangan.'),
  ('OPENING', 'TEMPERATURE', 'Suhu', 'Verifikasi suhu saat pembukaan.'),
  ('OPENING', 'MISE_EN_PLACE', 'Persiapan & Mise en Place', 'Persiapan bahan dan produksi sebelum pelayanan.'),
  ('OPENING', 'EQUIPMENT', 'Kesiapan Peralatan', 'Kesiapan peralatan operasional.'),
  ('OPENING', 'FINAL', 'Keselamatan & Kesiapan Akhir', 'Verifikasi akhir keselamatan dan kesiapan operasional.'),
  ('CLOSING', 'CLEANING', 'Kebersihan', 'Pembersihan akhir sebelum outlet tutup.'),
  ('CLOSING', 'STORAGE', 'Penyimpanan & Keamanan Pangan', 'Verifikasi penyimpanan, pelabelan, dan higiene.'),
  ('CLOSING', 'TEMPERATURE', 'Suhu', 'Verifikasi suhu chiller dan freezer.'),
  ('CLOSING', 'EQUIPMENT_SAFETY', 'Peralatan & Keselamatan', 'Keselamatan peralatan dapur, listrik, dan gas.'),
  ('CLOSING', 'PEST_CONTROL', 'Pengendalian Hama', 'Pemeriksaan hama dan benda asing.'),
  ('CLOSING', 'FINAL_SECURITY', 'Keamanan Akhir', 'Pemeriksaan keamanan akhir outlet.');

create temporary table expected_v1_questions (
  form_code text not null,
  code text not null,
  locale text not null,
  question_text text not null,
  help_text text null,
  primary key (form_code, code, locale)
) on commit drop;

insert into expected_v1_questions (
  form_code,
  code,
  locale,
  question_text,
  help_text
)
values
  ('OPENING', 'OPN_CLEAN_01', 'id-ID', 'Lantai dapur dan area kerja bersih dan siap untuk operasional?', 'Periksa lantai, area persiapan, dan permukaan kerja utama.'),
  ('OPENING', 'OPN_CLEAN_02', 'id-ID', 'Meja persiapan dan permukaan yang bersentuhan dengan makanan bersih dan sudah disanitasi?', null),
  ('OPENING', 'OPN_CLEAN_03', 'id-ID', 'Stasiun cuci tangan bersih, berfungsi, dan perlengkapannya lengkap?', 'Periksa sabun, air, dan perlengkapan pengering tangan.'),
  ('OPENING', 'OPN_STORE_01', 'id-ID', 'Bahan makanan mentah dan siap santap disimpan terpisah dengan aman?', null),
  ('OPENING', 'OPN_STORE_02', 'id-ID', 'Semua makanan yang sudah disiapkan dan dibuka memiliki label dan tanggal yang sesuai?', null),
  ('OPENING', 'OPN_STORE_03', 'id-ID', 'Penataan penyimpanan FIFO / FEFO sudah diterapkan dengan benar?', null),
  ('OPENING', 'OPN_STORE_04', 'id-ID', 'Tidak ada bahan makanan kedaluwarsa, rusak, atau tidak aman di area penyimpanan?', null),
  ('OPENING', 'OPN_TEMP_01', 'id-ID', 'Suhu Chiller', 'Standar: 1°C sampai 4°C.'),
  ('OPENING', 'OPN_TEMP_02', 'id-ID', 'Suhu Freezer', 'Standar: -18°C atau lebih rendah.'),
  ('OPENING', 'OPN_PREP_01', 'id-ID', 'Bahan yang diperlukan dan mise en place sudah siap untuk pelayanan pembukaan?', null),
  ('OPENING', 'OPN_PREP_02', 'id-ID', 'Saus, condiment, dan item persiapan dapur sudah siap untuk pelayanan?', null),
  ('OPENING', 'OPN_PREP_03', 'id-ID', 'Peralatan dapur dan wadah makanan bersih dan siap digunakan?', null),
  ('OPENING', 'OPN_PREP_04', 'id-ID', 'Jumlah stok pembukaan mencukupi untuk pelayanan awal?', null),
  ('OPENING', 'OPN_EQUIP_01', 'id-ID', 'Peralatan memasak yang diperlukan untuk operasional berfungsi normal?', null),
  ('OPENING', 'OPN_EQUIP_02', 'id-ID', 'Chiller dan freezer beroperasi normal?', null),
  ('OPENING', 'OPN_EQUIP_03', 'id-ID', 'Exhaust hood dan sistem ventilasi berfungsi normal?', null),
  ('OPENING', 'OPN_EQUIP_04', 'id-ID', 'Pasokan gas, listrik, dan air tersedia tanpa masalah keselamatan yang terlihat?', null),
  ('OPENING', 'OPN_FINAL_01', 'id-ID', 'APAR dan akses darurat tidak terhalang dan siap digunakan?', null),
  ('OPENING', 'OPN_FINAL_02', 'id-ID', 'Tidak ada tanda aktivitas hama yang terlihat di area dapur?', null),
  ('OPENING', 'OPN_FINAL_03', 'id-ID', 'Kitchen / BOH sepenuhnya siap untuk memulai operasional restoran?', 'Verifikasi akhir sebelum pembukaan.'),
  ('CLOSING', 'KITCHEN_CLEAN_001', 'en', 'All tables are clean.', null),
  ('CLOSING', 'KITCHEN_CLEAN_002', 'en', 'All floors are clean.', null),
  ('CLOSING', 'KITCHEN_CLEAN_003', 'en', 'All equipment is clean, covered, and stored in its designated place.', null),
  ('CLOSING', 'KITCHEN_CLEAN_004', 'en', 'All machines are clean, covered, and stored in their designated places.', null),
  ('CLOSING', 'KITCHEN_CLEAN_005', 'en', 'The grease trap is clean.', null),
  ('CLOSING', 'KITCHEN_CLEAN_006', 'en', 'All waste has been taken to the designated disposal area.', null),
  ('CLOSING', 'KITCHEN_CLEAN_007', 'en', 'All trash bins are clean and lined with new, clean plastic liners.', null),
  ('CLOSING', 'KITCHEN_CLEAN_008', 'en', 'Gutters and drains are clean.', null),
  ('CLOSING', 'KITCHEN_STORAGE_001', 'en', 'All wet stock is stored at the correct temperature, hygienically and covered, with item name and date labels.', null),
  ('CLOSING', 'KITCHEN_TEMP_001', 'en', 'Chiller temperature', 'Standard: 1°C to 4°C.'),
  ('CLOSING', 'KITCHEN_TEMP_002', 'en', 'Freezer temperature', 'Standard: -18°C or lower.'),
  ('CLOSING', 'KITCHEN_EQUIP_001', 'en', 'The fryer and oven have cooled down; the soup warmer and rice cooker are clean.', null),
  ('CLOSING', 'KITCHEN_EQUIP_002', 'en', 'All BOH stoves are in a safe condition.', null),
  ('CLOSING', 'KITCHEN_EQUIP_003', 'en', 'BOH gas and stoves are shut off (central gas line).', null),
  ('CLOSING', 'KITCHEN_EQUIP_004', 'en', 'Fixer and wall-corner areas, Sogemerner, and Rice Cooker are clean.', null),
  ('CLOSING', 'KITCHEN_EQUIP_005', 'en', 'All lights have been switched off.', null),
  ('CLOSING', 'KITCHEN_PEST_001', 'en', 'Pest traps have been checked.', null),
  ('CLOSING', 'KITCHEN_PEST_002', 'en', 'There are no pest droppings or pests in any area.', null),
  ('CLOSING', 'KITCHEN_PEST_003', 'en', 'No foreign objects are visible to guests.', null),
  ('CLOSING', 'KITCHEN_SECURITY_001', 'en', 'The outlet is securely locked.', null);

create temporary table v1_targets (
  form_code text primary key,
  form_id uuid not null,
  form_version_id uuid not null,
  version_section_id uuid not null
) on commit drop;

insert into v1_targets (
  form_code,
  form_id,
  form_version_id,
  version_section_id
)
select
  f.code,
  f.id,
  fv.id,
  fvs.id
from public.forms f
join public.form_versions fv
  on fv.form_id = f.id
 and fv.version_number = 1
 and fv.status = 'published'
join public.sections s
  on s.form_id = f.id
 and s.code = 'KITCHEN'
join public.form_version_sections fvs
  on fvs.form_version_id = fv.id
 and fvs.section_id = s.id
where f.code in ('OPENING', 'CLOSING');

do $preflight$
declare
  v_form_code text;
  target_version_count integer;
  target_section_count integer;
  active_group_count integer;
  active_question_count integer;
  expected_group_count integer;
  expected_question_count integer;
  invalid_group_count integer;
  invalid_question_count integer;
begin
  foreach v_form_code in array array['OPENING', 'CLOSING']
  loop
    select count(*)
      into target_version_count
    from public.forms f
    join public.form_versions fv
      on fv.form_id = f.id
     and fv.version_number = 1
     and fv.status = 'published'
    where f.code = v_form_code;

    if target_version_count <> 1 then
      raise exception
        '% V1 published form version count must be exactly 1, found %.',
        v_form_code,
        target_version_count;
    end if;

    select count(*)
      into target_section_count
    from v1_targets
    where v1_targets.form_code = v_form_code;

    if target_section_count <> 1 then
      raise exception
        '% V1 KITCHEN version section count must be exactly 1, found %.',
        v_form_code,
        target_section_count;
    end if;

    select count(*)
      into active_group_count
    from public.question_groups qg
    join v1_targets t
      on t.version_section_id = qg.version_section_id
    where t.form_code = v_form_code
      and qg.is_active = true;

    select count(*)
      into expected_group_count
    from expected_v1_groups
    where expected_v1_groups.form_code = v_form_code;

    if active_group_count <> expected_group_count then
      raise exception
        '% active question group count must be %, found %.',
        v_form_code,
        expected_group_count,
        active_group_count;
    end if;

    select count(*)
      into invalid_group_count
    from expected_v1_groups eg
    left join public.question_groups qg
      on qg.code = eg.code
     and qg.is_active = true
     and qg.version_section_id = (
       select version_section_id
       from v1_targets
      where v1_targets.form_code = v_form_code
     )
    where eg.form_code = v_form_code
      and qg.id is null;

    if invalid_group_count <> 0 then
      raise exception
        '% V1 expected active question group codes are incomplete (% missing).',
        v_form_code,
        invalid_group_count;
    end if;

    select count(*)
      into active_question_count
    from public.questions q
    join v1_targets t
      on t.version_section_id = q.version_section_id
    where t.form_code = v_form_code
      and q.is_active = true;

    select count(*)
      into expected_question_count
    from expected_v1_questions
    where expected_v1_questions.form_code = v_form_code;

    if active_question_count <> expected_question_count then
      raise exception
        '% active question count must be %, found %.',
        v_form_code,
        expected_question_count,
        active_question_count;
    end if;

    select count(*)
      into invalid_question_count
    from expected_v1_questions eq
    left join public.questions q
      on q.code = eq.code
     and q.is_active = true
     and q.version_section_id = (
       select version_section_id
       from v1_targets
      where v1_targets.form_code = v_form_code
     )
    where eq.form_code = v_form_code
      and q.id is null;

    if invalid_question_count <> 0 then
      raise exception
        '% V1 expected active question codes are incomplete (% missing).',
        v_form_code,
        invalid_question_count;
    end if;
  end loop;
end;
$preflight$;

insert into public.form_version_section_translations (
  version_section_id,
  locale,
  display_name,
  description
)
select
  t.version_section_id,
  'id-ID',
  case t.form_code
    when 'OPENING' then 'Pembukaan Dapur'
    when 'CLOSING' then 'BOH / Dapur'
  end,
  case t.form_code
    when 'OPENING' then 'Kesiapan operasional pembukaan Kitchen / BOH.'
    when 'CLOSING' then 'Checklist penutupan untuk BOH / Dapur.'
  end
from v1_targets t
on conflict (version_section_id, locale)
do update set
  display_name = excluded.display_name,
  description = excluded.description;

insert into public.question_group_translations (
  question_group_id,
  locale,
  display_name,
  description
)
select
  qg.id,
  'id-ID',
  eg.display_name,
  eg.description
from expected_v1_groups eg
join v1_targets t
  on t.form_code = eg.form_code
join public.question_groups qg
  on qg.version_section_id = t.version_section_id
 and qg.code = eg.code
 and qg.is_active = true
on conflict (question_group_id, locale)
do update set
  display_name = excluded.display_name,
  description = excluded.description;

insert into public.question_translations (
  question_id,
  locale,
  question_text,
  help_text
)
select
  q.id,
  eq.locale,
  eq.question_text,
  eq.help_text
from expected_v1_questions eq
join v1_targets t
  on t.form_code = eq.form_code
join public.questions q
  on q.version_section_id = t.version_section_id
 and q.code = eq.code
 and q.is_active = true
on conflict (question_id, locale)
do update set
  question_text = excluded.question_text,
  help_text = excluded.help_text;

do $postflight$
declare
  opening_section_count integer;
  opening_group_count integer;
  opening_question_count integer;
  closing_section_count integer;
  closing_group_count integer;
  closing_question_count integer;
  missing_group_translations integer;
  missing_question_translations integer;
begin
  select count(*)
    into opening_section_count
  from public.form_version_section_translations vst
  join v1_targets t
    on t.version_section_id = vst.version_section_id
  where t.form_code = 'OPENING'
    and vst.locale = 'id-ID';

  select count(*)
    into opening_group_count
  from public.question_group_translations qgt
  join public.question_groups qg
    on qg.id = qgt.question_group_id
  join v1_targets t
    on t.version_section_id = qg.version_section_id
  where t.form_code = 'OPENING'
    and qgt.locale = 'id-ID'
    and qg.is_active = true;

  select count(*)
    into opening_question_count
  from public.question_translations qt
  join public.questions q
    on q.id = qt.question_id
  join v1_targets t
    on t.version_section_id = q.version_section_id
  where t.form_code = 'OPENING'
    and qt.locale = 'id-ID'
    and q.is_active = true;

  select count(*)
    into closing_section_count
  from public.form_version_section_translations vst
  join v1_targets t
    on t.version_section_id = vst.version_section_id
  where t.form_code = 'CLOSING'
    and vst.locale = 'id-ID';

  select count(*)
    into closing_group_count
  from public.question_group_translations qgt
  join public.question_groups qg
    on qg.id = qgt.question_group_id
  join v1_targets t
    on t.version_section_id = qg.version_section_id
  where t.form_code = 'CLOSING'
    and qgt.locale = 'id-ID'
    and qg.is_active = true;

  select count(*)
    into closing_question_count
  from public.question_translations qt
  join public.questions q
    on q.id = qt.question_id
  join v1_targets t
    on t.version_section_id = q.version_section_id
  where t.form_code = 'CLOSING'
    and qt.locale = 'en'
    and q.is_active = true;

  if opening_section_count <> 1
    or opening_group_count <> 6
    or opening_question_count <> 20
    or closing_section_count <> 1
    or closing_group_count <> 6
    or closing_question_count <> 20 then
    raise exception
      'Unexpected Restaurant V1 translation counts: OPENING section %, groups %, questions %; CLOSING section %, groups %, en questions %.',
      opening_section_count,
      opening_group_count,
      opening_question_count,
      closing_section_count,
      closing_group_count,
      closing_question_count;
  end if;

  select count(*)
    into missing_group_translations
  from expected_v1_groups eg
  join v1_targets t
    on t.form_code = eg.form_code
  left join public.question_groups qg
    on qg.version_section_id = t.version_section_id
   and qg.code = eg.code
   and qg.is_active = true
  left join public.question_group_translations qgt
    on qgt.question_group_id = qg.id
   and qgt.locale = 'id-ID'
  where qgt.id is null;

  if missing_group_translations <> 0 then
    raise exception
      'Missing % expected Restaurant V1 id-ID group translations.',
      missing_group_translations;
  end if;

  select count(*)
    into missing_question_translations
  from expected_v1_questions eq
  join v1_targets t
    on t.form_code = eq.form_code
  left join public.questions q
    on q.version_section_id = t.version_section_id
   and q.code = eq.code
   and q.is_active = true
  left join public.question_translations qt
    on qt.question_id = q.id
   and qt.locale = eq.locale
  where qt.id is null;

  if missing_question_translations <> 0 then
    raise exception
      'Missing % expected Restaurant V1 question translations.',
      missing_question_translations;
  end if;
end;
$postflight$;

commit;
