export type PhotoCaptureSource =
  | "CAMERA"
  | "GALLERY";

export type PhotoLocationStatus =
  | "VERIFIED"
  | "OUTSIDE_AREA"
  | "LOW_ACCURACY"
  | "LOCATION_UNAVAILABLE"
  | "GALLERY";

export type OutletPhotoContext = {
  outletName: string;
  timezone: string;

  latitude:
    | number
    | null;

  longitude:
    | number
    | null;

  geofenceRadiusM: number;
  accuracyThresholdM: number;
};

export type PhotoEvidenceMetadata = {
  captureSource:
    PhotoCaptureSource;

  capturedAt:
    string | null;

  latitude:
    number | null;

  longitude:
    number | null;

  locationAccuracyM:
    number | null;

  distanceFromOutletM:
    number | null;

  locationStatus:
    PhotoLocationStatus;

  outletTimezone:
    string;

  watermarkVersion:
    string | null;
};
