begin;

-- ============================================================
-- O3K-A2 — BILINGUAL CQ SPLIT CHECKLIST TRANSLATIONS
--
-- Locales:
--   en
--   id-ID
--
-- Targets only the current O3K all-photo DRAFT versions for:
--   OPENING_FOH / OPENING_BOH / CLOSING_FOH / CLOSING_BOH
--
-- Also sets the 9 CQ split outlets to default_locale = id-ID.
--
-- DD CGU / SMY are NOT changed here. Their dedicated versions
-- will receive the same EN + ID translation completeness later,
-- with default locale EN.
-- ============================================================

create temporary table o3k_translation_seed (
  form_code text not null,
  question_code text not null,
  id_text text not null,
  en_text text not null,
  primary key (form_code, question_code)
) on commit drop;

insert into o3k_translation_seed (
  form_code,
  question_code,
  id_text,
  en_text
)
values
  ('OPENING_FOH', 'OPN_FOH_001', 'Signage prima', 'Signage is in good condition'),
  ('OPENING_FOH', 'OPN_FOH_002', 'Halaman parkir bersih', 'Parking area is clean'),
  ('OPENING_FOH', 'OPN_FOH_003', 'Genset berfungsi', 'Generator is functioning properly'),
  ('OPENING_FOH', 'OPN_FOH_004', 'Gerbang parkir terbuka', 'Parking gate is open'),
  ('OPENING_FOH', 'OPN_FOH_005', 'Pembuangan rapih & tidak berbau', 'Waste disposal area is neat and odor-free'),
  ('OPENING_FOH', 'OPN_FOH_006', 'Lobby bersih terawat', 'Lobby is clean and well maintained'),
  ('OPENING_FOH', 'OPN_FOH_007', 'Area Vallet bersih terawat', 'Valet area is clean and well maintained'),
  ('OPENING_FOH', 'OPN_FOH_008', 'Tanaman rapih & terawat', 'Plants are neat and well maintained'),
  ('OPENING_FOH', 'OPN_FOH_009', 'Lantai bersih', 'Floor is clean'),
  ('OPENING_FOH', 'OPN_FOH_010', 'Lampu prima & terawat', 'Lights are in good condition and well maintained'),
  ('OPENING_FOH', 'OPN_FOH_011', 'AC prima & berfungsi baik', 'Air conditioning is in good condition and functioning properly'),
  ('OPENING_FOH', 'OPN_FOH_012', 'AC menyala sesuai dengan standarisasi (mode, suhu, hembusan)', 'Air conditioning is operating according to standard settings (mode, temperature, airflow)'),
  ('OPENING_FOH', 'OPN_FOH_013', 'Seluruh CCTV berfungsi dgn baik', 'All CCTV cameras are functioning properly'),
  ('OPENING_FOH', 'OPN_FOH_014', 'Speaker lagu berfungsi dgn baik', 'Music speakers are functioning properly'),
  ('OPENING_FOH', 'OPN_FOH_015', 'Lagu disetel sesuai standarisasi CQ', 'Music is set according to CQ standards'),
  ('OPENING_FOH', 'OPN_FOH_016', 'Area ruang tunggu terawat', 'Waiting area is well maintained'),
  ('OPENING_FOH', 'OPN_FOH_017', 'Furniture ruang tunggu terawat', 'Waiting-area furniture is well maintained'),
  ('OPENING_FOH', 'OPN_FOH_018', 'Area host bersih & terawat', 'Host area is clean and well maintained'),
  ('OPENING_FOH', 'OPN_FOH_019', 'Area tangga bersih & terawat', 'Stair area is clean and well maintained'),
  ('OPENING_FOH', 'OPN_FOH_020', 'Mesin kasir (incl. printer komputer dsb) berfungsi baik', 'Cashier equipment (including printer, computer, etc.) is functioning properly'),
  ('OPENING_FOH', 'OPN_FOH_021', 'EDC berfungsi baik', 'EDC terminal is functioning properly'),
  ('OPENING_FOH', 'OPN_FOH_022', 'Area sudut, langit2, pajangan/lukisan & sejenisnya bersih', 'Corners, ceilings, displays/paintings, and similar areas are clean'),
  ('OPENING_FOH', 'OPN_FOH_023', 'Pembatas ruangan bersih terawat', 'Room partitions are clean and well maintained'),
  ('OPENING_FOH', 'OPN_FOH_024', 'Seluruh meja bersih & terawat (incl. kolong meja)', 'All tables are clean and well maintained, including underneath'),
  ('OPENING_FOH', 'OPN_FOH_025', 'Seluruh kursi bersih & terawat (incl. kolong kursi)', 'All chairs are clean and well maintained, including underneath'),
  ('OPENING_FOH', 'OPN_FOH_026', 'Perlengkapan di atas meja tertata sesuai standarisasi CQ', 'Tabletop equipment is arranged according to CQ standards'),
  ('OPENING_FOH', 'OPN_FOH_027', 'Kondisi tent card bersih & terawat', 'Tent cards are clean and well maintained'),
  ('OPENING_FOH', 'OPN_FOH_028', 'Seluruh Tab berfungsi baik & bersih terawat Include Cover', 'All tablets are functioning properly, clean, and well maintained, including covers'),
  ('OPENING_FOH', 'OPN_FOH_029', 'Seluruh kompor berfungsi dgn baik', 'All stoves are functioning properly'),
  ('OPENING_FOH', 'OPN_FOH_030', 'Seluruh bell berfungsi dgn baik', 'All service bells are functioning properly'),
  ('OPENING_FOH', 'OPN_FOH_031', 'Sauce station bersih dan terawat', 'Sauce station is clean and well maintained'),
  ('OPENING_FOH', 'OPN_FOH_032', 'Ice Crushed sudah terisi pada Sauce Station', 'Crushed ice is stocked at the sauce station'),
  ('OPENING_FOH', 'OPN_FOH_033', 'Wadah Sauce station sudah terisi (sesuai dengan tingkat kepenuhan, jenis dan pengaturan hari) dan tertutup dengan rapih', 'Sauce-station containers are filled to the required level and setup for the day, and are neatly covered'),
  ('OPENING_FOH', 'OPN_FOH_034', 'Mangkok Sauce yang dipakai sesuai standarisasi', 'The sauce bowls in use comply with standards'),
  ('OPENING_FOH', 'OPN_FOH_035', 'Trolley bersih & terawat', 'Trolley is clean and well maintained'),
  ('OPENING_FOH', 'OPN_FOH_036', 'Seluruh tampilan materi iklan pada TV baik', 'All advertising material displayed on the TV is shown properly'),
  ('OPENING_FOH', 'OPN_FOH_037', 'TV berfungsi baik & bersih terawat', 'TV is functioning properly, clean, and well maintained'),
  ('OPENING_FOH', 'OPN_FOH_038', 'Peralatan karaoke bersih & terawat serta berfungsi baik (incl. sound system, mic, remote, speaker)', 'Karaoke equipment is clean, well maintained, and functioning properly (including sound system, microphone, remote, and speakers)'),
  ('OPENING_FOH', 'OPN_FOH_039', 'Air purifier berfungsi baik (incl. kelayakan saringan)', 'Air purifier is functioning properly, including filter condition'),
  ('OPENING_FOH', 'OPN_FOH_040', 'Seluruh kabel tersusun rapih di area FOH', 'All cables are neatly arranged in the FOH area'),
  ('OPENING_FOH', 'OPN_FOH_041', 'Tidak ada peralatan FOH yg berantakan terlihat tamu', 'No untidy FOH equipment is visible to guests'),
  ('OPENING_FOH', 'OPN_FOH_042', 'Tidak ada pajangan yg tidak sesuai dengan standarisasi CQ', 'No displays are inconsistent with CQ standards'),
  ('OPENING_FOH', 'OPN_FOH_043', 'Seluruh HT berfungsi baik & bersih terawat', 'All walkie-talkies are functioning properly, clean, and well maintained'),
  ('OPENING_FOH', 'OPN_FOH_044', 'Tampilan FOH/HP sesuai standarisasi CQ (Kerapihan seragam, Hair do, make up, non accesories, sepatu hitam)', 'FOH/HP appearance complies with CQ standards (neat uniform, hair, makeup, no accessories, black shoes)'),
  ('OPENING_FOH', 'OPN_FOH_045', 'Perlengkapan kerja host/HP (HP, Buku reservasi, pena, HT, dsb)', 'Host/HP work equipment is complete (phone, reservation book, pen, walkie-talkie, etc.)'),
  ('OPENING_FOH', 'OPN_FOH_046', 'Perlengkapan kerja server/HP (Tab, kertas, pena, HT, dsb)', 'Server/HP work equipment is complete (tablet, paper, pen, walkie-talkie, etc.)'),
  ('OPENING_FOH', 'OPN_FOH_047', 'Perlengkapan kerja housekeeping/Toilet Attendance lengkap (seragam, celemek, perlengkapan pembersih dll)', 'Housekeeping/Toilet Attendant work equipment is complete (uniform, apron, cleaning supplies, etc.)'),
  ('OPENING_FOH', 'OPN_FOH_048', 'Lantai bersih', 'Floor is clean'),
  ('OPENING_FOH', 'OPN_FOH_049', 'Mainan bersih & terawat', 'Toys are clean and well maintained'),
  ('OPENING_FOH', 'OPN_FOH_050', 'Mainan tersusun rapih', 'Toys are neatly arranged'),
  ('OPENING_FOH', 'OPN_FOH_051', 'Toilet bersih (lantai, cermin, perabotan, pintu & gagang)', 'Restroom is clean (floor, mirror, fixtures, door, and handle)'),
  ('OPENING_FOH', 'OPN_FOH_052', 'Tong sampah bersih dan terpasang kantong sampah', 'Trash bin is clean and fitted with a trash liner'),
  ('OPENING_FOH', 'OPN_FOH_053', 'Closet bersih', 'Toilet bowl is clean'),
  ('OPENING_FOH', 'OPN_FOH_054', 'Wastafel bersih', 'Sink is clean'),
  ('OPENING_FOH', 'OPN_FOH_055', 'Toilet berfungsi baik (Flush, jet washer, keran wastafel)', 'Restroom fixtures are functioning properly (flush, jet washer, sink faucet)'),
  ('OPENING_FOH', 'OPN_FOH_056', 'Sabun terisi', 'Soap is stocked'),
  ('OPENING_FOH', 'OPN_FOH_057', 'Tissue toilet terisi', 'Toilet tissue is stocked'),
  ('OPENING_FOH', 'OPN_FOH_058', 'Pewangi toilet sesuai standarisasi CQ', 'Restroom fragrance complies with CQ standards'),
  ('OPENING_FOH', 'OPN_FOH_059', 'Tidak ada peralatan housekeeping yg berantakan terlihat tamu', 'No untidy housekeeping equipment is visible to guests'),
  ('OPENING_BOH', 'OPN_BOH_001', 'Kondisi seluruh lantai bersih incl keset/anti slip (tdk licin,tdk becek/basah)', 'All floors are clean, including mats/anti-slip surfaces (not slippery, muddy, or wet)'),
  ('OPENING_BOH', 'OPN_BOH_002', 'Area kerja BOH per section bersih (meja kerja, peralatan dan lantai)', 'BOH work areas in each section are clean (worktables, equipment, and floors)'),
  ('OPENING_BOH', 'OPN_BOH_003', 'Seluruh Lap yang dipakai bersih wajar dan kondisi prima', 'All cleaning cloths in use are reasonably clean and in good condition'),
  ('OPENING_BOH', 'OPN_BOH_004', 'Tools & Equipment per section teratur (setiap barang pada tmptnya)', 'Tools and equipment in each section are organized, with every item in its proper place'),
  ('OPENING_BOH', 'OPN_BOH_005', 'Seluruh perlengkapan kerja per section lengkap dan berfungsi baik guna mendukung kegiatan operasional', 'All work equipment in each section is complete and functioning properly to support operations'),
  ('OPENING_BOH', 'OPN_BOH_006', 'Bahan baku basah segar', 'Fresh/wet raw ingredients are fresh'),
  ('OPENING_BOH', 'OPN_BOH_007', 'Bahan baku kering masih on expiry', 'Dry ingredients are still within their expiry dates'),
  ('OPENING_BOH', 'OPN_BOH_008', 'Barang setengah jadi masih segar dan layak saji', 'Semi-finished products are still fresh and fit to serve'),
  ('OPENING_BOH', 'OPN_BOH_009', 'FIFO di setiap section terjadi', 'FIFO is properly applied in every section'),
  ('OPENING_BOH', 'OPN_BOH_010', 'Tidak ada peralatan BOH yg berantakan terlihat tamu', 'No untidy BOH equipment is visible to guests'),
  ('OPENING_BOH', 'OPN_BOH_011', 'Area Shao Kao terlihat bersih dan teratur', 'Shao Kao area is clean and organized'),
  ('OPENING_BOH', 'OPN_BOH_012', 'Panggangan Shao Kao bersih wajar / terawat', 'Shao Kao grill is reasonably clean and well maintained'),
  ('OPENING_BOH', 'OPN_BOH_013', 'Area Kafei/Bar terlihat bersih dan teratur', 'Kafei/Bar area is clean and organized'),
  ('OPENING_BOH', 'OPN_BOH_014', 'AC/Exhaust kondisi baik dan prima', 'Air conditioning/exhaust system is in good condition'),
  ('OPENING_BOH', 'OPN_BOH_015', 'Lampu baik dan prima', 'Lights are in good condition'),
  ('OPENING_BOH', 'OPN_BOH_016', 'Seluruh Mesin baik dan prima (RO filter, mesin es, Meat Slicer,etc)', 'All machines are in good condition (RO filter, ice machine, meat slicer, etc.)'),
  ('OPENING_BOH', 'OPN_BOH_017', 'Seluruh perlengkapan elektronik (CCTV, TV, tab & komputer) baik dan prima', 'All electronic equipment (CCTV, TV, tablets, and computers) is in good condition'),
  ('OPENING_BOH', 'OPN_BOH_018', 'Seluruh kulkas baik dan prima', 'All refrigerators are in good condition'),
  ('OPENING_BOH', 'OPN_BOH_019', 'Grease Trap bersih wajar / terawat', 'Grease trap is reasonably clean and well maintained'),
  ('OPENING_BOH', 'OPN_BOH_020', 'Gorong-gorong bersih wajar dan terawat', 'Gutters/drains are reasonably clean and well maintained'),
  ('OPENING_BOH', 'OPN_BOH_021', 'Seluruh wastafel berfungsi baik', 'All sinks are functioning properly'),
  ('OPENING_BOH', 'OPN_BOH_022', 'Seluruh lemari penyimpanan tersusun baik, rapih dan aman', 'All storage cabinets are well organized, neat, and safe'),
  ('OPENING_BOH', 'OPN_BOH_023', 'Rak stock bahan baku kering tersusun baik, rapih dan aman (Dry Storage Suplies dan bahan baku)', 'Dry-stock racks are well organized, neat, and safe (dry-storage supplies and ingredients)'),
  ('OPENING_BOH', 'OPN_BOH_024', 'Seluruh kulkas penyimpanan tersusun baik, rapih dan aman', 'All storage refrigerators are well organized, neat, and safe'),
  ('OPENING_BOH', 'OPN_BOH_025', 'Perlengkapan masak kondisi baik dan prima', 'Cooking equipment is in good condition'),
  ('OPENING_BOH', 'OPN_BOH_026', 'Seluruh kompor berfungsi dgn baik', 'All stoves are functioning properly'),
  ('OPENING_BOH', 'OPN_BOH_027', 'Bell Dapur bersih dan berfungsi dgn baik', 'Kitchen bell is clean and functioning properly'),
  ('OPENING_BOH', 'OPN_BOH_028', 'Perlengkapan saji (dari piring, mangkok, gelas, teko sampai nampan saji, dsb) dalam kondisi prima dan bersih', 'Serving ware (plates, bowls, glasses, teapots, serving trays, etc.) is clean and in good condition'),
  ('OPENING_BOH', 'OPN_BOH_029', 'Check All APAR Pastikan kondisi Baik dan Prima', 'All fire extinguishers have been checked and are in good condition'),
  ('OPENING_BOH', 'OPN_BOH_030', 'Tong sampah bersih dan terpasang kantong sampah (tdk mengeluarkan bau)', 'Trash bins are clean, lined, and odor-free'),
  ('OPENING_BOH', 'OPN_BOH_031', 'Bak Control pembuangan utama Bersih', 'Main waste-control basin is clean'),
  ('OPENING_BOH', 'OPN_BOH_032', 'Lorong dan Loker karyawan bersih dan rapih', 'Staff corridor and lockers are clean and neat'),
  ('OPENING_BOH', 'OPN_BOH_033', 'Toilet Karyawan Bersih dan Rapih', 'Staff restroom is clean and neat'),
  ('CLOSING_FOH', 'CLS_FOH_001', 'Lantai Bersih', 'Floor is clean'),
  ('CLOSING_FOH', 'CLS_FOH_002', 'Meja Bersih', 'Tables are clean'),
  ('CLOSING_FOH', 'CLS_FOH_003', 'Kursi Bersih', 'Chairs are clean'),
  ('CLOSING_FOH', 'CLS_FOH_004', 'Perlengkapan Kerja Bersih', 'Work equipment is clean'),
  ('CLOSING_FOH', 'CLS_FOH_005', 'Sauce Station Bersih (Ice Crushed sudah diangkat)', 'Sauce station is clean (crushed ice has been removed)'),
  ('CLOSING_FOH', 'CLS_FOH_006', 'Condiment sudah tersimpan dengan baik', 'Condiments have been stored properly'),
  ('CLOSING_FOH', 'CLS_FOH_007', 'Toilet sudah bersih', 'Restroom has been cleaned'),
  ('CLOSING_FOH', 'CLS_FOH_008', 'Tidak ada kotoran hama / hama di seluruh area', 'There are no pest droppings or pests in any area'),
  ('CLOSING_FOH', 'CLS_FOH_009', 'Tidak ada barang asing yg terlihat oleh tamu', 'No foreign objects are visible to guests'),
  ('CLOSING_FOH', 'CLS_FOH_010', 'Seluruh sampah sudah ditaruh di tempat pembuangan', 'All waste has been taken to the designated disposal area'),
  ('CLOSING_FOH', 'CLS_FOH_011', 'Seluruh tempat sampah sudah bersih dan terlapisi dengan plastik yang baru dan bersih', 'All trash bins are clean and lined with new, clean plastic liners'),
  ('CLOSING_FOH', 'CLS_FOH_012', 'Pintu Outlet telah terkunci dengan baik', 'Outlet door is securely locked'),
  ('CLOSING_BOH', 'CLS_BOH_001', 'Seluruh meja bersih', 'All tables are clean'),
  ('CLOSING_BOH', 'CLS_BOH_002', 'Seluruh lantai bersih', 'All floors are clean'),
  ('CLOSING_BOH', 'CLS_BOH_003', 'Seluruh peralatan bersih dan tersimpan tertutup pada tempatnya', 'All equipment is clean, covered, and stored in its designated place'),
  ('CLOSING_BOH', 'CLS_BOH_004', 'Seluruh mesin bersih dan tersimpan tertutup pada tempatnya', 'All machines are clean, covered, and stored in their designated places'),
  ('CLOSING_BOH', 'CLS_BOH_005', 'Grease Trap bersih', 'The grease trap is clean'),
  ('CLOSING_BOH', 'CLS_BOH_006', 'Seluruh sampah sudah ditaruh di tempat pembuangan', 'All waste has been taken to the designated disposal area'),
  ('CLOSING_BOH', 'CLS_BOH_007', 'Seluruh tempat sampah sudah bersih dan terlapisi dengan plastik yang baru dan bersih', 'All trash bins are clean and lined with new, clean plastic liners'),
  ('CLOSING_BOH', 'CLS_BOH_008', 'Gutter/Gorong-Gorong bersih', 'Gutters and drains are clean'),
  ('CLOSING_BOH', 'CLS_BOH_009', 'Seluruh stock basah disimpan dgn suhu tepat serta higienis dan tertutup (diberi label nama dan tgl)', 'All wet stock is stored at the correct temperature, hygienically and covered, with item-name and date labels'),
  ('CLOSING_BOH', 'CLS_BOH_010', 'Suhu Chiller berada di antara 1-4°C', 'Chiller temperature is between 1°C and 4°C'),
  ('CLOSING_BOH', 'CLS_BOH_011', 'Suhu Freezer berada di -18°C atau lebih rendah', 'Freezer temperature is -18°C or lower'),
  ('CLOSING_BOH', 'CLS_BOH_012', 'Pintu chiller, freezer dan gudang tertutup & terkunci', 'Chiller, freezer, and storage-room doors are closed and locked'),
  ('CLOSING_BOH', 'CLS_BOH_013', 'Fryer & oven sudah dingin, soupwarmer & ricecooker bersih', 'The fryer and oven have cooled down; the soup warmer and rice cooker are clean'),
  ('CLOSING_BOH', 'CLS_BOH_014', 'Kompor BOH dalam kondisi aman seluruhnya', 'All BOH stoves are in a safe condition'),
  ('CLOSING_BOH', 'CLS_BOH_015', 'Kondisi gas dan kompor BOH sudah dalam keadaan mati (pipa gas sentral)', 'BOH gas and stoves are switched off (central gas line)'),
  ('CLOSING_BOH', 'CLS_BOH_016', 'Fixer & area sudut dinding, sogemerner & recooker bersih', 'Fixer, wall-corner areas, sogemerner, and recooker are clean'),
  ('CLOSING_BOH', 'CLS_BOH_017', 'Seluruh lampu telah dipadamkan', 'All lights have been switched off'),
  ('CLOSING_BOH', 'CLS_BOH_018', 'Pest Trap sudah diperiksa', 'Pest traps have been checked'),
  ('CLOSING_BOH', 'CLS_BOH_019', 'Tidak ada kotoran hama / hama di serluruh area', 'There are no pest droppings or pests in any area'),
  ('CLOSING_BOH', 'CLS_BOH_020', 'Tidak ada barang asing yg terlihat oleh tamu', 'No foreign objects are visible to guests'),
  ('CLOSING_BOH', 'CLS_BOH_021', 'Outlet sudah terkunci dengan baik', 'The outlet is securely locked');


