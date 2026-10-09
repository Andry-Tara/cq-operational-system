-- ============================================================
-- AUDIT FINDING PHOTO EVIDENCE V1
-- Reuse Global Photo Evidence model for Outlet Audit findings.
-- ============================================================

begin;

alter table public.audit_finding_photos
  add column if not exists captured_at timestamptz,
  add column if not exists uploaded_at timestamptz not null default now(),
  add column if not exists capture_source text not null default 'GALLERY',
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists location_accuracy_m numeric(10,2),
  add column if not exists outlet_latitude double precision,
  add column if not exists outlet_longitude double precision,
  add column if not exists distance_from_outlet_m numeric(10,2),
  add column if not exists location_status text not null default 'GALLERY',
  add column if not exists outlet_timezone text,
  add column if not exists watermark_version text;

update public.audit_finding_photos
set
  uploaded_at = coalesce(uploaded_at, created_at),
  capture_source = coalesce(capture_source, 'GALLERY'),
  location_status = coalesce(location_status, 'GALLERY')
where
  uploaded_at is null
  or capture_source is null
  or location_status is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname =
      'audit_finding_photos_capture_source_check'
  ) then
    alter table public.audit_finding_photos
      add constraint audit_finding_photos_capture_source_check
      check (
        capture_source in (
          'CAMERA',
          'GALLERY'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'audit_finding_photos_location_status_check'
  ) then
    alter table public.audit_finding_photos
      add constraint audit_finding_photos_location_status_check
      check (
        location_status in (
          'VERIFIED',
          'OUTSIDE_AREA',
          'LOW_ACCURACY',
          'LOCATION_UNAVAILABLE',
          'GALLERY'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'audit_finding_photos_latitude_check'
  ) then
    alter table public.audit_finding_photos
      add constraint audit_finding_photos_latitude_check
      check (
        latitude is null
        or latitude between -90 and 90
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname =
      'audit_finding_photos_longitude_check'
  ) then
    alter table public.audit_finding_photos
      add constraint audit_finding_photos_longitude_check
      check (
        longitude is null
        or longitude between -180 and 180
      );
  end if;
end;
$$;

commit;
