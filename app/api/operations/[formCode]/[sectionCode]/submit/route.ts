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
        status,
        correction_requested_by,
        correction_requested_at,
        correction_reason,
        correction_question_ids,
        correction_round`)
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
    // SECTION CORRECTION CONTEXT
    // ========================================================

    const reportSectionStatus =
      String(
        reportSection.status ||
          ""
      )
        .trim()
        .toLowerCase();

    const isSectionCorrection =
      config.sectionScoped &&
      reportSectionStatus ===
        "needs_correction";

    const correctionQuestionIds =
      Array.isArray(
        reportSection
          .correction_question_ids
      )
        ? reportSection
            .correction_question_ids
            .map(
              (value: unknown) =>
                String(
                  value ||
                    ""
                ).trim()
            )
            .filter(Boolean)
        : [];

    const correctionQuestionIdSet =
      new Set<string>(
        correctionQuestionIds
      );

    if (
      isSectionCorrection &&
      correctionQuestionIds.length ===
        0
    ) {
      return NextResponse.json(
        {
          error:
            "Section correction tidak memiliki target pertanyaan.",
          code:
            "CORRECTION_TARGETS_MISSING",
        },
        {
          status: 409,
        }
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

    const allQuestions =
      questions ?? [];

    // ========================================================
    // AUTHORITATIVE QUESTION APPLICABILITY
    //
    // Legacy forms:
    //   no applicability metadata -> existing behavior
    //
    // Applicability-enabled forms:
    //   report_question_applicability is authoritative.
    //
    // N/A questions:
    //   - cannot be submitted
    //   - require no answer
    //   - require no photo
    //   - create no issue
    // ========================================================

    const applicabilityEnabled =
      allQuestions.some(
        (question: any) =>
          question?.config
            ?.applicability != null
      );

    let applicableQuestions =
      allQuestions;

    if (applicabilityEnabled) {
      const invalidApplicabilityConfig =
        allQuestions.filter(
          (question: any) => {
            const applicability =
              question?.config
                ?.applicability;

            const sourceType =
              String(
                applicability?.type ||
                  ""
              )
                .trim()
                .toLowerCase();

            if (
              ![
                "global",
                "facility",
              ].includes(
                sourceType
              )
            ) {
              return true;
            }

            if (
              sourceType ===
                "global" &&
              applicability
                ?.facility_key != null
            ) {
              return true;
            }

            if (
              sourceType ===
                "facility" &&
              !String(
                applicability
                  ?.facility_key ||
                  ""
              ).trim()
            ) {
              return true;
            }

            return false;
          }
        );

      if (
        invalidApplicabilityConfig.length >
        0
      ) {
        return NextResponse.json(
          {
            error:
              "Konfigurasi applicability pertanyaan belum lengkap.",
            code:
              "APPLICABILITY_CONFIG_INCOMPLETE",
            questionIds:
              invalidApplicabilityConfig.map(
                (question: any) =>
                  question.id
              ),
          },
          {
            status: 409,
          }
        );
      }

      const {
        data:
          applicabilityRows,
        error:
          applicabilityError,
      } = await supabase
        .from(
          "report_question_applicability"
        )
        .select(`
          question_id,
          is_applicable,
          source_type,
          source_key
        `)
        .eq(
          "report_section_id",
          reportSectionId
        );

      if (
        applicabilityError
      ) {
        throw applicabilityError;
      }

      const snapshotRows =
        applicabilityRows ?? [];

      if (
        snapshotRows.length !==
        allQuestions.length
      ) {
        return NextResponse.json(
          {
            error:
              "Snapshot applicability report belum lengkap. Buka ulang section untuk membuat atau memuat snapshot yang benar.",
            code:
              "APPLICABILITY_SNAPSHOT_INCOMPLETE",
            expectedCount:
              allQuestions.length,
            existingCount:
              snapshotRows.length,
          },
          {
            status: 409,
          }
        );
      }

      const activeQuestionIdSet =
        new Set<string>(
          allQuestions.map(
            (question: any) =>
              String(
                question.id
              )
          )
        );

      const snapshotQuestionIdSet =
        new Set<string>(
          snapshotRows.map(
            (row: any) =>
              String(
                row.question_id
              )
          )
        );

      const missingSnapshotQuestionIds =
        allQuestions
          .map(
            (question: any) =>
              String(
                question.id
              )
          )
          .filter(
            (questionId: string) =>
              !snapshotQuestionIdSet.has(
                questionId
              )
          );

      const unexpectedSnapshotQuestionIds =
        snapshotRows
          .map(
            (row: any) =>
              String(
                row.question_id
              )
          )
          .filter(
            (questionId: string) =>
              !activeQuestionIdSet.has(
                questionId
              )
          );

      if (
        missingSnapshotQuestionIds
          .length >
          0 ||
        unexpectedSnapshotQuestionIds
          .length >
          0
      ) {
        return NextResponse.json(
          {
            error:
              "Snapshot applicability tidak sesuai dengan pertanyaan aktif report section.",
            code:
              "APPLICABILITY_SNAPSHOT_MISMATCH",
            missingQuestionIds:
              missingSnapshotQuestionIds,
            unexpectedQuestionIds:
              unexpectedSnapshotQuestionIds,
          },
          {
            status: 409,
          }
        );
      }

      const applicableQuestionIdSet =
        new Set<string>(
          snapshotRows
            .filter(
              (row: any) =>
                row.is_applicable ===
                true
            )
            .map(
              (row: any) =>
                String(
                  row.question_id
                )
            )
        );

      const invalidIncomingQuestionIds =
        answers
          .map(
            (answer: any) =>
              String(
                answer
                  ?.questionId ||
                  ""
              ).trim()
          )
          .filter(Boolean)
          .filter(
            (
              questionId: string
            ) =>
              !applicableQuestionIdSet.has(
                questionId
              )
          );

      if (
        invalidIncomingQuestionIds.length >
        0
      ) {
        return NextResponse.json(
          {
            error:
              "Submission mencoba mengirim jawaban untuk pertanyaan N/A atau pertanyaan yang tidak berlaku.",
            code:
              "NON_APPLICABLE_ANSWER_PAYLOAD",
            questionIds:
              Array.from(
                new Set(
                  invalidIncomingQuestionIds
                )
              ),
          },
          {
            status: 400,
          }
        );
      }

      applicableQuestions =
        allQuestions.filter(
          (question: any) =>
            applicableQuestionIdSet.has(
              String(
                question.id
              )
            )
        );
    }

    const questionMap =
      new Map(
        applicableQuestions.map(
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
    // TARGETED SECTION CORRECTION SAFETY
    // ========================================================

    if (isSectionCorrection) {
      const incomingQuestionIds =
        answers
          .map(
            (answer: any) =>
              String(
                answer?.questionId ||
                  ""
              ).trim()
          )
          .filter(Boolean);

      const invalidQuestionIds =
        incomingQuestionIds.filter(
          (
            questionId: string
          ) =>
            !correctionQuestionIdSet.has(
              questionId
            )
        );

      if (
        invalidQuestionIds.length >
        0
      ) {
        return NextResponse.json(
          {
            error:
              "Payload correction mencoba mengubah pertanyaan yang tidak dibuka oleh Production Leader.",

            code:
              "INVALID_CORRECTION_QUESTION_PAYLOAD",

            invalidQuestionIds,
          },
          {
            status: 400,
          }
        );
      }


      const invalidTargetIds =
        correctionQuestionIds.filter(
          (
            questionId: string
          ) =>
            !questionMap.has(
              questionId
            )
        );

      if (
        invalidTargetIds.length >
        0
      ) {
        return NextResponse.json(
          {
            error:
              "Target correction sudah tidak termasuk pertanyaan aktif section.",

            code:
              "INVALID_CORRECTION_TARGETS",

            invalidQuestionIds:
              invalidTargetIds,
          },
          {
            status: 409,
          }
        );
      }
    }


    // ========================================================
    // VALIDATION
    // ========================================================

    for (
      const question of
      (
        isSectionCorrection
          ? applicableQuestions.filter(
              (item: any) =>
                correctionQuestionIdSet.has(
                  item.id
                )
            )
          : applicableQuestions
      )
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

    let submittedAt =
      new Date()
        .toISOString();


    if (isSectionCorrection) {
      const {
        data:
          resubmitRows,
        error:
          resubmitError,
      } = await supabase.rpc(
        "resubmit_report_section_correction",
        {
          p_report_section_id:
            reportSectionId,
        }
      );


      if (resubmitError) {
        throw resubmitError;
      }


      const resubmittedSection =
        Array.isArray(
          resubmitRows
        )
          ? resubmitRows[0]
          : resubmitRows;


      if (
        !resubmittedSection
      ) {
        throw new Error(
          "Correction resubmit transition gagal."
        );
      }


      if (
        resubmittedSection
          .submitted_at
      ) {
        submittedAt =
          resubmittedSection
            .submitted_at;
      }

    } else {
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
        "section_id, submitted_by"
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

    // ========================================================
    // CURRENT PIC COMPLETION
    //
    // Parent CK completion remains based on ALL required
    // sections above.
    //
    // PIC completion is separate:
    // - only required sections assigned to this user
    // - assignment source = user_section_permissions.can_submit
    // - the section must have actually been submitted by
    //   the current authenticated user
    // ========================================================

    let picAssignedIds =
      new Set<string>();

    if (
      config.sectionScoped &&
      requiredIds.size > 0
    ) {
      const {
        data:
          picPermissionRows,
        error:
          picPermissionError,
      } = await supabase
        .from(
          "user_section_permissions"
        )
        .select(
          "section_id"
        )
        .eq(
          "user_id",
          user.id
        )
        .eq(
          "outlet_id",
          report.outlet_id
        )
        .eq(
          "form_id",
          report.form_id
        )
        .eq(
          "can_submit",
          true
        )
        .in(
          "section_id",
          [
            ...requiredIds,
          ]
        );

      if (
        picPermissionError
      ) {
        throw picPermissionError;
      }

      picAssignedIds =
        new Set(
          (
            picPermissionRows ??
            []
          ).map(
            (
              item: any
            ) =>
              item.section_id
          )
        );
    }

    const picCompletedIds =
      new Set(
        (
          completedSections ??
          []
        )
          .filter(
            (
              item: any
            ) =>
              item.submitted_by ===
                user.id &&
              picAssignedIds.has(
                item.section_id
              )
          )
          .map(
            (
              item: any
            ) =>
              item.section_id
          )
      );

    const picAssignedCount =
      picAssignedIds.size;

    const picCompletedCount =
      picCompletedIds.size;

    const picCompleted =
      config.sectionScoped &&
      picAssignedCount > 0 &&
      [
        ...picAssignedIds,
      ].every(
        (id) =>
          picCompletedIds.has(
            id
          )
      );

    // ========================================================
    // CK AREA FINALIZATION SAFETY
    //
    // CK section submission is not the final report event.
    //
    // Production PIC:
    // - submits section only
    // - does not generate a PIC final PDF
    //
    // Store/Warehouse keeps the existing PIC PDF flow.
    // Parent CK completion will be handled later by
    // area leader finalization.
    // ========================================================

    const isProductionSection =
      config.sectionScoped &&
      [
        "BEVERAGE",
        "BUTCHER",
        "STEWARD",
        "PREMIX",
        "COLD_KITCHEN",
        "HOT_KITCHEN",
        "HDS",
      ].includes(
        normalizedSectionCode
      );

    const sectionSubmitCompletesParentReport =
      !config.sectionScoped &&
      allCompleted;

    const picReadyForPdf =
      config.sectionScoped &&
      !isProductionSection &&
      picCompleted;

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
        sectionSubmitCompletesParentReport
          ? "completed"
          : config.sectionScoped
            ? "in_progress"
            : "submitted",

      completed_at:
        sectionSubmitCompletesParentReport
          ? submittedAt
          : null,
    };

    if (
      wasReopened &&
      sectionSubmitCompletesParentReport
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

    if (
      config.sectionScoped
    ) {
      revalidatePath(
        "/protected/central-kitchen"
      );
    }

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
        sectionSubmitCompletesParentReport,

      picCompleted:
        config.sectionScoped
          ? picCompleted
          : null,

      picAssignedCount:
        config.sectionScoped
          ? picAssignedCount
          : null,

      picCompletedCount:
        config.sectionScoped
          ? picCompletedCount
          : null,

      picReadyForPdf,

      answerCount:
        answers.length,

      photoCount,

      issueCount,

      resubmitted:
        wasReopened &&
        sectionSubmitCompletesParentReport,

      resubmittedAt:
        wasReopened &&
        sectionSubmitCompletesParentReport
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