create temporary table o3k_translation_targets (
  form_code text primary key,
  form_version_id uuid not null unique,
  expected_questions integer not null
) on commit drop;

insert into o3k_translation_targets (
  form_code,
  form_version_id,
  expected_questions
)
select
  upper(f.code),
  fv.id,
  case upper(f.code)
    when 'OPENING_FOH' then 59
    when 'OPENING_BOH' then 33
    when 'CLOSING_FOH' then 12
    when 'CLOSING_BOH' then 21
  end
from public.forms f
join public.form_versions fv
  on fv.form_id = f.id
where upper(f.code) in (
  'OPENING_FOH',
  'OPENING_BOH',
  'CLOSING_FOH',
  'CLOSING_BOH'
)
  and f.operational_scope = 'restaurant'
  and fv.status = 'draft'
  and fv.notes =
    'O3K all-photo policy: every operational question requires photo evidence.';


-- ============================================================
-- PRE-FLIGHT
-- ============================================================

do $$
declare
  v_bad text;
begin
  if (select count(*) from o3k_translation_targets) <> 4 then
    raise exception
      'O3K-A2 STOP: expected exactly 4 O3K all-photo draft versions.';
  end if;

  if (select count(*) from o3k_translation_seed) <> 125 then
    raise exception
      'O3K-A2 STOP: bilingual seed must contain exactly 125 questions.';
  end if;

  select string_agg(
    t.form_code || ':' || t.question_code,
    ', ' order by t.form_code, t.question_code
  )
  into v_bad
  from o3k_translation_seed t
  left join o3k_translation_targets target
    on target.form_code = t.form_code
  left join public.form_version_sections fvs
    on fvs.form_version_id = target.form_version_id
  left join public.questions q
    on q.version_section_id = fvs.id
   and q.code = t.question_code
   and q.is_active = true
  where q.id is null;

  if v_bad is not null then
    raise exception
      'O3K-A2 STOP: question code missing from target draft: %.',
      v_bad;
  end if;

  if exists (
    select 1
    from o3k_translation_targets target
    where (
      select count(*)
      from public.questions q
      join public.form_version_sections fvs
        on fvs.id = q.version_section_id
      where fvs.form_version_id = target.form_version_id
        and q.is_active = true
    ) <> target.expected_questions
  ) then
    raise exception
      'O3K-A2 STOP: target draft question count differs from expected.';
  end if;
