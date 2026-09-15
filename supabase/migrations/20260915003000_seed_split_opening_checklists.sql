begin;

create temporary table split_opening_section_seed (
  form_code text primary key,
  section_code text not null,
  section_name text not null,
  description text null,
  sort_order integer not null
) on commit drop;

insert into split_opening_section_seed values
  ('OPENING_FOH', 'FOH', 'FOH', 'Opening FOH operational checklist.', 10),
  ('OPENING_BOH', 'BOH', 'BOH / Kitchen', 'Opening BOH operational checklist.', 10);

create temporary table opening_foh_group_seed (
  code text primary key,
  name text not null,
  sort_order integer not null
) on commit drop;

insert into opening_foh_group_seed values
  ('PARKING_AREA', 'PARKING AREA', 10),
  ('MAIN_FOH', 'FOH', 20),
  ('ROOMS', 'ROOMS', 30),
  ('OTHERS', 'OTHERS', 40),
  ('PLAYGROUND', 'PLAYGROUND', 50),
  ('TOILET', 'TOILET', 60);

create temporary table split_opening_question_seed (
  form_code text not null,
  section_code text not null,
  group_code text null,
  code text not null,
  question_text text not null,
  question_type text not null,
  is_required boolean not null,
  sort_order integer not null,
  evidence_mode text not null,
  applicability_type text not null,
  facility_key text null,
  primary key (form_code, code)
) on commit drop;

