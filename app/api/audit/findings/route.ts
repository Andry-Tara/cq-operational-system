import { NextResponse } from "next/server";

import { checkPermissionApi } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import {
  distanceMeters,
} from "@/lib/photo-evidence/distance";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RISKS = new Set([
  "none",
  "minor",
  "medium",
  "major",
  "critical",
]);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function getOptionalNumber(
  formData: FormData,
  key: string,
) {
  const raw =
    getText(
      formData,
      key,
    );

  if (!raw) {
    return null;
  }

  const value =
    Number(raw);

  return Number.isFinite(value)
    ? value
    : null;
}

export async function POST(request: Request) {
  try {
    const access = await checkPermissionApi("audit.submit");
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const sessionId = getText(formData, "sessionId");
    const questionId = getText(formData, "questionId");
    const categoryId = getText(formData, "categoryId");
    const risk = getText(formData, "risk").toLowerCase();
    const notes = getText(formData, "notes");
    const rawPhoto = formData.get("photo");
    const photo = rawPhoto instanceof File && rawPhoto.size > 0 ? rawPhoto : null;

    const photoOriginalFilename =
      getText(
        formData,
        "photoOriginalFilename",
      );

    const rawCaptureSource =
      getText(
        formData,
        "photoCaptureSource",
      ).toUpperCase();

    const captureSource =
      rawCaptureSource === "CAMERA"
        ? "CAMERA"
        : "GALLERY";

    const photoCapturedAt =
      getText(
        formData,
        "photoCapturedAt",
      );

    const photoLatitude =
      getOptionalNumber(
        formData,
        "photoLatitude",
      );

    const photoLongitude =
      getOptionalNumber(
        formData,
        "photoLongitude",
      );

    const photoLocationAccuracyM =
      getOptionalNumber(
        formData,
        "photoLocationAccuracyM",
      );

    const photoWatermarkVersion =
      getText(
        formData,
        "photoWatermarkVersion",
      );

    if (!UUID.test(sessionId) || !UUID.test(questionId) ||
        !UUID.test(categoryId) || !RISKS.has(risk)) {
      return NextResponse.json({ error: "Invalid finding payload." }, { status: 400 });
    }

    if (photo && (!photo.type.startsWith("image/") || photo.size > MAX_IMAGE_BYTES)) {
      return NextResponse.json(
        { error: "Photo harus berupa image maksimal 12 MB." },
        { status: 400 },
      );
    }

    if (
      photo &&
      rawCaptureSource &&
      rawCaptureSource !== "CAMERA" &&
      rawCaptureSource !== "GALLERY"
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid photo capture source.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      photoLatitude != null &&
      (
        photoLatitude < -90 ||
        photoLatitude > 90
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid photo latitude.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      photoLongitude != null &&
      (
        photoLongitude < -180 ||
        photoLongitude > 180
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid photo longitude.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      photoLocationAccuracyM != null &&
      photoLocationAccuracyM < 0
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid photo location accuracy.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      photo &&
      captureSource === "CAMERA" &&
      (
        !photoCapturedAt ||
        Number.isNaN(
          Date.parse(
            photoCapturedAt,
          ),
        )
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Camera evidence requires a valid capture timestamp.",
        },
        {
          status: 400,
        },
      );
    }

    if (
      photo &&
      captureSource === "CAMERA" &&
      photoWatermarkVersion !==
        "OPS_PHOTO_V1"
    ) {
      return NextResponse.json(
        {
          error:
            "Camera evidence must contain OPS timestamp watermark.",
        },
        {
          status: 400,
        },
      );
    }

    const admin = createAdminClient();

    const { data: session, error: sessionError } = await admin
      .from("audit_sessions")
      .select("id,organization_id,outlet_id,form_version_id,auditor_user_id,status")
      .eq("id", sessionId)
      .maybeSingle();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Audit session tidak ditemukan." }, { status: 404 });
    }

    if (session.auditor_user_id !== user.id) {
      return NextResponse.json({ error: "Audit session bukan milik user ini." }, { status: 403 });
    }

    if (session.status !== "draft") {
      return NextResponse.json(
        { error: "Audit sudah disubmit dan tidak dapat diubah." },
        { status: 409 },
      );
    }

    let photoEvidence:
      | {
          originalFilename:
            string | null;
          captureSource:
            "CAMERA" | "GALLERY";
          capturedAt:
            string | null;
          uploadedAt:
            string;
          latitude:
            number | null;
          longitude:
            number | null;
          locationAccuracyM:
            number | null;
          outletLatitude:
            number | null;
          outletLongitude:
            number | null;
          distanceFromOutletM:
            number | null;
          locationStatus:
            | "VERIFIED"
            | "OUTSIDE_AREA"
            | "LOW_ACCURACY"
            | "LOCATION_UNAVAILABLE"
            | "GALLERY";
          outletTimezone:
            string;
          watermarkVersion:
            string | null;
        }
      | null =
      null;

    if (photo) {
      const {
        data: photoOutlet,
        error: photoOutletError,
      } = await admin
        .from("outlets")
        .select(`
          id,
          name,
          timezone,
          latitude,
          longitude,
          photo_geofence_radius_m,
          photo_location_accuracy_threshold_m
        `)
        .eq(
          "id",
          session.outlet_id,
        )
        .eq(
          "organization_id",
          session.organization_id,
        )
        .maybeSingle();

      if (
        photoOutletError ||
        !photoOutlet
      ) {
        throw (
          photoOutletError ||
          new Error(
            "Outlet photo context not found.",
          )
        );
      }

      const outletTimezone =
        photoOutlet.timezone ||
        "Asia/Jakarta";

      const outletLatitude =
        photoOutlet.latitude == null
          ? null
          : Number(
              photoOutlet.latitude,
            );

      const outletLongitude =
        photoOutlet.longitude == null
          ? null
          : Number(
              photoOutlet.longitude,
            );

      const geofenceRadiusM =
        Number(
          photoOutlet
            .photo_geofence_radius_m ??
            150,
        );

      const accuracyThresholdM =
        Number(
          photoOutlet
            .photo_location_accuracy_threshold_m ??
            100,
        );

      let locationStatus:
        | "VERIFIED"
        | "OUTSIDE_AREA"
        | "LOW_ACCURACY"
        | "LOCATION_UNAVAILABLE"
        | "GALLERY" =
        captureSource ===
        "GALLERY"
          ? "GALLERY"
          : "LOCATION_UNAVAILABLE";

      let distanceFromOutletM:
        number | null =
        null;

      const cameraHasGps =
        captureSource ===
          "CAMERA" &&
        photoLatitude != null &&
        photoLongitude != null &&
        photoLocationAccuracyM !=
          null;

      const outletHasGps =
        outletLatitude != null &&
        outletLongitude != null &&
        Number.isFinite(
          outletLatitude,
        ) &&
        Number.isFinite(
          outletLongitude,
        );

      if (
        cameraHasGps &&
        outletHasGps
      ) {
        const rawDistance =
          distanceMeters(
            photoLatitude!,
            photoLongitude!,
            outletLatitude!,
            outletLongitude!,
          );

        distanceFromOutletM =
          Math.round(
            rawDistance * 100,
          ) / 100;

        if (
          photoLocationAccuracyM! >
          accuracyThresholdM
        ) {
          locationStatus =
            "LOW_ACCURACY";
        } else if (
          rawDistance >
          geofenceRadiusM
        ) {
          locationStatus =
            "OUTSIDE_AREA";
        } else {
          locationStatus =
            "VERIFIED";
        }
      }

      photoEvidence = {
        originalFilename:
          photoOriginalFilename ||
          photo.name ||
          null,

        captureSource,

        capturedAt:
          captureSource ===
            "CAMERA"
            ? new Date(
                photoCapturedAt,
              ).toISOString()
            : null,

        uploadedAt:
          new Date()
            .toISOString(),

        latitude:
          captureSource ===
            "CAMERA"
            ? photoLatitude
            : null,

        longitude:
          captureSource ===
            "CAMERA"
            ? photoLongitude
            : null,

        locationAccuracyM:
          captureSource ===
            "CAMERA"
            ? photoLocationAccuracyM
            : null,

        outletLatitude,
        outletLongitude,

        distanceFromOutletM:
          captureSource ===
            "CAMERA"
            ? distanceFromOutletM
            : null,

        locationStatus,

        outletTimezone,

        watermarkVersion:
          captureSource ===
            "CAMERA"
            ? "OPS_PHOTO_V1"
            : null,
      };
    }

    const { data: versionSections, error: sectionError } = await admin
      .from("form_version_sections")
      .select("id")
      .eq("form_version_id", session.form_version_id)
      .eq("is_active", true);

    if (sectionError) throw sectionError;

    const sectionIds = (versionSections ?? []).map((row) => row.id);
    if (!sectionIds.length) {
      return NextResponse.json(
        { error: "Audit form section tidak tersedia." },
        { status: 409 },
      );
    }

    const { data: question, error: questionError } = await admin
      .from("questions")
      .select("id,code,question_text,question_group_id,version_section_id,is_active")
      .eq("id", questionId)
      .in("version_section_id", sectionIds)
      .eq("is_active", true)
      .maybeSingle();

    if (questionError || !question) {
      return NextResponse.json(
        { error: "Audit point tidak valid untuk version ini." },
        { status: 400 },
      );
    }

    const { data: group, error: groupError } = await admin
      .from("question_groups")
      .select("id,code,name,version_section_id,is_active")
      .eq("id", question.question_group_id)
      .eq("version_section_id", question.version_section_id)
      .eq("is_active", true)
      .maybeSingle();

    if (groupError || !group) {
      return NextResponse.json({ error: "Audit area tidak valid." }, { status: 400 });
    }

    const { data: category, error: categoryError } = await admin
      .from("audit_finding_categories")
      .select("id,code,name,organization_id,is_active")
      .eq("id", categoryId)
      .eq("organization_id", session.organization_id)
      .eq("is_active", true)
      .maybeSingle();

    if (categoryError || !category) {
      return NextResponse.json(
        { error: "Finding category tidak valid." },
        { status: 400 },
      );
    }

    const { count, error: countError } = await admin
      .from("audit_findings")
      .select("*", { count: "exact", head: true })
      .eq("audit_session_id", session.id);

    if (countError) throw countError;

    const { data: finding, error: findingError } = await admin
      .from("audit_findings")
      .insert({
        audit_session_id: session.id,
        question_id: question.id,
        question_code_snapshot: question.code,
        question_text_snapshot: question.question_text,
        area_code_snapshot: group.code,
        area_name_snapshot: group.name,
        finding_category_id: category.id,
        finding_category_code_snapshot: category.code,
        finding_category_name_snapshot: category.name,
        risk_level: risk,
        notes: notes || null,
        sort_order: (count ?? 0) * 10 + 10,
        created_by: user.id,
        metadata: {},
      })
      .select(`
        id,audit_session_id,question_id,question_code_snapshot,
        question_text_snapshot,area_code_snapshot,area_name_snapshot,
        finding_category_id,finding_category_code_snapshot,
        finding_category_name_snapshot,risk_level,notes,sort_order,created_at
      `)
      .single();

    if (findingError || !finding) throw findingError;

    let uploadedPath: string | null = null;

    try {
      if (photo) {
        const extension =
          photo.type === "image/png" ? "png" :
          photo.type === "image/webp" ? "webp" : "jpg";

        const storagePath = [
          "audit-findings",
          session.id,
          finding.id,
          `${crypto.randomUUID()}.${extension}`,
        ].join("/");

        const bytes = new Uint8Array(await photo.arrayBuffer());

        const { error: uploadError } = await admin.storage
          .from("operational-photos")
          .upload(storagePath, bytes, {
            contentType: photo.type || "image/jpeg",
            upsert: false,
          });

        if (uploadError) throw uploadError;
        uploadedPath = storagePath;

        const { error: photoRowError } = await admin
          .from("audit_finding_photos")
          .insert({
            audit_finding_id: finding.id,
            storage_bucket: "operational-photos",
            storage_path: storagePath,
            original_filename:
              photoEvidence?.originalFilename ||
              photo.name ||
              null,

            mime_type:
              photo.type ||
              null,

            file_size:
              photo.size,

            sort_order:
              10,

            created_by:
              user.id,

            captured_at:
              photoEvidence?.capturedAt ||
              null,

            uploaded_at:
              photoEvidence?.uploadedAt ||
              new Date().toISOString(),

            capture_source:
              photoEvidence?.captureSource ||
              "GALLERY",

            latitude:
              photoEvidence?.latitude ??
              null,

            longitude:
              photoEvidence?.longitude ??
              null,

            location_accuracy_m:
              photoEvidence?.locationAccuracyM ??
              null,

            outlet_latitude:
              photoEvidence?.outletLatitude ??
              null,

            outlet_longitude:
              photoEvidence?.outletLongitude ??
              null,

            distance_from_outlet_m:
              photoEvidence?.distanceFromOutletM ??
              null,

            location_status:
              photoEvidence?.locationStatus ||
              "GALLERY",

            outlet_timezone:
              photoEvidence?.outletTimezone ||
              "Asia/Jakarta",

            watermark_version:
              photoEvidence?.watermarkVersion ||
              null,
          });

        if (photoRowError) throw photoRowError;
      }
    } catch (mediaError) {
      if (uploadedPath) {
        await admin.storage.from("operational-photos").remove([uploadedPath]);
      }
      await admin.from("audit_findings").delete().eq("id", finding.id);
      throw mediaError;
    }

    return NextResponse.json({
      finding: {
        ...finding,
        photo: uploadedPath
          ? {
              storage_bucket: "operational-photos",
              storage_path: uploadedPath,
              original_filename:
                photoEvidence?.originalFilename ||
                photo?.name ||
                null,

              capture_source:
                photoEvidence?.captureSource ||
                "GALLERY",

              captured_at:
                photoEvidence?.capturedAt ||
                null,

              uploaded_at:
                photoEvidence?.uploadedAt ||
                null,

              location_status:
                photoEvidence?.locationStatus ||
                "GALLERY",

              location_accuracy_m:
                photoEvidence?.locationAccuracyM ??
                null,

              distance_from_outlet_m:
                photoEvidence?.distanceFromOutletM ??
                null,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error("Audit finding error:", error);
    return NextResponse.json(
      { error: error?.message || "Unable to save finding." },
      { status: 500 },
    );
  }
}