end;
$$;


-- ============================================================
-- SECTION TRANSLATIONS
-- ============================================================

create temporary table o3k_section_translation_seed (
  form_code text not null,
  locale text not null,
  display_name text not null,
  description text null,
  primary key (form_code, locale)
) on commit drop;

insert into o3k_section_translation_seed values
  ('OPENING_FOH', 'en',    'Front of House', 'Opening FOH operational checklist.'),
  ('OPENING_FOH', 'id-ID', 'Front of House', 'Checklist operasional pembukaan FOH.'),
  ('OPENING_BOH', 'en',    'BOH / Kitchen',  'Opening BOH operational checklist.'),
  ('OPENING_BOH', 'id-ID', 'BOH / Dapur',    'Checklist operasional pembukaan BOH / Dapur.'),
  ('CLOSING_FOH', 'en',    'Front of House', 'Closing FOH operational checklist.'),
  ('CLOSING_FOH', 'id-ID', 'Front of House', 'Checklist operasional penutupan FOH.'),
  ('CLOSING_BOH', 'en',    'BOH / Kitchen',  'Closing BOH operational checklist.'),
  ('CLOSING_BOH', 'id-ID', 'BOH / Dapur',    'Checklist operasional penutupan BOH / Dapur.');

insert into public.form_version_section_translations (
  version_section_id,
  locale,
  display_name,
  description
)
select
  fvs.id,
  seed.locale,
  seed.display_name,
  seed.description