insert into split_opening_question_seed values
  ('OPENING_FOH', 'FOH', 'PARKING_AREA', 'OPN_FOH_001', 'Signage prima', 'yes_no', true, 10, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'PARKING_AREA', 'OPN_FOH_002', 'Halaman parkir bersih', 'yes_no', true, 20, 'on_issue', 'facility', 'PARKING'),
  ('OPENING_FOH', 'FOH', 'PARKING_AREA', 'OPN_FOH_003', 'Genset berfungsi', 'yes_no', true, 30, 'on_issue', 'facility', 'GENSET'),
  ('OPENING_FOH', 'FOH', 'PARKING_AREA', 'OPN_FOH_004', 'Gerbang parkir terbuka', 'yes_no', true, 40, 'on_issue', 'facility', 'PARKING'),
  ('OPENING_FOH', 'FOH', 'PARKING_AREA', 'OPN_FOH_005', 'Pembuangan rapih & tidak berbau', 'yes_no', true, 50, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'PARKING_AREA', 'OPN_FOH_006', 'Lobby bersih terawat', 'yes_no', true, 60, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'PARKING_AREA', 'OPN_FOH_007', 'Area Vallet bersih terawat', 'yes_no', true, 70, 'on_issue', 'facility', 'VALET'),
  ('OPENING_FOH', 'FOH', 'PARKING_AREA', 'OPN_FOH_008', 'Tanaman rapih & terawat', 'yes_no', true, 80, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_009', 'Lantai bersih', 'yes_no', true, 90, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_010', 'Lampu prima & terawat', 'yes_no', true, 100, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_011', 'AC prima & berfungsi baik', 'yes_no', true, 110, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_012', 'AC menyala sesuai dengan standarisasi (mode, suhu, hembusan)', 'yes_no', true, 120, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_013', 'Seluruh CCTV berfungsi dgn baik', 'yes_no', true, 130, 'on_issue', 'facility', 'CCTV'),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_014', 'Speaker lagu berfungsi dgn baik', 'yes_no', true, 140, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_015', 'Lagu disetel sesuai standarisasi CQ', 'yes_no', true, 150, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_016', 'Area ruang tunggu terawat', 'yes_no', true, 160, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_017', 'Furniture ruang tunggu terawat', 'yes_no', true, 170, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_018', 'Area host bersih & terawat', 'yes_no', true, 180, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_019', 'Area tangga bersih & terawat', 'yes_no', true, 190, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_020', 'Mesin kasir (incl. printer komputer dsb) berfungsi baik', 'yes_no', true, 200, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_021', 'EDC berfungsi baik', 'yes_no', true, 210, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_022', 'Area sudut, langit2, pajangan/lukisan & sejenisnya bersih', 'yes_no', true, 220, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_023', 'Pembatas ruangan bersih terawat', 'yes_no', true, 230, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_024', 'Seluruh meja bersih & terawat (incl. kolong meja)', 'yes_no', true, 240, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_025', 'Seluruh kursi bersih & terawat (incl. kolong kursi)', 'yes_no', true, 250, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_026', 'Perlengkapan di atas meja tertata sesuai standarisasi CQ', 'yes_no', true, 260, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_027', 'Kondisi tent card bersih & terawat', 'yes_no', true, 270, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_028', 'Seluruh Tab berfungsi baik & bersih terawat Include Cover', 'yes_no', true, 280, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_029', 'Seluruh kompor berfungsi dgn baik', 'yes_no', true, 290, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_030', 'Seluruh bell berfungsi dgn baik', 'yes_no', true, 300, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_031', 'Sauce station bersih dan terawat', 'yes_no', true, 310, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_032', 'Ice Crushed sudah terisi pada Sauce Station', 'yes_no', true, 320, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_033', 'Wadah Sauce station sudah terisi (sesuai dengan tingkat kepenuhan, jenis dan pengaturan hari) dan tertutup dengan rapih', 'yes_no', true, 330, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_034', 'Mangkok Sauce yang dipakai sesuai standarisasi', 'yes_no', true, 340, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'MAIN_FOH', 'OPN_FOH_035', 'Trolley bersih & terawat', 'yes_no', true, 350, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'ROOMS', 'OPN_FOH_036', 'Seluruh tampilan materi iklan pada TV baik', 'yes_no', true, 360, 'on_issue', 'facility', 'VIP_ROOM'),
  ('OPENING_FOH', 'FOH', 'ROOMS', 'OPN_FOH_037', 'TV berfungsi baik & bersih terawat', 'yes_no', true, 370, 'on_issue', 'facility', 'VIP_ROOM'),
  ('OPENING_FOH', 'FOH', 'ROOMS', 'OPN_FOH_038', 'Peralatan karaoke bersih & terawat serta berfungsi baik (incl. sound system, mic, remote, speaker)', 'yes_no', true, 380, 'on_issue', 'facility', 'KARAOKE'),
  ('OPENING_FOH', 'FOH', 'ROOMS', 'OPN_FOH_039', 'Air purifier berfungsi baik (incl. kelayakan saringan)', 'yes_no', true, 390, 'on_issue', 'facility', 'VIP_ROOM'),
  ('OPENING_FOH', 'FOH', 'OTHERS', 'OPN_FOH_040', 'Seluruh kabel tersusun rapih di area FOH', 'yes_no', true, 400, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'OTHERS', 'OPN_FOH_041', 'Tidak ada peralatan FOH yg berantakan terlihat tamu', 'yes_no', true, 410, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'OTHERS', 'OPN_FOH_042', 'Tidak ada pajangan yg tidak sesuai dengan standarisasi CQ', 'yes_no', true, 420, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'OTHERS', 'OPN_FOH_043', 'Seluruh HT berfungsi baik & bersih terawat', 'yes_no', true, 430, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'OTHERS', 'OPN_FOH_044', 'Tampilan FOH/HP sesuai standarisasi CQ (Kerapihan seragam, Hair do, make up, non accesories, sepatu hitam)', 'yes_no', true, 440, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'OTHERS', 'OPN_FOH_045', 'Perlengkapan kerja host/HP (HP, Buku reservasi, pena, HT, dsb)', 'yes_no', true, 450, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'OTHERS', 'OPN_FOH_046', 'Perlengkapan kerja server/HP (Tab, kertas, pena, HT, dsb)', 'yes_no', true, 460, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'OTHERS', 'OPN_FOH_047', 'Perlengkapan kerja housekeeping/Toilet Attendance lengkap (seragam, celemek, perlengkapan pembersih dll)', 'yes_no', true, 470, 'on_issue', 'global', null),
  ('OPENING_FOH', 'FOH', 'PLAYGROUND', 'OPN_FOH_048', 'Lantai bersih', 'yes_no', true, 480, 'on_issue', 'facility', 'PLAYGROUND'),
  ('OPENING_FOH', 'FOH', 'PLAYGROUND', 'OPN_FOH_049', 'Mainan bersih & terawat', 'yes_no', true, 490, 'on_issue', 'facility', 'PLAYGROUND'),
  ('OPENING_FOH', 'FOH', 'PLAYGROUND', 'OPN_FOH_050', 'Mainan tersusun rapih', 'yes_no', true, 500, 'on_issue', 'facility', 'PLAYGROUND'),
  ('OPENING_FOH', 'FOH', 'TOILET', 'OPN_FOH_051', 'Toilet bersih (lantai, cermin, perabotan, pintu & gagang)', 'yes_no', true, 510, 'on_issue', 'facility', 'GUEST_TOILET'),
  ('OPENING_FOH', 'FOH', 'TOILET', 'OPN_FOH_052', 'Tong sampah bersih dan terpasang kantong sampah', 'yes_no', true, 520, 'on_issue', 'facility', 'GUEST_TOILET'),
  ('OPENING_FOH', 'FOH', 'TOILET', 'OPN_FOH_053', 'Closet bersih', 'yes_no', true, 530, 'on_issue', 'facility', 'GUEST_TOILET'),
  ('OPENING_FOH', 'FOH', 'TOILET', 'OPN_FOH_054', 'Wastafel bersih', 'yes_no', true, 540, 'on_issue', 'facility', 'GUEST_TOILET'),
  ('OPENING_FOH', 'FOH', 'TOILET', 'OPN_FOH_055', 'Toilet berfungsi baik (Flush, jet washer, keran wastafel)', 'yes_no', true, 550, 'on_issue', 'facility', 'GUEST_TOILET'),
  ('OPENING_FOH', 'FOH', 'TOILET', 'OPN_FOH_056', 'Sabun terisi', 'yes_no', true, 560, 'on_issue', 'facility', 'GUEST_TOILET'),
  ('OPENING_FOH', 'FOH', 'TOILET', 'OPN_FOH_057', 'Tissue toilet terisi', 'yes_no', true, 570, 'on_issue', 'facility', 'GUEST_TOILET'),
  ('OPENING_FOH', 'FOH', 'TOILET', 'OPN_FOH_058', 'Pewangi toilet sesuai standarisasi CQ', 'yes_no', true, 580, 'on_issue', 'facility', 'GUEST_TOILET'),
  ('OPENING_FOH', 'FOH', 'TOILET', 'OPN_FOH_059', 'Tidak ada peralatan housekeeping yg berantakan terlihat tamu', 'yes_no', true, 590, 'on_issue', 'facility', 'GUEST_TOILET'),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_001', 'Kondisi seluruh lantai bersih incl keset/anti slip (tdk licin,tdk becek/basah)', 'yes_no', true, 10, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_002', 'Area kerja BOH per section bersih (meja kerja, peralatan dan lantai)', 'yes_no', true, 20, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_003', 'Seluruh Lap yang dipakai bersih wajar dan kondisi prima', 'yes_no', true, 30, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_004', 'Tools & Equipment per section teratur (setiap barang pada tmptnya)', 'yes_no', true, 40, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_005', 'Seluruh perlengkapan kerja per section lengkap dan berfungsi baik guna mendukung kegiatan operasional', 'yes_no', true, 50, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_006', 'Bahan baku basah segar', 'yes_no', true, 60, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_007', 'Bahan baku kering masih on expiry', 'yes_no', true, 70, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_008', 'Barang setengah jadi masih segar dan layak saji', 'yes_no', true, 80, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_009', 'FIFO di setiap section terjadi', 'yes_no', true, 90, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_010', 'Tidak ada peralatan BOH yg berantakan terlihat tamu', 'yes_no', true, 100, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_011', 'Area Shao Kao terlihat bersih dan teratur', 'yes_no', true, 110, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_012', 'Panggangan Shao Kao bersih wajar / terawat', 'yes_no', true, 120, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_013', 'Area Kafei/Bar terlihat bersih dan teratur', 'yes_no', true, 130, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_014', 'AC/Exhaust kondisi baik dan prima', 'yes_no', true, 140, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_015', 'Lampu baik dan prima', 'yes_no', true, 150, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_016', 'Seluruh Mesin baik dan prima (RO filter, mesin es, Meat Slicer,etc)', 'yes_no', true, 160, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_017', 'Seluruh perlengkapan elektronik (CCTV, TV, tab & komputer) baik dan prima', 'yes_no', true, 170, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_018', 'Seluruh kulkas baik dan prima', 'yes_no', true, 180, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_019', 'Grease Trap bersih wajar / terawat', 'yes_no', true, 190, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_020', 'Gorong-gorong bersih wajar dan terawat', 'yes_no', true, 200, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_021', 'Seluruh wastafel berfungsi baik', 'yes_no', true, 210, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_022', 'Seluruh lemari penyimpanan tersusun baik, rapih dan aman', 'yes_no', true, 220, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_023', 'Rak stock bahan baku kering tersusun baik, rapih dan aman (Dry Storage Suplies dan bahan baku)', 'yes_no', true, 230, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_024', 'Seluruh kulkas penyimpanan tersusun baik, rapih dan aman', 'yes_no', true, 240, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_025', 'Perlengkapan masak kondisi baik dan prima', 'yes_no', true, 250, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_026', 'Seluruh kompor berfungsi dgn baik', 'yes_no', true, 260, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_027', 'Bell Dapur bersih dan berfungsi dgn baik', 'yes_no', true, 270, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_028', 'Perlengkapan saji (dari piring, mangkok, gelas, teko sampai nampan saji, dsb) dalam kondisi prima dan bersih', 'yes_no', true, 280, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_029', 'Check All APAR Pastikan kondisi Baik dan Prima', 'yes_no', true, 290, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_030', 'Tong sampah bersih dan terpasang kantong sampah (tdk mengeluarkan bau)', 'yes_no', true, 300, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_031', 'Bak Control pembuangan utama Bersih', 'yes_no', true, 310, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_032', 'Lorong dan Loker karyawan bersih dan rapih', 'yes_no', true, 320, 'on_issue', 'global', null),
  ('OPENING_BOH', 'BOH', null, 'OPN_BOH_033', 'Toilet Karyawan Bersih dan Rapih', 'yes_no', true, 330, 'on_issue', 'global', null);

