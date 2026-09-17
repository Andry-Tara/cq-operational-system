import { NextResponse } from "next/server";

import { checkPermissionApi } from "@/lib/admin/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RISKS = new Set(["minor", "medium", "major", "critical"]);
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

function getText(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
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

    const admin = createAdminClient();

    const { data: session, error: sessionError } = await admin
      .from("audit_sessions")
      .select("id,organization_id,form_version_id,auditor_user_id,status")
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
            original_filename: photo.name || null,
            mime_type: photo.type || null,
            file_size: photo.size,
            sort_order: 10,
            created_by: user.id,
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
              original_filename: photo?.name || null,
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
