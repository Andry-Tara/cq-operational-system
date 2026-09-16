begin;

-- ============================================================
-- A3 — SEED OUTLET AUDIT V1 REFERENCE POINTS
--
-- Source: supplied "FORM ASSESSMENT OUTLET" report.
-- 98 reference points total.
--
-- IMPORTANT:
-- - finding-only runtime
-- - questions are NOT mandatory
-- - untouched points are NOT PASS
-- - no yes/no answers are created by this migration
-- - risk/category are selected only when a finding is added
-- ============================================================

create temporary table a3_audit_question_seed (
  source_no integer primary key,
  group_code text not null,
  question_text text not null
) on commit drop;

insert into a3_audit_question_seed (
  source_no,
  group_code,
  question_text
)
values
  (1, 'PARKING_AREA', 'Signage prima'),
  (2, 'PARKING_AREA', 'Halaman parkir bersih'),
  (3, 'PARKING_AREA', 'Genset berfungsi'),
  (4, 'PARKING_AREA', 'Gerbang parkir terbuka'),
  (5, 'PARKING_AREA', 'Pembuangan rapih & tidak berbau'),
  (6, 'PARKING_AREA', 'Lobby bersih terawat'),
  (7, 'PARKING_AREA', 'Area Vallet bersih terawat'),
  (8, 'PARKING_AREA', 'Tanaman rapih & terawat'),
  (9, 'FOH', 'Lantai bersih'),
  (10, 'FOH', 'Lampu prima & terawat'),
  (11, 'FOH', 'AC prima & berfungsi baik'),
  (12, 'FOH', 'AC menyala sesuai standarisasi'),
  (13, 'FOH', 'Seluruh CCTV berfungsi dgn baik'),
  (14, 'FOH', 'Speaker lagu berfungsi dgn baik'),
  (15, 'FOH', 'Lagu disetel sesuai standarisasi CQ'),
  (16, 'FOH', 'Area ruang tunggu terawat'),
  (17, 'FOH', 'Furniture ruang tunggu terawat'),
  (18, 'FOH', 'Area host bersih & terawat'),
  (19, 'FOH', 'Area tangga bersih & terawat'),
  (20, 'FOH', 'Mesin kasir (incl. printer komputer dsb) berfungsi baik'),
  (21, 'FOH', 'EDC berfungsi baik'),
  (22, 'FOH', 'Area sudut, langit2, pajangan/lukisan & sejenisnya bersih'),
  (23, 'FOH', 'Pembatas ruangan bersih terawat'),
  (24, 'FOH', 'Seluruh meja bersih & terawat (incl. kolong meja)'),
  (25, 'FOH', 'Seluruh kursi bersih & terawat (inlc. kolong kursi)'),
  (26, 'FOH', 'Perlengkapan di atas meja tertata sesuai standarisasi CQ'),
  (27, 'FOH', 'Kondisi tent card bersih & terawat'),
  (28, 'FOH', 'Seluruh kompor berfungsi dgn baik'),
  (29, 'FOH', 'Seluruh bell berfungi dgn baik'),
  (30, 'FOH', 'Trolley bersih & terawat'),
  (31, 'FOH', 'Seluruh tampilan materi iklan pada TV baik'),
  (32, 'FOH', 'TV berfungsi baik & bersih terawat'),
  (33, 'FOH', 'Peralatan karaoke bersih & terawat serta befungsi baik (incl. sound system, mic, remote, speaker)'),
  (34, 'FOH', 'Seluruh Tab berfungsi baik & bersih terawat Include Cover'),
  (35, 'FOH', 'Seluruh HT berfungsi baik & bersih terawat'),
  (36, 'FOH', 'Air purifier berfungsi baik (incl kelayakan saringan)'),
  (37, 'FOH', 'Seluruh kabel tersusun rapih di area FOH'),
  (38, 'FOH', 'Sauce station bersih dan terawat'),
  (39, 'FOH', 'Sauce station terisi pas sesuai hari dan tertutup Serta pengisian Ice crushed Before Lunch dan Dinner'),
  (40, 'FOH', 'Magkok Sauce yang dipakai sesuai standarisasi'),
  (41, 'FOH', 'Tidak ada peralatan FOH yg berantakan terlihat tamu'),
  (42, 'FOH', 'Tidak ada pajangan yg tidak sesuai dengan standarisasi CQ'),
  (43, 'PLAYGROUND', 'Lantai bersih'),
  (44, 'PLAYGROUND', 'Mainan bersih & terawat'),
  (45, 'PLAYGROUND', 'Mainan tersusun rapih'),
  (46, 'TOILET', 'Toilet bersih (lantai, cermin, perabotan, pintu & gagang)'),
  (47, 'TOILET', 'Tong sampah bersih dan terpasang kantong sampah'),
  (48, 'TOILET', 'Closet bersih'),
  (49, 'TOILET', 'Wastafel bersih'),
  (50, 'TOILET', 'Toilet berfungsi baik (Flush, jet washer, keran wastafel)'),
  (51, 'TOILET', 'Sabun terisi'),
  (52, 'TOILET', 'Tissue toilet terisi'),
  (53, 'TOILET', 'Wewangian toilet sesuai standarisasi CQ'),
  (54, 'TOILET', 'Tidak ada peralatan housekeeping yg berantakan terlihat tamu'),
  (55, 'TOILET', 'Exhaust berfungsi dengan baik'),
  (56, 'TOILET', 'Air mengalir deras tanpa ada penyumbatan'),
  (57, 'GROOMING', 'Tampilan FOH/HP sesuai standarisasi CQ (Kerapihan seragam, Hair do, make up, non accecories, sepatu hitam)'),
  (58, 'GROOMING', 'Perlengkapan kerja host/HP (HP, Buku reservasi, pena, HT, dsb)'),
  (59, 'GROOMING', 'Perlengkapan kerja server/HP (Tab, kertas, pena, HT, dsb)'),
  (60, 'GROOMING', 'Perlengakapan kerja housekeeping/HA seragam, celemek, perlengkapan pembersih dll lengkap'),
  (61, 'GROOMING', 'Tampilan BOH/CP sesuai standarisasi CQ (Kerapihan seragam, Cap, Penutup Mulut, non accecories, sepatu boots)'),
  (62, 'BOH', 'Kondisi seluruh lantai bersih incl keset/anti slip (tdk licin,tdk becek/basah)'),
  (63, 'BOH', 'Area kerja BOH per section bersih (meja kerja, peralatan dan lantai)'),
  (64, 'BOH', 'Seluruh Lap yang dipakai bersih wajar dan kondisi prima'),
  (65, 'BOH', 'Tools & Equipment per section teratur (setiap barang pada tmptnya)'),
  (66, 'BOH', 'Seluruh perlengkapan kerja per section lengkap dan berfungsi baik guna mendukung kegiatan operasional'),
  (67, 'BOH', 'Bahan baku basah segar'),
  (68, 'BOH', 'Bahan baku kering masih on expiry'),
  (69, 'BOH', 'Barang setengah jadi masih segar dan layak saji'),
  (70, 'BOH', 'FIFO di setiap section terjadi'),
  (71, 'BOH', 'Tidak ada peralatan BOH yg berantakan terlihat tamu'),
  (72, 'BOH', 'Area Shao Kao terlihat bersih dan teratur'),
  (73, 'BOH', 'Panggangan Shao Kao bersih wajar / terawat'),
  (74, 'BOH', 'Area Kafei/Bar terlihat bersih dan teratur'),
  (75, 'BOH', 'AC/Exhaust kondisi baik dan prima'),
  (76, 'BOH', 'Lampu baik dan prima'),
  (77, 'BOH', 'Seluruh Mesin baik dan prima (RO filter, mesin es, Meat Slicer,etc)'),
  (78, 'BOH', 'Seluruh perlengkapan elektronik (CCTV, TV, tab & omputer) baik dan prima'),
  (79, 'BOH', 'Seluruh kulkas baik dan prima'),
  (80, 'BOH', 'Grease Trap bersih wajar / terawat'),
  (81, 'BOH', 'Gorong-gorong bersih wajar dan terawat'),
  (82, 'BOH', 'Seluruh wastafel berfungsi baik'),
  (83, 'BOH', 'Seluruh lemari penyimpanan tersusun baik, rapih dan aman'),
  (84, 'BOH', 'Rak stock bahan baku kering tersusun baik, rapih dan aman (Dry Storage Suplies dan bahan baku)'),
  (85, 'BOH', 'Seluruh kulkas penyimpanan tersusun baik, rapih dan aman'),
  (86, 'BOH', 'Perlengkapan masak kondisi baik dan prima'),
  (87, 'BOH', 'Seluruh kompor berfungsi dgn baik'),
  (88, 'BOH', 'Bell Dapur bersih dan berfungsi dgn baik'),
  (89, 'BOH', 'Perlengkapan saji (dari piring, mangkok, gelas, teko sampai nampan saji, dsb) dalam kondisi prima dan bersih'),
  (90, 'BOH', 'Check All APAR Pastikan kondisi Baik dan Prima'),
  (91, 'BOH', 'Tong sampah bersih dan terpasang kantong sampah (tdk mengeluarkan bau)'),
  (92, 'BOH', 'Bak Control pembuangan utama Bersih'),
  (93, 'BOH', 'Lorong dan Loker karyawan bersih dan rapih'),
  (94, 'BOH', 'Toilet Karyawan Bersih dan Rapih'),
  (95, 'BOH', 'Sabun cuci area sink kitchen terisi'),
  (96, 'FOH_BOH', 'Area FOH dan BOH bersih dari hama dan kotoran hama'),
  (97, 'FOH_BOH', 'Tidak ada barang asing yang terlihat tamu dan disimpan di area outlet'),
  (98, 'FOH_BOH', 'Tidak terdapat Makanan Sisa Tamu (Masita) di area outlet');