do $$
begin
  if (select count(*) from split_opening_question_seed where form_code = 'OPENING_FOH') <> 59 then
    raise exception 'OPENING_FOH seed must contain exactly 59 questions.';
  end if;
  if (select count(*) from split_opening_question_seed where form_code = 'OPENING_BOH') <> 33 then
    raise exception 'OPENING_BOH seed must contain exactly 33 questions.';
  end if;
  if (select count(*) from opening_foh_group_seed) <> 6 then
    raise exception 'OPENING_FOH seed must contain exactly 6 groups.';
  end if;
  if (select count(*) from split_opening_question_seed where form_code = 'OPENING_FOH' and applicability_type = 'facility') <> 21 then
    raise exception 'OPENING_FOH seed must contain exactly 21 facility-dependent questions.';
  end if;
end;
$$;

do $$
declare
  v_missing text;
begin
  select string_agg(concat(f.organization_id, ':', f.code), ', ' order by f.organization_id, f.code)
  into v_missing
  from public.forms f
  where f.code in ('OPENING_FOH', 'OPENING_BOH')
    and f.operational_scope = 'restaurant'
    and not exists (
      select 1
      from public.form_versions fv
      where fv.form_id = f.id
        and fv.version_number = 1
        and fv.status = 'draft'
    );

  if v_missing is not null then
    raise exception 'Split Opening v1 DRAFT missing for: %', v_missing;
  end if;

  if exists (
    select 1
    from public.forms f
    join public.form_versions fv
      on fv.form_id = f.id
     and fv.version_number = 1
     and fv.status = 'draft'
    join public.form_version_sections fvs
      on fvs.form_version_id = fv.id
    where f.code in ('OPENING_FOH', 'OPENING_BOH')
      and f.operational_scope = 'restaurant'
  ) then
    raise exception 'Split Opening v1 DRAFT already contains section content. Seed stopped.';
  end if;
