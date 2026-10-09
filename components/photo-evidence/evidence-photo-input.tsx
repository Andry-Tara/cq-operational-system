"use client";

import {
  useState,
} from "react";

import {
  prepareCameraEvidence,
} from "@/lib/photo-evidence/prepare-camera-photo";

import type {
  OutletPhotoContext,
  PhotoEvidenceMetadata,
} from "@/lib/photo-evidence/types";


export type EvidencePhoto = {
  id: string;

  signed_url:
    | string
    | null;

  original_filename:
    | string
    | null;

  capture_source?:
    string | null;

  captured_at?:
    string | null;

  uploaded_at?:
    string | null;

  outlet_timezone?:
    string | null;

  location_status?:
    string | null;

  location_accuracy_m?:
    number | null;

  distance_from_outlet_m?:
    number | null;
};


function formatEvidenceTime(
  value:
    string | null | undefined,
  timezone:
    string | null | undefined,
) {
  if (!value) {
    return null;
  }

  try {
    const formatted =
      new Intl.DateTimeFormat(
        "en-GB",
        {
          timeZone:
            timezone ||
            "Asia/Jakarta",

          day:
            "2-digit",

          month:
            "short",

          year:
            "numeric",

          hour:
            "2-digit",

          minute:
            "2-digit",

          second:
            "2-digit",

          hour12:
            false,
        },
      ).format(
        new Date(
          value,
        ),
      );

    const zoneLabel =
      timezone ===
      "Asia/Makassar"
        ? "WITA"
        : timezone ===
            "Asia/Jayapura"
          ? "WIT"
          : "WIB";

    return `${formatted} ${zoneLabel}`;
  } catch {
    return value;
  }
}


function metadataHeaders(
  metadata:
    PhotoEvidenceMetadata,
  filename:
    string,
) {
  const headers:
    Record<
      string,
      string
    > = {
    "Content-Type":
      "image/jpeg",

    "X-File-Name":
      encodeURIComponent(
        filename,
      ),

    "X-Capture-Source":
      metadata
        .captureSource,
  };

  if (
    metadata.capturedAt
  ) {
    headers[
      "X-Captured-At"
    ] =
      metadata.capturedAt;
  }

  if (
    metadata.latitude !=
    null
  ) {
    headers[
      "X-Latitude"
    ] =
      String(
        metadata.latitude,
      );
  }

  if (
    metadata.longitude !=
    null
  ) {
    headers[
      "X-Longitude"
    ] =
      String(
        metadata.longitude,
      );
  }

  if (
    metadata.locationAccuracyM !=
    null
  ) {
    headers[
      "X-Location-Accuracy-M"
    ] =
      String(
        metadata.locationAccuracyM,
      );
  }

  if (
    metadata.watermarkVersion
  ) {
    headers[
      "X-Watermark-Version"
    ] =
      metadata.watermarkVersion;
  }

  return headers;
}


