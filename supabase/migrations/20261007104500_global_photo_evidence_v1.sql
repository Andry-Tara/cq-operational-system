begin;

-- ============================================================
-- GLOBAL PHOTO EVIDENCE V1
--
-- Outlet geofence configuration +
-- immutable evidence metadata snapshot.
-- ============================================================

alter table public.outlets
  add column if not exists latitude double precision;

alter table public.outlets
  add column if not exists longitude double precision;

alter table public.outlets
  add column if not exists photo_geofence_radius_m integer
    not null
    default 150;

alter table public.outlets
  add column if not exists photo_location_accuracy_threshold_m integer
    not null
    default 100;


alter table public.outlets
  drop constraint if exists outlets_latitude_chk;

alter table public.outlets
  add constraint outlets_latitude_chk
  check (
    latitude is null
    or latitude between -90 and 90
  );


alter table public.outlets
  drop constraint if exists outlets_longitude_chk;

alter table public.outlets
  add constraint outlets_longitude_chk
  check (
    longitude is null
    or longitude between -180 and 180
  );


alter table public.outlets
  drop constraint if exists outlets_photo_geofence_radius_chk;

alter table public.outlets
  add constraint outlets_photo_geofence_radius_chk
  check (
    photo_geofence_radius_m between 10 and 5000
  );


alter table public.outlets
  drop constraint if exists outlets_photo_location_accuracy_chk;

alter table public.outlets
  add constraint outlets_photo_location_accuracy_chk
  check (
    photo_location_accuracy_threshold_m between 10 and 2000
  );


-- ============================================================
-- QA FOOD EVIDENCE METADATA
-- ============================================================

alter table public.qa_food_evidence
  add column if not exists captured_at timestamptz;

alter table public.qa_food_evidence
  add column if not exists uploaded_at timestamptz;

alter table public.qa_food_evidence
  add column if not exists capture_source text;

alter table public.qa_food_evidence
  add column if not exists latitude double precision;

alter table public.qa_food_evidence
  add column if not exists longitude double precision;

alter table public.qa_food_evidence
  add column if not exists location_accuracy_m double precision;

alter table public.qa_food_evidence
  add column if not exists outlet_latitude double precision;

alter table public.qa_food_evidence
  add column if not exists outlet_longitude double precision;

alter table public.qa_food_evidence
  add column if not exists distance_from_outlet_m double precision;

alter table public.qa_food_evidence
  add column if not exists location_status text;

alter table public.qa_food_evidence
  add column if not exists outlet_timezone text;

alter table public.qa_food_evidence
  add column if not exists watermark_version text;


update public.qa_food_evidence
set
  uploaded_at =
    coalesce(
      uploaded_at,
      created_at,
      now()
    ),

  capture_source =
    coalesce(
      capture_source,
      'GALLERY'
    ),

  location_status =
    coalesce(
      location_status,
      'GALLERY'
    );


alter table public.qa_food_evidence
  alter column uploaded_at
  set default now();

alter table public.qa_food_evidence
  alter column uploaded_at
  set not null;

alter table public.qa_food_evidence
  alter column capture_source
  set default 'GALLERY';

alter table public.qa_food_evidence
  alter column capture_source
  set not null;

alter table public.qa_food_evidence
  alter column location_status
  set default 'GALLERY';

alter table public.qa_food_evidence
  alter column location_status
  set not null;


alter table public.qa_food_evidence
  drop constraint if exists qa_food_evidence_capture_source_chk;

alter table public.qa_food_evidence
  add constraint qa_food_evidence_capture_source_chk
  check (
    capture_source in (
      'CAMERA',
      'GALLERY'
    )
  );


alter table public.qa_food_evidence
  drop constraint if exists qa_food_evidence_location_status_chk;

alter table public.qa_food_evidence
  add constraint qa_food_evidence_location_status_chk
  check (
    location_status in (
      'VERIFIED',
      'OUTSIDE_AREA',
      'LOW_ACCURACY',
      'LOCATION_UNAVAILABLE',
      'GALLERY'
    )
  );


alter table public.qa_food_evidence
  drop constraint if exists qa_food_evidence_location_accuracy_chk;

alter table public.qa_food_evidence
  add constraint qa_food_evidence_location_accuracy_chk
  check (
    location_accuracy_m is null
    or location_accuracy_m >= 0
  );


alter table public.qa_food_evidence
  drop constraint if exists qa_food_evidence_distance_chk;

alter table public.qa_food_evidence
  add constraint qa_food_evidence_distance_chk
  check (
    distance_from_outlet_m is null
    or distance_from_outlet_m >= 0
  );


commit;