end;
$$;

do $$
declare
  v_missing text;
begin
  select string_agg(concat(org.organization_id, ':', seed.facility_key), ', ' order by org.organization_id, seed.facility_key)
  into v_missing
  from (
    select distinct organization_id
    from public.forms
    where code = 'OPENING_FOH'
      and operational_scope = 'restaurant'
  ) org
  cross join (
    select distinct facility_key
    from split_opening_question_seed
    where applicability_type = 'facility'
  ) seed
  where not exists (
    select 1
    from public.facility_definitions fd
    where fd.organization_id = org.organization_id
      and fd.code = seed.facility_key
      and fd.is_active = true
  );

  if v_missing is not null then
    raise exception 'Required facility definitions missing/inactive: %', v_missing;
  end if;
end;
$$;

insert into public.sections (
  form_id, code, name, description, is_active
)
select
  f.id, ss.section_code, ss.section_name, ss.description, true
from split_opening_section_seed ss
join public.forms f
  on f.code = ss.form_code
 and f.operational_scope = 'restaurant'
on conflict (form_id, code)
do update set
  name = excluded.name,
  description = excluded.description,
  is_active = true,
  updated_at = now();

insert into public.form_version_sections (
  form_version_id, section_id, display_name, description,
  sort_order, is_required, is_active
)
select
  fv.id, s.id, ss.section_name, ss.description,
  ss.sort_order, true, true