export default function EvidencePhotoInput({
  itemId,
  outlet,
  moduleLabel,
  subjectLabel,
  evidence,
  onChange,
  maxPhotos = 3,
}: {
  itemId:
    string;

  outlet:
    OutletPhotoContext;

  moduleLabel:
    string;

  subjectLabel:
    string;

  evidence:
    EvidencePhoto[];

  onChange:
    (
      value:
        EvidencePhoto[],
    ) => void;

  maxPhotos?:
    number;
}) {
  const [
    busy,
    setBusy,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);


  async function upload(
    file:
      File,
    source:
      "CAMERA" |
      "GALLERY",
  ) {
    if (
      busy ||
      evidence.length >=
        maxPhotos
    ) {
      return;
    }

    setBusy(
      true,
    );

    setError(
      null,
    );

    try {
      let uploadFile =
        file;

      let originalFilename =
        file.name;

      let metadata:
        PhotoEvidenceMetadata;


      if (
        source ===
        "CAMERA"
      ) {
        const prepared =
          await prepareCameraEvidence({
            file,

            outlet,

            moduleLabel,

            subjectLabel,
          });

        uploadFile =
          prepared.file;

        originalFilename =
          prepared
            .originalFilename;

        metadata =
          prepared.metadata;
      } else {
        metadata = {
          captureSource:
            "GALLERY",

          capturedAt:
            null,

          latitude:
            null,

          longitude:
            null,

          locationAccuracyM:
            null,

          distanceFromOutletM:
            null,

          locationStatus:
            "GALLERY",

          outletTimezone:
            outlet.timezone,

          watermarkVersion:
            null,
        };
      }


      const response =
        await fetch(
          `/api/audit/food-standard/items/${itemId}/evidence`,
          {
            method:
              "POST",

            headers:
              metadataHeaders(
                metadata,
                originalFilename,
              ),

            body:
              uploadFile,
          },
        );

      const payload =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          payload?.error ||
            "Unable to upload photo.",
        );
      }

      onChange([
        ...evidence,
        payload.evidence,
      ]);
    } catch (
      uploadError: any
    ) {
      setError(
        uploadError
          ?.message ||
          "Unable to upload photo evidence.",
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  async function remove(
    id:
      string,
  ) {
    if (busy) {
      return;
    }

    setBusy(
      true,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/audit/food-standard/items/${itemId}/evidence`,
          {
            method:
              "DELETE",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                evidence_id:
                  id,
              }),
          },
        );

      const payload =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          payload?.error ||
            "Unable to delete photo.",
        );
      }

      onChange(
        evidence.filter(
          (
            photo,
          ) =>
            photo.id !==
            id,
        ),
      );
    } catch (
      deleteError: any
    ) {
      setError(
        deleteError
          ?.message ||
          "Unable to delete photo.",
      );
    } finally {
      setBusy(
        false,
      );
    }
  }


  return (
    <div className="mt-5 rounded-[20px] border border-neutral-200 bg-neutral-50 p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div>
          <p className="text-sm font-black text-[#292824]">
            Photo Evidence
          </p>

          <p className="mt-1 text-xs text-neutral-400">
            Minimal 1 · maksimal{" "}
            {maxPhotos} foto.
          </p>
        </div>


        <div className="grid grid-cols-2 gap-2">

          <label
            className={[
              "inline-flex h-11 cursor-pointer items-center justify-center rounded-xl bg-[#292824] px-4 text-xs font-black text-white",
              busy ||
              evidence.length >=
                maxPhotos
                ? "pointer-events-none opacity-35"
                : "",
            ].join(
              " ",
            )}
          >
            {busy
              ? "Processing..."
              : "Take Photo"}

            <input
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              onChange={
                async (
                  event,
                ) => {
                  const file =
                    event
                      .target
                      .files?.[0];

                  event.target.value =
                    "";

                  if (file) {
                    await upload(
                      file,
                      "CAMERA",
                    );
                  }
                }
              }
            />
          </label>


          <label
            className={[
              "inline-flex h-11 cursor-pointer items-center justify-center rounded-xl border border-neutral-300 bg-white px-4 text-xs font-black text-neutral-700",
              busy ||
              evidence.length >=
                maxPhotos
                ? "pointer-events-none opacity-35"
                : "",
            ].join(
              " ",
            )}
          >
            Gallery

            <input
              type="file"
              accept="image/*"
              hidden
              onChange={
                async (
                  event,
                ) => {
                  const file =
                    event
                      .target
                      .files?.[0];

                  event.target.value =
                    "";

                  if (file) {
                    await upload(
                      file,
                      "GALLERY",
                    );
                  }
                }
              }
            />
          </label>

        </div>
      </div>


      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {error}
        </div>
      )}


      {evidence.length ===
      0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center text-xs font-bold text-neutral-400">
          Belum ada photo evidence.
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3">
          {evidence.map(
            (
              photo,
              index,
            ) => (
              <div
                key={
                  photo.id
                }
                className="relative overflow-hidden rounded-xl border border-neutral-200 bg-white"
              >
                <button
                  type="button"
                  disabled={
                    busy
                  }
                  onClick={() =>
                    remove(
                      photo.id,
                    )
                  }
                  className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-lg bg-black/70 text-xs font-black text-white"
                >
                  ×
                </button>

                {photo.signed_url ? (
                  <img
                    src={
                      photo.signed_url
                    }
                    alt={
                      photo.original_filename ||
                      `Evidence ${index + 1}`
                    }
                    className="aspect-[4/3] max-h-[240px] w-full bg-neutral-950 object-contain"
                  />
                ) : (
                  <div className="flex aspect-[4/3] items-center justify-center text-xs font-bold text-neutral-400">
                    Evidence
                  </div>
                )}

                <div className="space-y-1 px-3 py-2">
                  <p className="truncate text-[10px] font-bold text-neutral-500">
                    {photo.original_filename ||
                      `Evidence ${index + 1}`}
                  </p>

                  <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
                    {photo.capture_source ||
                      "GALLERY"}

                    {photo.location_status
                      ? ` · ${photo.location_status.replaceAll(
                          "_",
                          " ",
                        )}`
                      : ""}
                  </p>

                  {photo.capture_source ===
                    "CAMERA" &&
                    photo.captured_at && (
                      <p className="text-[9px] font-bold text-neutral-500">
                        Captured{" "}
                        {formatEvidenceTime(
                          photo.captured_at,
                          photo.outlet_timezone,
                        )}
                      </p>
                    )}

                  {photo.capture_source ===
                    "GALLERY" &&
                    photo.uploaded_at && (
                      <p className="text-[9px] font-bold text-neutral-500">
                        Uploaded{" "}
                        {formatEvidenceTime(
                          photo.uploaded_at,
                          photo.outlet_timezone,
                        )}
                      </p>
                    )}
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