-- ============================================================
-- PREFLIGHT
-- ============================================================

do $$
declare
  v_form_id uuid;
  v_version_id uuid;
  v_version_section_id uuid;
  v_count integer;
  v_bad text;
begin
  select f.id
    into v_form_id
  from public.forms f
  where upper(f.code) = 'OUTLET_AUDIT'
    and f.operational_scope = 'restaurant'
  limit 1;

  if v_form_id is null then
    raise exception 'A3 STOP: OUTLET_AUDIT form not found.';
  end if;

  select fv.id
    into v_version_id
  from public.form_versions fv
  where fv.form_id = v_form_id
    and fv.version_number = 1
    and fv.status = 'draft'
  limit 1;

  if v_version_id is null then
    raise exception 'A3 STOP: OUTLET_AUDIT v1 draft not found.';
  end if;

  select fvs.id
    into v_version_section_id
  from public.form_version_sections fvs
  where fvs.form_version_id = v_version_id
    and fvs.is_active = true
  order by fvs.sort_order
  limit 1;

  if v_version_section_id is null then
    raise exception 'A3 STOP: active OUTLET_AUDIT version section not found.';
  end if;

  select count(*)
    into v_count
  from public.questions q
  where q.version_section_id = v_version_section_id;

  if v_count <> 0 then
    raise exception
      'A3 STOP: OUTLET_AUDIT v1 already contains % questions. Seed refused.',
      v_count;
  end if;

  select count(*)
    into v_count
  from a3_audit_question_seed;

  if v_count <> 98 then
    raise exception
      'A3 STOP: seed must contain exactly 98 points, found %.',
      v_count;
  end if;

  select string_agg(s.group_code, ', ' order by s.group_code)
    into v_bad
  from (
    select distinct seed.group_code
    from a3_audit_question_seed seed
    where not exists (
      select 1
      from public.question_groups qg
      where qg.version_section_id = v_version_section_id
        and qg.code = seed.group_code
        and qg.is_active = true
    )
  ) s;

  if v_bad is not null then
    raise exception
      'A3 STOP: missing/inactive audit question groups: %.',
      v_bad;
  end if;