from split_opening_section_seed ss
join public.forms f
  on f.code = ss.form_code
 and f.operational_scope = 'restaurant'
join public.form_versions fv
  on fv.form_id = f.id
 and fv.version_number = 1
 and fv.status = 'draft'
join public.sections s
  on s.form_id = f.id
 and s.code = ss.section_code;

insert into public.question_groups (
  version_section_id, code, name, sort_order, is_active
)
select
  fvs.id, gs.code, gs.name, gs.sort_order, true
from public.forms f
join public.form_versions fv
  on fv.form_id = f.id
 and fv.version_number = 1
 and fv.status = 'draft'
join public.sections s
  on s.form_id = f.id
 and s.code = 'FOH'
join public.form_version_sections fvs
  on fvs.form_version_id = fv.id
 and fvs.section_id = s.id
cross join opening_foh_group_seed gs
where f.code = 'OPENING_FOH'
  and f.operational_scope = 'restaurant';

insert into public.questions (
  version_section_id, code, question_text, question_type,
  is_required, unit, min_value, max_value, config,
  sort_order, is_active, question_group_id
)
select
  fvs.id,
  qs.code,
  qs.question_text,
  qs.question_type,
  qs.is_required,
  null,
  null,
  null,
  jsonb_build_object(
    'source', 'FORM_OPERATIONAL_CQ_HANGTUAH',
    'evidence_mode', qs.evidence_mode,
    'applicability',
      case
        when qs.applicability_type = 'facility'
        then jsonb_build_object(
          'type', 'facility',
          'facility_key', qs.facility_key
        )
        else jsonb_build_object('type', 'global')
      end
  ),
  qs.sort_order,
  true,
  qg.id
from split_opening_question_seed qs
join public.forms f
  on f.code = qs.form_code
 and f.operational_scope = 'restaurant'
join public.form_versions fv
  on fv.form_id = f.id
 and fv.version_number = 1
 and fv.status = 'draft'
join public.sections s
  on s.form_id = f.id
 and s.code = qs.section_code
