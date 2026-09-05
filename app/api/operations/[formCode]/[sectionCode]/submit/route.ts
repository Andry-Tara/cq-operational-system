import {
  revalidatePath,
} from "next/cache";

import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  checkPermissionApi,
} from "@/lib/admin/require-admin";
import {
  isOperationalPhotoRequired,
} from "@/lib/operations/evidence";

import {
  getOperationConfig,
  normalizeOperationCode,
} from "@/lib/operations/config";

type RouteContext = {
  params: Promise<{
    formCode: string;
    sectionCode: string;
  }>;
};

export async function POST(
  req: NextRequest,
  context: RouteContext
) {
  try {
    const {
      formCode,
      sectionCode,
    } = await context.params;

    const config =
      getOperationConfig(
        formCode
      );

    if (!config) {
      return NextResponse.json(
        {
          error:
            "Operation tidak dikenal.",
        },
        {
          status: 404,
        }
      );
    }

    const normalizedSectionCode =
      normalizeOperationCode(
        sectionCode
      );

    // ========================================================
    // PERMISSION
    // ========================================================

    // Legacy OPENING / CLOSING keep the existing global
    // application permission gate.
    //
    // Central Kitchen is section-scoped and is authorized below
    // with has_section_permission() against the exact section.
    if (!config.sectionScoped) {
      const permissionAccess =
        await checkPermissionApi(
          config.permissionCode
        );

      if (
        !permissionAccess.ok
      ) {
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
    }

    const supabase =
      await createClient();

    const {
      data: {
        user,
      },
    } =
      await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        {
          error:
            "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body =
      await req.json();

    const {
      reportId,
      reportSectionId,
      answers,
    } = body;

    if (
      !reportId ||
      !reportSectionId ||
      !Array.isArray(
        answers
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid submission payload",
        },
        {
          status: 400,
        }
      );
    }

    // ========================================================
    // REPORT SECTION
    // ========================================================

    const {
      data:
        reportSection,
      error:
        sectionFetchError,
    } = await supabase
      .from("report_sections")
      .select(`
        id,
        report_id,
        section_id,
        version_section_id,
        status
      `)
      .eq(
        "id",
        reportSectionId
      )
      .eq(
        "report_id",
        reportId
      )
      .single();

    if (
      sectionFetchError ||
      !reportSection
    ) {
      throw new Error(
        "Report section tidak ditemukan atau tidak dapat diakses."
      );
    }

    // ========================================================
    // REPORT + FORM VALIDATION
    // ========================================================

    const {
      data: report,
      error: reportError,
    } = await supabase
      .from("reports")
      .select(`
        id,
        report_number,
        outlet_id,
        form_id,
        form_version_id,
        status,
        reopened_at,
        resubmitted_at
      `)
      .eq(
        "id",
        reportId
      )
      .single();

    if (
      reportError ||
      !report
    ) {
      throw new Error(
        "Report tidak ditemukan."
      );
    }

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
        "id",
        report.form_id
      )
      .single();

    if (
      formError ||
      !form
    ) {
      throw new Error(
        "Form report tidak ditemukan."
      );
    }

    if (
      normalizeOperationCode(
        form.code
      ) !==
      config.formCode
    ) {
      return NextResponse.json(
        {
          error:
            "Report tidak sesuai dengan operation route.",
        },
        {
          status: 409,
        }
      );
    }

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
      .eq(
        "id",
        reportSection.section_id
      )
      .single();

    if (
      sectionError ||
      !section
    ) {
      throw new Error(
        "Section report tidak ditemukan."
      );
    }

    if (
      normalizeOperationCode(
        section.code
      ) !==
      normalizedSectionCode
    ) {
      return NextResponse.json(
        {
          error:
            "Report section tidak sesuai dengan operation route.",
        },
        {
          status: 409,
        }
      );
    }

    // ========================================================
    // SECTION-SCOPED SUBMIT AUTHORIZATION
    // ========================================================

    if (config.sectionScoped) {
      const {
        data: canSubmitSection,
        error: canSubmitSectionError,
      } = await supabase.rpc(
        "has_section_permission",
        {
          p_outlet_id:
            report.outlet_id,
          p_form_id:
            report.form_id,
          p_section_id:
            reportSection.section_id,
          p_permission:
            "submit",
        }
      );

      if (canSubmitSectionError) {
        throw canSubmitSectionError;
      }

      if (canSubmitSection !== true) {
        return NextResponse.json(
          {
            error:
              "Anda tidak memiliki permission untuk submit section ini.",
            code:
              "SECTION_SUBMIT_PERMISSION_DENIED",
          },
          {
            status: 403,
          }
        );
      }

      const reportStatus =
        String(
          report.status || ""
        ).toLowerCase();

      const sectionStatus =
        String(
          reportSection.status || ""
        ).toLowerCase();

      if (
        reportStatus !== "reopened" &&
        [
          "submitted",
          "reviewed",
        ].includes(
          sectionStatus
        )
      ) {
        return NextResponse.json(
          {
            error:
              `${section.name} sudah disubmit.`,
            code:
              "SECTION_ALREADY_SUBMITTED",
          },
          {
            status: 409,
          }
        );
      }
    }

    // ========================================================
    // ACTIVE QUESTIONS
    // ========================================================

    const {
      data: questions,
      error: questionError,
    } = await supabase
      .from("questions")
      .select(`
        id,
        code,
        question_text,
        question_type,
        is_required,
        unit,
        min_value,
        max_value,
        config
      `)
      .eq(
        "version_section_id",
        reportSection.version_section_id
      )
      .eq("is_active", true);

    if (
      questionError
    ) {
      throw questionError;
    }

    const questionMap =
      new Map(
        (
          questions ?? []
        ).map(
          (
            question: any
          ) => [
            question.id,
            question,
          ]
        )
      );

    const incomingMap =
      new Map(
        answers.map(
          (
            answer: any
          ) => [
            answer.questionId,
            answer,
          ]
        )
      );

    // ========================================================
    // VALIDATION
    // ========================================================

    for (
      const question of
      questions ?? []
    ) {
      const incoming:
        any =
        incomingMap.get(
          question.id
        );

      if (!incoming) {
        return NextResponse.json(
          {
            error:
              `Pertanyaan belum dijawab: ${question.question_text}`,
          },
          {
            status: 400,
          }
        );
      }

      let answered =
        false;

      if (
        question.question_type ===
        "yes_no"
      ) {
        answered =
          typeof incoming.value ===
          "boolean";
      } else if (
        question.question_type ===
        "temperature"
      ) {
        answered =
          typeof incoming.value ===
            "number" &&
          Number.isFinite(
            incoming.value
          );
      } else {
        answered =
          incoming.value !==
            undefined &&
          incoming.value !==
            null &&
          incoming.value !==
            "";
      }

      if (
        question.is_required &&
        !answered
      ) {
        return NextResponse.json(
          {
            error:
              `Jawaban wajib belum lengkap: ${question.question_text}`,
          },
          {
            status: 400,
          }
        );
      }

      // Evidence rule is data-driven for CK; legacy forms fall back to always.
      const photoRequired =
        isOperationalPhotoRequired(
          question,
          {
            value:
              incoming.value,
          }
        );

      if (
        photoRequired &&
        !incoming.storagePath
      ) {
        return NextResponse.json(
          {
            error:
              `Photo evidence wajib belum ada: ${question.question_text}`,
          },
          { status: 400 }
        );
      }

      const requiredPrefix =
        `report-sections/${reportSectionId}/`;

      if (
        incoming.storagePath &&
        !incoming.storagePath.startsWith(
          requiredPrefix
        )
      ) {
        return NextResponse.json(
          {
            error:
              `Invalid photo path for: ${question.question_text}`,
          },
          { status: 400 }
        );
      }

      let compliant =
        true;

      if (
        question.question_type ===
        "yes_no"
      ) {
        compliant =
          incoming.value ===
          true;
      }

      if (
        question.question_type ===
        "temperature"
      ) {
        const value =
          Number(
            incoming.value
          );

        if (
          question.min_value !==
            null &&
          value <
            Number(
              question.min_value
            )
        ) {
          compliant =
            false;
        }

        if (
          question.max_value !==
            null &&
          value >
            Number(
              question.max_value
            )
        ) {
          compliant =
            false;
        }
      }

      if (
        !compliant
      ) {
        if (
          !incoming.notes?.trim()
        ) {
          return NextResponse.json(
            {
              error:
                `Notes wajib diisi: ${question.question_text}`,
            },
            {
              status: 400,
            }
          );
        }

        if (
          !incoming.correctiveAction?.trim()
        ) {
          return NextResponse.json(
            {
              error:
                `Corrective Action wajib diisi: ${question.question_text}`,
            },
            {
              status: 400,
            }
          );
        }
      }
    }

    // ========================================================
    // SAVE ANSWERS
    // ========================================================

    let issueCount = 0;
    let photoCount = 0;

    for (
      const incoming of
      answers
    ) {
      const question:
        any =
        questionMap.get(
          incoming.questionId
        );

      if (!question) {
        continue;
      }

      let compliant =
        true;

      if (
        question.question_type ===
        "yes_no"
      ) {
        compliant =
          incoming.value ===
          true;
      }

      if (
        question.question_type ===
        "temperature"
      ) {
        const value =
          Number(
            incoming.value
          );

        if (
          question.min_value !==
            null &&
          value <
            Number(
              question.min_value
            )
        ) {
          compliant =
            false;
        }

        if (
          question.max_value !==
            null &&
          value >
            Number(
              question.max_value
            )
        ) {
          compliant =
            false;
        }
      }

      const answerValue =
        question.question_type ===
        "temperature"
          ? {
              value:
                Number(
                  incoming.value
                ),
              unit:
                question.unit,
            }
          : {
              value:
                incoming.value,
            };

      const {
        data:
          savedAnswer,
        error:
          answerError,
      } = await supabase
        .from(
          "report_answers"
        )
        .upsert(
          {
            report_section_id:
              reportSectionId,

            question_id:
              question.id,

            answer_value:
              answerValue,

            question_text_snapshot:
              question.question_text,

            question_type_snapshot:
              question.question_type,

            unit_snapshot:
              question.unit,

            is_compliant:
              compliant,

            requires_action:
              !compliant,

            notes:
              incoming.notes
                ?.trim() ||
              null,

            answered_by:
              user.id,

            answered_at:
              new Date()
                .toISOString(),
          },
          {
            onConflict:
              "report_section_id,question_id",
          }
        )
        .select("id")
        .single();

      if (
        answerError
      ) {
        throw answerError;
      }

      // ======================================================
      // PHOTO
      // ======================================================

      if (
        incoming.storagePath
      ) {
        const {
          error:
            photoError,
        } = await supabase
          .from(
            "report_photos"
          )
          .upsert(
            {
              report_section_id:
                reportSectionId,

              answer_id:
                savedAnswer.id,

              storage_bucket:
                "operational-photos",

              storage_path:
                incoming.storagePath,

              original_filename:
                incoming.originalFilename ||
                null,

              mime_type:
                incoming.mimeType ||
                null,

              file_size:
                incoming.fileSize ||
                null,

              uploaded_by:
                user.id,
            },
            {
              onConflict:
                "storage_bucket,storage_path",
            }
          );

        if (
          photoError
        ) {
          throw photoError;
        }

        photoCount +=
          1;
      }

      // ======================================================
      // ISSUE + CORRECTIVE
      // ======================================================

      if (
        !compliant
      ) {
        issueCount +=
          1;

        const {
          data:
            existingIssue,
        } = await supabase
          .from("issues")
          .select("id")
          .eq(
            "answer_id",
            savedAnswer.id
          )
          .in(
            "status",
            [
              "open",
              "in_progress",
            ]
          )
          .order(
            "created_at",
            {
              ascending:
                false,
            }
          )
          .limit(1)
          .maybeSingle();

        let issueId =
          existingIssue?.id;

        if (issueId) {
          const {
            error:
              issueUpdateError,
          } = await supabase
            .from("issues")
            .update({
              title:
                question.question_text,

              description:
                incoming.notes.trim(),
            })
            .eq(
              "id",
              issueId
            );

          if (
            issueUpdateError
          ) {
            throw issueUpdateError;
          }
        } else {
          const {
            data:
              newIssue,
            error:
              issueError,
          } = await supabase
            .from("issues")
            .insert({
              report_id:
                reportId,

              report_section_id:
                reportSectionId,

              answer_id:
                savedAnswer.id,

              title:
                question.question_text,

              description:
                incoming.notes.trim(),

              severity:
                "medium",

              status:
                "open",

              created_by:
                user.id,
            })
            .select("id")
            .single();

          if (
            issueError
          ) {
            throw issueError;
          }

          issueId =
            newIssue.id;
        }

        const {
          error:
            correctiveError,
        } = await supabase
          .from(
            "corrective_actions"
          )
          .insert({
            issue_id:
              issueId,

            action_text:
              incoming.correctiveAction.trim(),

            created_by:
              user.id,
          });

        if (
          correctiveError
        ) {
          throw correctiveError;
        }
      }
    }

    // ========================================================
    // SUBMIT SECTION
    // ========================================================

    const submittedAt =
      new Date()
        .toISOString();

    const {
      error:
        reportSectionUpdateError,
    } = await supabase
      .from(
        "report_sections"
      )
      .update({
        status:
          "submitted",

        submitted_by:
          user.id,

        submitted_at:
          submittedAt,
      })
      .eq(
        "id",
        reportSectionId
      );

    if (
      reportSectionUpdateError
    ) {
      throw reportSectionUpdateError;
    }

    // ========================================================
    // ALL REQUIRED SECTIONS
    // ========================================================

    const {
      data:
        requiredSections,
    } = await supabase
      .from(
        "form_version_sections"
      )
      .select(
        "section_id"
      )
      .eq(
        "form_version_id",
        report.form_version_id
      )
      .eq(
        "is_required",
        true
      )
      .eq(
        "is_active",
        true
      );

    const {
      data:
        completedSections,
    } = await supabase
      .from(
        "report_sections"
      )
      .select(
        "section_id"
      )
      .eq(
        "report_id",
        reportId
      )
      .in(
        "status",
        [
          "submitted",
          "reviewed",
        ]
      );

    const requiredIds =
      new Set(
        (
          requiredSections ??
          []
        ).map(
          (
            item: any
          ) =>
            item.section_id
        )
      );

    const completedIds =
      new Set(
        (
          completedSections ??
          []
        ).map(
          (
            item: any
          ) =>
            item.section_id
        )
      );

    const allCompleted =
      [
        ...requiredIds,
      ].every(
        (id) =>
          completedIds.has(
            id
          )
      );

    const wasReopened =
      String(
        report.status ||
        ""
      ).toLowerCase() ===
      "reopened";

    const reportUpdatePayload:
      Record<
        string,
        any
      > = {
      status:
        allCompleted
          ? "completed"
          : config.sectionScoped
            ? "in_progress"
            : "submitted",

      completed_at:
        allCompleted
          ? submittedAt
          : null,
    };

    if (
      wasReopened &&
      allCompleted
    ) {
      reportUpdatePayload.resubmitted_at =
        submittedAt;
    }

    const {
      error:
        reportUpdateError,
    } = await supabase
      .from("reports")
      .update(
        reportUpdatePayload
      )
      .eq(
        "id",
        reportId
      );

    if (
      reportUpdateError
    ) {
      throw reportUpdateError;
    }

    // ========================================================
    // REFRESH
    // ========================================================

    revalidatePath(
      "/protected"
    );

    revalidatePath(
      "/protected/reports"
    );

    revalidatePath(
      `/protected/operations/${config.formCode}/${normalizedSectionCode}`
    );

    return NextResponse.json({
      success: true,

      reportId,
      reportSectionId,

      reportNumber:
        report.report_number,

      submittedAt,

      completed:
        allCompleted,

      answerCount:
        answers.length,

      photoCount,

      issueCount,

      resubmitted:
        wasReopened &&
        allCompleted,

      resubmittedAt:
        wasReopened &&
        allCompleted
          ? submittedAt
          : null,
    });
  } catch (
    error: any
  ) {
    console.error(
      "Operation submit error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error?.message ||
          "Unable to submit operation",
      },
      {
        status: 500,
      }
    );
  }
}