end;
$$;


-- ============================================================
-- INSERT 98 REFERENCE POINTS
-- ============================================================

insert into public.questions (
  version_section_id,
  code,
  question_text,
  question_type,
  is_required,
  unit,
  min_value,
  max_value,
  config,
  sort_order,
  is_active,
  question_group_id
)
select
  fvs.id,
  'AUD_' || lpad(seed.source_no::text, 3, '0'),
  seed.question_text,
  'yes_no',
  false,
  null,
  null,
  null,
  jsonb_build_object(
    'source', 'FORM_ASSESSMENT_OUTLET',
    'source_no', seed.source_no,
    'audit_mode', 'finding_only',
    'reference_only', true,
    'evidence_mode', 'none'
  ),
  seed.source_no * 10,
  true,
  qg.id
from a3_audit_question_seed seed
join public.forms f
  on upper(f.code) = 'OUTLET_AUDIT'
 and f.operational_scope = 'restaurant'
join public.form_versions fv
  on fv.form_id = f.id
 and fv.version_number = 1
 and fv.status = 'draft'
join public.form_version_sections fvs
  on fvs.form_version_id = fv.id
 and fvs.is_active = true
join public.question_groups qg
  on qg.version_section_id = fvs.id
 and qg.code = seed.group_code
 and qg.is_active = true