from o3k_section_translation_seed seed
join o3k_translation_targets target
  on target.form_code = seed.form_code
join public.form_version_sections fvs
  on fvs.form_version_id = target.form_version_id
on conflict (version_section_id, locale)
do update set
  display_name = excluded.display_name,
  description = excluded.description;


-- ============================================================
-- OPENING FOH GROUP TRANSLATIONS
-- ============================================================

create temporary table o3k_group_translation_seed (
  group_code text not null,
  locale text not null,
  display_name text not null,
  description text null,
  primary key (group_code, locale)
) on commit drop;

insert into o3k_group_translation_seed values
  ('PARKING_AREA', 'en',    'Parking Area',    null),
  ('PARKING_AREA', 'id-ID', 'Area Parkir',     null),
  ('MAIN_FOH',     'en',    'Front of House',  null),
  ('MAIN_FOH',     'id-ID', 'Front of House',  null),
  ('ROOMS',        'en',    'Rooms',           null),
  ('ROOMS',        'id-ID', 'Ruangan',         null),
  ('OTHERS',       'en',    'Others',          null),
  ('OTHERS',       'id-ID', 'Lainnya',         null),
  ('PLAYGROUND',   'en',    'Playground',      null),
  ('PLAYGROUND',   'id-ID', 'Area Bermain',    null),
  ('TOILET',       'en',    'Restroom',        null),
  ('TOILET',       'id-ID', 'Toilet',          null);