join public.form_version_sections fvs
  on fvs.form_version_id = fv.id
 and fvs.section_id = s.id
left join public.question_groups qg
  on qg.version_section_id = fvs.id
 and qg.code = qs.group_code;

insert into public.question_rules (
  question_id, rule_type, condition, action_config,
  sort_order, is_active
)
select
  q.id,
  r.rule_type,
  jsonb_build_object('operator', 'equals', 'value', false),
  '{}'::jsonb,
  r.sort_order,
  true
from public.questions q
join public.form_version_sections fvs
  on fvs.id = q.version_section_id
join public.form_versions fv
  on fv.id = fvs.form_version_id
join public.forms f
  on f.id = fv.form_id
cross join (
  values
    ('require_notes'::text, 10),
    ('flag_issue'::text, 30),
    ('require_corrective_action'::text, 40)
) r(rule_type, sort_order)
where f.code in ('OPENING_FOH', 'OPENING_BOH')
  and f.operational_scope = 'restaurant'
  and fv.version_number = 1
  and fv.status = 'draft';

do $$
declare
  v_target record;
  v_questions integer;
  v_groups integer;
  v_facility integer;
  v_on_issue integer;
  v_expected integer;
begin
  for v_target in
    select f.id, f.organization_id, f.code
    from public.forms f
    where f.code in ('OPENING_FOH', 'OPENING_BOH')
      and f.operational_scope = 'restaurant'
    order by f.organization_id, f.code
  loop
    v_expected := case when v_target.code = 'OPENING_FOH' then 59 else 33 end;

    select count(*) into v_questions
    from public.questions q
    join public.form_version_sections fvs on fvs.id = q.version_section_id
    join public.form_versions fv on fv.id = fvs.form_version_id
    where fv.form_id = v_target.id
      and fv.version_number = 1
      and fv.status = 'draft'
      and q.is_active = true;

    select count(*) into v_groups
    from public.question_groups qg
    join public.form_version_sections fvs on fvs.id = qg.version_section_id
    join public.form_versions fv on fv.id = fvs.form_version_id
    where fv.form_id = v_target.id
      and fv.version_number = 1
      and fv.status = 'draft'
      and qg.is_active = true;

    select count(*) into v_facility
    from public.questions q
    join public.form_version_sections fvs on fvs.id = q.version_section_id
    join public.form_versions fv on fv.id = fvs.form_version_id
    where fv.form_id = v_target.id
      and fv.version_number = 1
      and fv.status = 'draft'
      and q.config #>> '{applicability,type}' = 'facility';

    select count(*) into v_on_issue
    from public.questions q
    join public.form_version_sections fvs on fvs.id = q.version_section_id
    join public.form_versions fv on fv.id = fvs.form_version_id
    where fv.form_id = v_target.id
      and fv.version_number = 1
      and fv.status = 'draft'
      and q.config ->> 'evidence_mode' = 'on_issue';

    if v_questions <> v_expected then
      raise exception '% / % expected % questions, found %.',
        v_target.organization_id, v_target.code, v_expected, v_questions;
    end if;

    if v_on_issue <> v_expected then
      raise exception '% / % expected % on_issue questions, found %.',
        v_target.organization_id, v_target.code, v_expected, v_on_issue;
    end if;

    if v_target.code = 'OPENING_FOH' then
      if v_groups <> 6 then
        raise exception '% / OPENING_FOH expected 6 groups, found %.',
          v_target.organization_id, v_groups;
      end if;
      if v_facility <> 21 then
        raise exception '% / OPENING_FOH expected 21 facility questions, found %.',
          v_target.organization_id, v_facility;
      end if;
    else
      if v_groups <> 0 then
        raise exception '% / OPENING_BOH expected 0 source groups, found %.',
          v_target.organization_id, v_groups;
      end if;
      if v_facility <> 0 then
        raise exception '% / OPENING_BOH expected 0 facility questions, found %.',
          v_target.organization_id, v_facility;
      end if;
    end if;
  end loop;
end;
$$;

commit;