order by seed.source_no;


-- ============================================================
-- POST-FLIGHT
-- ============================================================

do $$
declare
  v_form_id uuid;
  v_version_id uuid;
  v_version_section_id uuid;
  v_count integer;
  v_bad text;
begin
  select f.id
    into v_form_id
  from public.forms f
  where upper(f.code) = 'OUTLET_AUDIT'
    and f.operational_scope = 'restaurant'
  limit 1;

  select fv.id
    into v_version_id
  from public.form_versions fv
  where fv.form_id = v_form_id
    and fv.version_number = 1
    and fv.status = 'draft'
  limit 1;

  select fvs.id
    into v_version_section_id
  from public.form_version_sections fvs
  where fvs.form_version_id = v_version_id
    and fvs.is_active = true
  order by fvs.sort_order
  limit 1;

  select count(*)
    into v_count
  from public.questions q
  where q.version_section_id = v_version_section_id
    and q.is_active = true;

  if v_count <> 98 then
    raise exception
      'A3 POSTCHECK: expected 98 active audit questions, found %.',
      v_count;
  end if;

  select string_agg(
           qg.code || '=' || c.actual_count::text || '/' || c.expected_count::text,
           ', '
           order by qg.sort_order
         )
    into v_bad
  from (
    select
      expected.group_code,
      expected.expected_count,
      count(q.id)::integer as actual_count
    from (
      values
        ('PARKING_AREA'::text, 8),
        ('FOH'::text, 34),
        ('PLAYGROUND'::text, 3),
        ('TOILET'::text, 11),
        ('GROOMING'::text, 5),
        ('BOH'::text, 34),
        ('FOH_BOH'::text, 3)
    ) expected(group_code, expected_count)
    join public.question_groups qg2
      on qg2.version_section_id = v_version_section_id
     and qg2.code = expected.group_code
    left join public.questions q
      on q.question_group_id = qg2.id
     and q.version_section_id = v_version_section_id
     and q.is_active = true
    group by expected.group_code, expected.expected_count
  ) c
  join public.question_groups qg
    on qg.version_section_id = v_version_section_id
   and qg.code = c.group_code
  where c.actual_count <> c.expected_count;

  if v_bad is not null then
    raise exception
      'A3 POSTCHECK: group counts mismatch: %.',
      v_bad;
  end if;

  select string_agg(q.code, ', ' order by q.code)
    into v_bad
  from public.questions q
  where q.version_section_id = v_version_section_id
    and (
      q.is_required = true
      or coalesce(q.config->>'audit_mode', '') <> 'finding_only'
      or coalesce((q.config->>'reference_only')::boolean, false) <> true
    );

  if v_bad is not null then
    raise exception
      'A3 POSTCHECK: one or more questions violate finding-only reference rules: %.',
      v_bad;
  end if;

  if exists (
    select 1
    from public.outlet_form_assignments ofa
    where ofa.form_id = v_form_id
      and ofa.is_active = true
  ) then
    raise exception
      'A3 POSTCHECK: OUTLET_AUDIT must still have no active outlet assignments.';
  end if;
end;
$$;

commit;