insert into public.question_group_translations (
  question_group_id,
  locale,
  display_name,
  description
)
select
  qg.id,
  seed.locale,
  seed.display_name,
  seed.description
from o3k_group_translation_seed seed
join o3k_translation_targets target
  on target.form_code = 'OPENING_FOH'
join public.question_groups qg
  on qg.version_section_id in (
    select fvs.id
    from public.form_version_sections fvs
    where fvs.form_version_id = target.form_version_id
  )
 and qg.code = seed.group_code
 and qg.is_active = true
on conflict (question_group_id, locale)
do update set
  display_name = excluded.display_name,
  description = excluded.description;


-- ============================================================
-- QUESTION TRANSLATIONS — ID + EN
-- ============================================================

insert into public.question_translations (
  question_id,
  locale,
  question_text,
  help_text
)
select
  q.id,
  locale_row.locale,
  case locale_row.locale
    when 'id-ID' then seed.id_text
    when 'en' then seed.en_text
  end,
  null
from o3k_translation_seed seed
join o3k_translation_targets target
  on target.form_code = seed.form_code
join public.form_version_sections fvs
  on fvs.form_version_id = target.form_version_id
join public.questions q
  on q.version_section_id = fvs.id
 and q.code = seed.question_code
 and q.is_active = true
cross join (
  values ('en'::text), ('id-ID'::text)
) locale_row(locale)
on conflict (question_id, locale)
do update set
  question_text = excluded.question_text,
  help_text = excluded.help_text;


