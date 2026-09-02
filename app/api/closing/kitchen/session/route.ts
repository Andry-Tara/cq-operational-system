import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getActiveOutlet } from "@/lib/active-outlet";
import { checkPermissionApi } from "@/lib/admin/require-admin";

export async function POST() {
  try {
    
    // ========================================================
    // PERMISSION
    // ========================================================

    const permissionAccess =
      await checkPermissionApi(
        "closing.submit"
      );

    if (!permissionAccess.ok) {
      return NextResponse.json(
        {
          error:
            permissionAccess.error,
        },
        {
          status:
            permissionAccess.status,
        }
      );
    }

const supabase = await createClient();

    // ========================================================
    // AUTH
    // ========================================================

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // ========================================================
    // ACTIVE OUTLET
    //
    // IMPORTANT:
    // No longer uses primary outlet from user_outlets.
    // Uses cq_active_outlet selected by user.
    // ========================================================

    const activeOutlet = await getActiveOutlet();

    if (!activeOutlet) {
      return NextResponse.json(
        {
          error: "Outlet belum dipilih.",
          code: "OUTLET_REQUIRED",
        },
        { status: 400 }
      );
    }

    // ========================================================
    // LOAD COMPLETE OUTLET RECORD
    // ========================================================

    const {
      data: outlet,
      error: outletError,
    } = await supabase
      .from("outlets")
      .select(`
        id,
        code,
        name,
        timezone,
        organization_id
      `)
      .eq("id", activeOutlet.id)
      .eq("is_active", true)
      .maybeSingle();

    if (outletError || !outlet) {
      return NextResponse.json(
        {
          error:
            outletError?.message ||
            "Outlet tidak ditemukan.",
        },
        { status: 404 }
      );
    }

    // ========================================================
    // VERIFY OUTLET ACCESS
    // ========================================================

    const {
      data: hasOutletAccess,
      error: accessError,
    } = await supabase.rpc(
      "has_outlet_access",
      {
        p_outlet_id: outlet.id,
      }
    );

    if (accessError) {
      throw accessError;
    }

    if (hasOutletAccess !== true) {
      return NextResponse.json(
        {
          error:
            "Anda tidak memiliki akses ke outlet ini.",
        },
        { status: 403 }
      );
    }

    // ========================================================
    // CLOSING FORM
    // ========================================================

    const {
      data: form,
      error: formError,
    } = await supabase
      .from("forms")
      .select(`
        id,
        code,
        name
      `)
      .eq(
        "organization_id",
        outlet.organization_id
      )
      .eq("code", "CLOSING")
      .eq("is_active", true)
      .maybeSingle();

    if (formError || !form) {
      throw new Error(
        formError?.message ||
          "Closing form not found"
      );
    }

    // ========================================================
    // ACTIVE VERSION FOR SELECTED OUTLET
    // ========================================================

    const {
      data: assignment,
      error: assignmentError,
    } = await supabase
      .from("outlet_form_assignments")
      .select(`
        id,
        form_version_id
      `)
      .eq("outlet_id", outlet.id)
      .eq("form_id", form.id)
      .eq("is_active", true)
      .order("effective_from", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (assignmentError || !assignment) {
      throw new Error(
        assignmentError?.message ||
          `Closing form belum diaktifkan untuk ${outlet.name}`
      );
    }

    // ========================================================
    // KITCHEN SECTION
    // ========================================================

    const {
      data: section,
      error: sectionError,
    } = await supabase
      .from("sections")
      .select(`
        id,
        code,
        name
      `)
      .eq("form_id", form.id)
      .eq("code", "KITCHEN")
      .eq("is_active", true)
      .maybeSingle();

    if (sectionError || !section) {
      throw new Error(
        sectionError?.message ||
          "Kitchen section not found"
      );
    }

    // ========================================================
    // VERSION SECTION
    // ========================================================

    const {
      data: versionSection,
      error: versionSectionError,
    } = await supabase
      .from("form_version_sections")
      .select("id")
      .eq(
        "form_version_id",
        assignment.form_version_id
      )
      .eq("section_id", section.id)
      .eq("is_active", true)
      .maybeSingle();

    if (
      versionSectionError ||
      !versionSection
    ) {
      throw new Error(
        versionSectionError?.message ||
          "Kitchen version section not found"
      );
    }

    // ========================================================
    // BUSINESS DATE
    //
    // Uses selected outlet timezone.
    //
    // Jakarta/Jawa: Asia/Jakarta
    // Bali:          Asia/Makassar
    // ========================================================

    const timezone =
      outlet.timezone ||
      "Asia/Jakarta";

    const businessDate =
      new Intl.DateTimeFormat(
        "en-CA",
        {
          timeZone: timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
        }
      ).format(new Date());

    // ========================================================
    // DAILY REPORT
    //
    // Database UNIQUE constraint now guarantees:
    //
    // outlet_id + form_id + business_date
    // = maximum 1 report
    // ========================================================

    const {
      data: todaysReport,
      error: todaysReportError,
    } = await supabase
      .from("reports")
      .select(`
        id,
        report_number,
        status,
        pdf_storage_path,
        reopened_at,
        reopen_reason,
        reopen_question_ids,
        resubmitted_at
      `)
      .eq("outlet_id", outlet.id)
      .eq("form_id", form.id)
      .eq(
        "business_date",
        businessDate
      )
      .maybeSingle();

    if (todaysReportError) {
      throw todaysReportError;
    }

    // ========================================================
    // COMPLETED REPORT
    //
    // Cannot create another daily report.
    // ========================================================

    if (
      todaysReport &&
      ["completed", "submitted"].includes(
        String(
          todaysReport.status
        ).toLowerCase()
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Closing outlet hari ini sudah disubmit.",
          code:
            "ALREADY_COMPLETED",

          reportId:
            todaysReport.id,

          reportNumber:
            todaysReport.report_number,

          reportStatus:
            todaysReport.status,

          pdfStoragePath:
            todaysReport.pdf_storage_path,
        },
        { status: 409 }
      );
    }

    // ========================================================
    // RESUME EXISTING REPORT
    //
    // draft
    // in_progress
    // reopened
    // ========================================================

    let report = todaysReport;

    // ========================================================
    // CREATE NEW REPORT
    //
    // Only when no report exists for today.
    // ========================================================

    if (!report) {
      const reportNumber =
        `CLS-${outlet.code}-${businessDate.replaceAll(
          "-",
          ""
        )}-` +
        crypto
          .randomUUID()
          .slice(0, 6)
          .toUpperCase();

      const {
        data: newReport,
        error: createReportError,
      } = await supabase
        .from("reports")
        .insert({
          report_number:
            reportNumber,

          organization_id:
            outlet.organization_id,

          outlet_id:
            outlet.id,

          form_id:
            form.id,

          form_version_id:
            assignment.form_version_id,

          business_date:
            businessDate,

          status:
            "in_progress",

          started_by:
            user.id,
        })
        .select(`
          id,
          report_number,
          status,
          pdf_storage_path,
          reopened_at,
          reopen_reason,
          reopen_question_ids,
          resubmitted_at
        `)
        .single();

      if (createReportError) {
        // Daily unique lock may block a race condition.
        if (
          createReportError.code ===
          "23505"
        ) {
          return NextResponse.json(
            {
              error:
                "Closing report hari ini sudah tersedia. Silakan refresh dan resume report.",
              code:
                "DAILY_REPORT_EXISTS",
            },
            { status: 409 }
          );
        }

        throw createReportError;
      }

      report = newReport;
    }

    // ========================================================
    // VALIDATE OPEN STATUS
    // ========================================================

    const reportStatus =
      String(
        report.status || ""
      ).toLowerCase();

    if (
      ![
        "draft",
        "in_progress",
        "reopened",
      ].includes(reportStatus)
    ) {
      return NextResponse.json(
        {
          error:
            `Report status ${report.status} tidak dapat dilanjutkan.`,
        },
        { status: 409 }
      );
    }

    // ========================================================
    // REPORT SECTION
    // ========================================================

    const {
      data: existingSection,
      error: existingSectionError,
    } = await supabase
      .from("report_sections")
      .select(`
        id,
        status
      `)
      .eq(
        "report_id",
        report.id
      )
      .eq(
        "section_id",
        section.id
      )
      .maybeSingle();

    if (existingSectionError) {
      throw existingSectionError;
    }

    let reportSection =
      existingSection;

    if (!reportSection) {
      const {
        data: newSection,
        error: createSectionError,
      } = await supabase
        .from("report_sections")
        .insert({
          report_id:
            report.id,

          section_id:
            section.id,

          version_section_id:
            versionSection.id,

          status:
            "in_progress",

          started_by:
            user.id,

          started_at:
            new Date().toISOString(),
        })
        .select(`
          id,
          status
        `)
        .single();

      if (createSectionError) {
        throw createSectionError;
      }

      reportSection =
        newSection;
    }

    // ========================================================
    // EXISTING ANSWERS / PHOTOS / ISSUES
    //
    // Used when resuming an in-progress or reopened report.
    // ========================================================

    const { data: existingAnswerRows, error: answerLoadError } =
      await supabase
        .from("report_answers")
        .select(`
          id,
          question_id,
          answer_value,
          notes,
          is_compliant
        `)
        .eq("report_section_id", reportSection.id);

    if (answerLoadError) {
      throw answerLoadError;
    }

    const answerIds =
      (existingAnswerRows ?? []).map(
        (item: any) => item.id
      );

    let existingPhotoRows: any[] = [];

    if (answerIds.length) {
      const { data, error } =
        await supabase
          .from("report_photos")
          .select(`
            id,
            answer_id,
            storage_bucket,
            storage_path,
            original_filename,
            mime_type,
            file_size
          `)
          .in("answer_id", answerIds);

      if (error) throw error;

      existingPhotoRows = data ?? [];
    }

    let existingIssues: any[] = [];

    if (answerIds.length) {
      const { data, error } =
        await supabase
          .from("issues")
          .select(`
            id,
            answer_id,
            status,
            description,
            created_at
          `)
          .eq("report_id", report.id)
          .in("answer_id", answerIds)
          .order("created_at", {
            ascending: false,
          });

      if (error) throw error;

      existingIssues = data ?? [];
    }

    const issueIds =
      existingIssues.map(
        (item: any) => item.id
      );

    let correctiveRows: any[] = [];

    if (issueIds.length) {
      const { data, error } =
        await supabase
          .from("corrective_actions")
          .select(`
            id,
            issue_id,
            action_text,
            created_at
          `)
          .in("issue_id", issueIds)
          .order("created_at", {
            ascending: false,
          });

      if (error) throw error;

      correctiveRows = data ?? [];
    }

    const photoByAnswer =
      new Map<string, any>();

    for (const photo of existingPhotoRows) {
      if (
        photo.answer_id &&
        !photoByAnswer.has(photo.answer_id)
      ) {
        photoByAnswer.set(
          photo.answer_id,
          photo
        );
      }
    }

    const issueByAnswer =
      new Map<string, any>();

    for (const issue of existingIssues) {
      if (
        issue.answer_id &&
        !issueByAnswer.has(issue.answer_id)
      ) {
        issueByAnswer.set(
          issue.answer_id,
          issue
        );
      }
    }

    const correctiveByIssue =
      new Map<string, any>();

    for (const action of correctiveRows) {
      if (
        action.issue_id &&
        !correctiveByIssue.has(
          action.issue_id
        )
      ) {
        correctiveByIssue.set(
          action.issue_id,
          action
        );
      }
    }

    const existingAnswers =
      (existingAnswerRows ?? []).map(
        (answer: any) => {
          const photo =
            photoByAnswer.get(
              answer.id
            ) ?? null;

          const issue =
            issueByAnswer.get(
              answer.id
            ) ?? null;

          const corrective =
            issue
              ? correctiveByIssue.get(
                  issue.id
                ) ?? null
              : null;

          const rawValue =
            answer.answer_value;

          let value: any = null;

          if (
            rawValue &&
            typeof rawValue === "object" &&
            "value" in rawValue
          ) {
            value = rawValue.value;
          } else {
            value = rawValue;
          }

          return {
            questionId:
              answer.question_id,

            value,

            notes:
              answer.notes ?? "",

            correctiveAction:
              corrective?.action_text ??
              "",

            existingPhoto:
              photo
                ? {
                    storageBucket:
                      photo.storage_bucket,

                    storagePath:
                      photo.storage_path,

                    originalFilename:
                      photo.original_filename,

                    mimeType:
                      photo.mime_type,

                    fileSize:
                      photo.file_size,
                  }
                : null,
          };
        }
      );

    // ========================================================
    // RESPONSE
    // ========================================================

    return NextResponse.json({
      success: true,

      reportId:
        report.id,

      reportNumber:
        report.report_number,

      reportStatus:
        report.status,

      reportSectionId:
        reportSection.id,

      reportSectionStatus:
        reportSection.status,

      businessDate,

      timezone,

      isReopened:
        reportStatus ===
        "reopened",

      reopen: {
        reopenedAt:
          report.reopened_at ??
          null,

        reason:
          report.reopen_reason ??
          null,

        questionIds:
          Array.isArray(
            report.reopen_question_ids
          )
            ? report.reopen_question_ids
            : [],
        resubmittedAt:
          report.resubmitted_at ??
          null,
      },

      outlet: {
        id:
          outlet.id,

        code:
          outlet.code,

        name:
          outlet.name,

        timezone:
          outlet.timezone,
      },

      existingAnswers,
    });
  } catch (error: any) {
    console.error(
      "Closing session error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ??
          "Unable to create closing session",
      },
      { status: 500 }
    );
  }
}
