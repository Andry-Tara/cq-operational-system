import {
  getCurrentDeviceLocation,
} from "./capture-location";

import {
  distanceMeters,
} from "./distance";

import {
  stampEvidencePhoto,
} from "./stamp-image";

import type {
  OutletPhotoContext,
  PhotoEvidenceMetadata,
  PhotoLocationStatus,
} from "./types";


function roundedDistance(
  value:
    number | null,
) {
  if (
    value == null
  ) {
    return null;
  }

  return Math.round(
    value,
  );
}


export async function prepareCameraEvidence({
  file,
  outlet,
  moduleLabel,
  subjectLabel,
}: {
  file: File;

  outlet:
    OutletPhotoContext;

  moduleLabel:
    string;

  subjectLabel:
    string;
}) {
  const capturedAt =
    new Date()
      .toISOString();

  const location =
    await getCurrentDeviceLocation();

  let status:
    PhotoLocationStatus =
    "LOCATION_UNAVAILABLE";

  let distance:
    number | null =
    null;

  let locationLine =
    "Location Unavailable";


  if (location) {
    const outletConfigured =
      Number.isFinite(
        outlet.latitude,
      ) &&
      Number.isFinite(
        outlet.longitude,
      );

    if (
      outletConfigured
    ) {
      distance =
        distanceMeters(
          location.latitude,
          location.longitude,
          Number(
            outlet.latitude,
          ),
          Number(
            outlet.longitude,
          ),
        );

      if (
        location.accuracyM >
        outlet
          .accuracyThresholdM
      ) {
        status =
          "LOW_ACCURACY";

        locationLine =
          `Location Accuracy Low · ±${Math.round(
            location.accuracyM,
          )} m`;
      } else if (
        distance >
        outlet
          .geofenceRadiusM
      ) {
        status =
          "OUTSIDE_AREA";

        locationLine =
          distance >=
          1000
            ? `Outside Outlet Area · ${(distance / 1000).toFixed(
                1,
              )} km`
            : `Outside Outlet Area · ${Math.round(
                distance,
              )} m`;
      } else {
        status =
          "VERIFIED";

        locationLine =
          `Location Verified · ${Math.round(
            distance,
          )} m · ±${Math.round(
            location.accuracyM,
          )} m`;
      }
    } else {
      status =
        "LOCATION_UNAVAILABLE";

      locationLine =
        `GPS Captured · ±${Math.round(
          location.accuracyM,
        )} m · Outlet location not configured`;
    }
  }


  const stamped =
    await stampEvidencePhoto({
      file,

      capturedAt,

      timezone:
        outlet.timezone,

      outletName:
        outlet.outletName,

      moduleLabel,

      subjectLabel,

      locationLine,
    });


  const metadata:
    PhotoEvidenceMetadata =
    {
      captureSource:
        "CAMERA",

      capturedAt,

      latitude:
        location
          ?.latitude ??
        null,

      longitude:
        location
          ?.longitude ??
        null,

      locationAccuracyM:
        location
          ?.accuracyM ??
        null,

      distanceFromOutletM:
        roundedDistance(
          distance,
        ),

      locationStatus:
        status,

      outletTimezone:
        outlet.timezone,

      watermarkVersion:
        "OPS_PHOTO_V1",
    };


  return {
    file:
      stamped,

    originalFilename:
      file.name,

    metadata,
  };
}