-- ============================================================
-- CQ DEFAULT LOCALE
-- ============================================================

update public.outlets o
set
  default_locale = 'id-ID',
  updated_at = now()
where upper(o.code) in (
  'BDG',
  'GS',
  'HT',
  'MOI',
  'PIM',
  'PL',
  'PP',
  'SP',
  'TBZ'
)
  and o.is_active = true;


-- ============================================================
-- POST-FLIGHT
-- ============================================================

do $$
declare
  v_question_translation_count integer;
  v_section_translation_count integer;
  v_group_translation_count integer;
  v_cq_locale_count integer;
begin
  select count(*)
  into v_question_translation_count
  from public.question_translations qt
  join public.questions q
    on q.id = qt.question_id
  join public.form_version_sections fvs
    on fvs.id = q.version_section_id
  join o3k_translation_targets target
    on target.form_version_id = fvs.form_version_id
  where q.is_active = true
    and qt.locale in ('en', 'id-ID');

  if v_question_translation_count <> 250 then
    raise exception
      'O3K-A2 STOP: expected 250 question translations, found %.',
      v_question_translation_count;
  end if;

  select count(*)
  into v_section_translation_count
  from public.form_version_section_translations t
  join public.form_version_sections fvs
    on fvs.id = t.version_section_id
  join o3k_translation_targets target
    on target.form_version_id = fvs.form_version_id
  where t.locale in ('en', 'id-ID');

  if v_section_translation_count <> 8 then
    raise exception
      'O3K-A2 STOP: expected 8 section translations, found %.',
      v_section_translation_count;
  end if;

  select count(*)
  into v_group_translation_count
  from public.question_group_translations t
  join public.question_groups qg
    on qg.id = t.question_group_id
  join public.form_version_sections fvs
    on fvs.id = qg.version_section_id
  join o3k_translation_targets target
    on target.form_version_id = fvs.form_version_id
  where target.form_code = 'OPENING_FOH'
    and qg.is_active = true
    and t.locale in ('en', 'id-ID');

  if v_group_translation_count <> 12 then
    raise exception
      'O3K-A2 STOP: expected 12 Opening FOH group translations, found %.',
      v_group_translation_count;
  end if;

  select count(*)
  into v_cq_locale_count
  from public.outlets o
  where upper(o.code) in (
    'BDG','GS','HT','MOI','PIM','PL','PP','SP','TBZ'
  )
    and o.is_active = true
    and o.default_locale = 'id-ID';

  if v_cq_locale_count <> 9 then
    raise exception
      'O3K-A2 STOP: expected 9 CQ outlets with id-ID default locale, found %.',
      v_cq_locale_count;
  end if;

  if exists (
    select 1
    from o3k_translation_targets target
    join public.form_versions fv
      on fv.id = target.form_version_id
    where fv.status <> 'draft'
  ) then
    raise exception
      'O3K-A2 STOP: target version is no longer draft.';
  end if;
end;
$$;

commit;
