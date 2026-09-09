"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/client";

import {
  buildClosingPdf,
} from "@/lib/pdf/closing-report";


type Group = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
};


type Question = {
  id: string;
  question_group_id: string | null;
  code: string;
  question_text: string;
  help_text: string | null;
  question_type: string;
  is_required: boolean;
  unit: string | null;
  min_value: number | null;
  max_value: number | null;
  sort_order: number;
  config:
    | Record<string, any>
    | null;
};


type AnswerState = {
  value?:
    | boolean
    | number
    | string;

  notes?: string;

  correctiveAction?:
    string;

  photo?: File;
};


type Props = {
  reportId: string | null;
  reportNumber:
    string | null;

  leaderName: string;

  submittedCount:
    number;

  reviewedCount:
    number;

  requiredCount:
    number;
};


function safeName(
  value: string
) {
  return String(
    value ||
    "WAREHOUSE"
  )
    .normalize(
      "NFKD"
    )
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-zA-Z0-9]+/g,
      "-"
    )
    .replace(
      /^-+|-+$/g,
      ""
    )
    .toUpperCase() ||
    "WAREHOUSE";
}


export default function WarehouseFinalizationActions({
  reportId,
  reportNumber,
  leaderName,
  submittedCount,
  reviewedCount,
  requiredCount,
}: Props) {
  const router =
    useRouter();

  const supabase =
    createClient();

  const [
    busy,
    setBusy,
  ] =
    useState(false);

  const [
    status,
    setStatus,
  ] =
    useState("");

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    pdfStoragePath,
    setPdfStoragePath,
  ] =
    useState<
      string | null
    >(null);

  const ready =
    Boolean(
      reportId
    ) &&
    requiredCount >
      0 &&
    reviewedCount ===
      requiredCount;


  // ==========================================================
  // RESTORE EXISTING FINALIZATION
  // ==========================================================

  useEffect(() => {
    if (!reportId) {
      return;
    }

    let cancelled =
      false;

    async function load() {
      try {
        const response =
          await fetch(
            `/api/operations/CLOSING_CK/finalize-warehouse?reportId=${encodeURIComponent(
              reportId!
            )}`,
            {
              cache:
                "no-store",
            }
          );

        const data =
          await response.json();

        if (
          cancelled ||
          !response.ok
        ) {
          return;
        }

        const existingPath =
          data
            ?.existingFinalization
            ?.pdf_storage_path;

        if (
          existingPath
        ) {
          setPdfStoragePath(
            existingPath
          );
        }
      } catch {
        // Passive restore only.
        // Finalize action performs
        // full error handling.
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [
    reportId,
  ]);


  // ==========================================================
  // LOAD FINALIZATION PAYLOAD
  // ==========================================================

  async function loadPayload() {
    if (!reportId) {
      throw new Error(
        "Warehouse report belum tersedia."
      );
    }

    const response =
      await fetch(
        `/api/operations/CLOSING_CK/finalize-warehouse?reportId=${encodeURIComponent(
          reportId
        )}`,
        {
          cache:
            "no-store",
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
        "Unable to prepare Warehouse report."
      );
    }

    if (
      !data
        ?.readyForFinalize
    ) {
      throw new Error(
        `Warehouse belum siap. Submitted ${data?.submittedCount ?? 0}/${data?.requiredCount ?? requiredCount}, Reviewed ${data?.reviewedCount ?? 0}/${data?.requiredCount ?? requiredCount}.`
      );
    }

    return data;
  }


  // ==========================================================
  // BUILD PDF
  // ==========================================================

  async function generateWarehousePdf(
    data: any
  ) {
    const sections:
      any[] =
      Array.isArray(
        data.sections
      )
        ? data.sections
        : [];

    if (
      sections.length !==
      requiredCount
    ) {
      throw new Error(
        `Warehouse PDF membutuhkan ${requiredCount} section. Ditemukan ${sections.length}.`
      );
    }


    const pdfGroups:
      Group[] = [];

    const pdfQuestions:
      Question[] = [];

    const pdfAnswers:
      Record<
        string,
        AnswerState
      > = {};


    const photoItems =
      sections.flatMap(
        (
          section: any
        ) =>
          (
            section.answers ??
            []
          ).filter(
            (
              answer: any
            ) =>
              Boolean(
                answer
                  .existingPhoto
                  ?.storagePath
              )
          )
      );

    const photoFileByStorageKey =
      new Map<
        string,
        File
      >();


    // Download evidence in a small worker pool.
    //
    // Four concurrent downloads is intentionally conservative:
    // significantly faster than 78 sequential requests while
    // remaining mobile-friendly on memory and network usage.
    if (
      photoItems.length
    ) {
      let nextPhotoIndex =
        0;

      let completedPhotos =
        0;

      const workerCount =
        Math.min(
          4,
          photoItems.length
        );


      async function photoWorker() {
        while (true) {
          const currentIndex =
            nextPhotoIndex;

          nextPhotoIndex +=
            1;

          if (
            currentIndex >=
            photoItems.length
          ) {
            return;
          }


          const saved =
            photoItems[
              currentIndex
            ];

          const photo =
            saved
              ?.existingPhoto;

          if (
            !photo
              ?.storagePath
          ) {
            continue;
          }


          const bucket =
            photo
              .storageBucket ||
            "operational-photos";

          const storageKey =
            `${bucket}:${photo.storagePath}`;


          const {
            data:
              photoBlob,
            error:
              photoError,
          } =
            await supabase
              .storage
              .from(
                bucket
              )
              .download(
                photo
                  .storagePath
              );


          if (
            photoError ||
            !photoBlob
          ) {
            throw new Error(
              `Unable to load photo evidence: ${
                photoError
                  ?.message ||
                photo
                  .storagePath
              }`
            );
          }


          const filename =
            photo
              .originalFilename ||
            `warehouse-photo-${currentIndex + 1}.jpg`;


          photoFileByStorageKey.set(
            storageKey,
            new File(
              [
                photoBlob,
              ],
              filename,
              {
                type:
                  photo
                    .mimeType ||
                  photoBlob.type ||
                  "image/jpeg",
              }
            )
          );


          completedPhotos +=
            1;

          setStatus(
            `Loading Warehouse photos ${completedPhotos} of ${photoItems.length}...`
          );
        }
      }


      await Promise.all(
        Array.from(
          {
            length:
              workerCount,
          },
          () =>
            photoWorker()
        )
      );
    }


    for (
      const section of
      sections
    ) {
      const sectionName =
        section.displayName ||
        section.name ||
        section.code ||
        "Section";

      const submitterName =
        section
          ?.submittedBy
          ?.name ||
        "Unknown";

      const sectionGroups:
        any[] =
        Array.isArray(
          section.groups
        )
          ? section.groups
          : [];

      const sectionQuestions:
        any[] =
        Array.isArray(
          section.questions
        )
          ? section.questions
          : [];

      const sectionAnswers:
        any[] =
        Array.isArray(
          section.answers
        )
          ? section.answers
          : [];


      // ------------------------------------------------------
      // Ungrouped questions
      // ------------------------------------------------------

      const hasUngrouped =
        sectionQuestions.some(
          (
            question: any
          ) =>
            !question
              .question_group_id
        );

      const generalGroupId =
        hasUngrouped
          ? `warehouse-general-${section.sectionId}`
          : null;

      if (
        generalGroupId
      ) {
        pdfGroups.push({
          id:
            generalGroupId,

          code:
            `${section.code || "SECTION"}-GENERAL`,

          name:
            `${sectionName} · PIC ${submitterName} · GENERAL`,

          description:
            null,

          sort_order:
            pdfGroups.length,
        });
      }


      // ------------------------------------------------------
      // Existing question groups
      //
      // Actual submitted PIC is embedded into each section
      // heading for audit visibility in the consolidated PDF.
      // ------------------------------------------------------

      for (
        const group of
        sectionGroups
      ) {
        pdfGroups.push({
          id:
            group.id,

          code:
            group.code ||
            "",

          name:
            `${sectionName} · PIC ${submitterName} · ${group.name}`,

          description:
            group.description ??
            null,

          sort_order:
            pdfGroups.length,
        });
      }


      // ------------------------------------------------------
      // Questions
      // ------------------------------------------------------

      for (
        const question of
        sectionQuestions
      ) {
        pdfQuestions.push({
          id:
            question.id,

          question_group_id:
            question
              .question_group_id ||
            generalGroupId,

          code:
            question.code,

          question_text:
            question
              .question_text,

          help_text:
            question.help_text ??
            null,

          question_type:
            question
              .question_type,

          is_required:
            Boolean(
              question.is_required
            ),

          unit:
            question.unit ??
            null,

          min_value:
            question.min_value ??
            null,

          max_value:
            question.max_value ??
            null,

          sort_order:
            question.sort_order ??
            0,

          config:
            question.config ??
            null,
        });
      }


      // ------------------------------------------------------
      // Answers + photo evidence
      // ------------------------------------------------------

      for (
        const saved of
        sectionAnswers
      ) {
        const answer:
          AnswerState = {
          notes:
            saved.notes ||
            "",

          correctiveAction:
            saved
              .correctiveAction ||
            "",
        };

        if (
          saved.value !==
            null &&
          saved.value !==
            undefined
        ) {
          answer.value =
            saved.value;
        }

        const photo =
          saved
            .existingPhoto;

        if (
          photo?.storagePath
        ) {
          const bucket =
            photo
              .storageBucket ||
            "operational-photos";

          const storageKey =
            `${bucket}:${photo.storagePath}`;

          const downloadedPhoto =
            photoFileByStorageKey.get(
              storageKey
            );

          if (
            !downloadedPhoto
          ) {
            throw new Error(
              `Warehouse photo was not prepared: ${photo.storagePath}`
            );
          }

          answer.photo =
            downloadedPhoto;
        }

        pdfAnswers[
          saved.questionId
        ] = answer;
      }
    }


    // ========================================================
    // PDF IDENTITY
    // ========================================================

    const parentReportNumber =
      String(
        data
          ?.report
          ?.reportNumber ||
        reportNumber ||
        "CK-REPORT"
      );

    const warehouseReportNumber =
      `${parentReportNumber}-WAREHOUSE`;

    setStatus(
      "Generating Final Warehouse PDF..."
    );

    const pdfBytes =
      await buildClosingPdf({
        reportNumber:
          warehouseReportNumber,

        outletName:
          data
            ?.outlet
            ?.name ||
          "Central Kitchen",

        submittedBy:
          `${leaderName} · Warehouse Leader`,

        reportArea:
          "CENTRAL KITCHEN - WAREHOUSE",

        reportBusinessDate:
          data
            ?.report
            ?.businessDate ||
          data
            ?.report
            ?.business_date ||
          undefined,

        reportTimestamp:
          data
            ?.existingFinalization
            ?.finalized_at ||
          undefined,

        groups:
          pdfGroups,

        questions:
          pdfQuestions,

        answers:
          pdfAnswers,
      });


    const pdfBlob =
      new Blob(
        [
          new Uint8Array(
            pdfBytes
          ),
        ],
        {
          type:
            "application/pdf",
        }
      );


    // ========================================================
    // AREA STORAGE PATH
    // ========================================================

    const filename =
      `${safeName(
        warehouseReportNumber
      )}.pdf`;

    const storagePath =
      `reports/${reportId}/area/warehouse/${filename}`;

    setStatus(
      "Saving Final Warehouse PDF..."
    );

    const {
      error:
        uploadError,
    } =
      await supabase.storage
        .from(
          "operational-reports"
        )
        .upload(
          storagePath,
          pdfBlob,
          {
            contentType:
              "application/pdf",

            cacheControl:
              "3600",

            upsert:
              true,
          }
        );

    if (
      uploadError
    ) {
      throw new Error(
        `Warehouse PDF upload gagal: ${uploadError.message}`
      );
    }

    return storagePath;
  }


  // ==========================================================
  // FINALIZE
  // ==========================================================

  async function finalizeWarehouse() {
    if (
      !ready ||
      !reportId ||
      busy
    ) {
      return;
    }

    try {
      setBusy(true);
      setErrorMessage("");
      setStatus(
        `Checking ${requiredCount} Warehouse sections...`
      );

      const data =
        await loadPayload();

      const storagePath =
        await generateWarehousePdf(
          data
        );

      setStatus(
        "Finalizing Warehouse..."
      );

      const response =
        await fetch(
          "/api/operations/CLOSING_CK/finalize-warehouse",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                reportId,
                pdfStoragePath:
                  storagePath,
              }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
          "Finalize Warehouse gagal."
        );
      }

      setPdfStoragePath(
        storagePath
      );

      setStatus(
        "Warehouse finalized successfully."
      );

      router.refresh();

    } catch (
      error: any
    ) {
      console.error(
        "Warehouse finalization failed:",
        error
      );

      setErrorMessage(
        error?.message ||
        "Finalize Warehouse gagal."
      );

      setStatus("");
    } finally {
      setBusy(false);
    }
  }


  // ==========================================================
  // FILE ACTIONS
  // ==========================================================

  async function getPdfFile() {
    if (
      !pdfStoragePath
    ) {
      throw new Error(
        "Warehouse PDF belum tersedia."
      );
    }

    const {
      data,
      error,
    } =
      await supabase.storage
        .from(
          "operational-reports"
        )
        .download(
          pdfStoragePath
        );

    if (
      error ||
      !data
    ) {
      throw new Error(
        error?.message ||
        "Unable to download Warehouse PDF."
      );
    }

    const filename =
      pdfStoragePath
        .split("/")
        .pop() ||
      `${reportNumber || "CK"}-WAREHOUSE.pdf`;

    return new File(
      [
        data,
      ],
      filename,
      {
        type:
          "application/pdf",
      }
    );
  }


  async function downloadPdf() {
    try {
      setBusy(true);

      const file =
        await getPdfFile();

      const url =
        URL.createObjectURL(
          file
        );

      const anchor =
        document.createElement(
          "a"
        );

      anchor.href =
        url;

      anchor.download =
        file.name;

      document.body
        .appendChild(
          anchor
        );

      anchor.click();
      anchor.remove();

      URL.revokeObjectURL(
        url
      );
    } catch (
      error: any
    ) {
      setErrorMessage(
        error?.message ||
        "Download PDF gagal."
      );
    } finally {
      setBusy(false);
    }
  }


  function formatWarehouseDate(
    value: unknown,
    timeZone: string
  ) {
    if (!value) {
      return "-";
    }

    const date =
      new Date(
        String(value)
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return String(value);
    }

    return new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone,
        day:
          "numeric",
        month:
          "long",
        year:
          "numeric",
      }
    ).format(
      date
    );
  }


  function formatWarehouseTime(
    value: unknown,
    timeZone: string
  ) {
    if (!value) {
      return "-";
    }

    const date =
      new Date(
        String(value)
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return "-";
    }

    return new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone,
        hour:
          "2-digit",
        minute:
          "2-digit",
        timeZoneName:
          "short",
      }
    ).format(
      date
    );
  }


  function formatAnswerValue(
    value: unknown
  ) {
    if (
      value === true
    ) {
      return "YES";
    }

    if (
      value === false
    ) {
      return "NO";
    }

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "OUT OF STANDARD";
    }

    return String(
      value
    );
  }


  function getPdfShareUrl(
    _finalizationId: unknown
  ) {
    // Public Warehouse PDF URL is intentionally disabled in V1.
    return null;
  }


  async function buildWarehouseSummary() {
    const data =
      await loadPayload();

    const sections =
      Array.isArray(
        data?.sections
      )
        ? data.sections
        : [];

    const existingFinalization =
      data
        ?.existingFinalization ??
      null;

    const finalizedAt =
      existingFinalization
        ?.finalized_at ||
      new Date()
        .toISOString();

    const businessDate =
      data
        ?.report
        ?.businessDate ||
      data
        ?.report
        ?.business_date ||
      finalizedAt;

    const outletName =
      data
        ?.outlet
        ?.name ||
      "CQ Central";

    const outletTimeZone =
      String(
        data
          ?.outlet
          ?.timezone ||
        "Asia/Jakarta"
      ).trim() ||
      "Asia/Jakarta";

    const baseReportNumber =
      String(
        data
          ?.report
          ?.reportNumber ||
        data
          ?.report
          ?.report_number ||
        reportNumber ||
        "-"
      );

    const finalReportNumber =
      baseReportNumber
        .endsWith(
          "-WAREHOUSE"
        )
        ? baseReportNumber
        : `${baseReportNumber}-WAREHOUSE`;


    let totalChecklist =
      0;

    let totalAnswered =
      0;

    let totalPhotos =
      0;

    let totalIssues =
      0;


    const sectionSummaries:
      string[] = [];

    const followUps:
      string[] = [];

    const maxSummaryIssues =
      3;

    let followUpCount =
      0;


    for (
      const section of
      sections
    ) {
      const questions =
        Array.isArray(
          section
            ?.questions
        )
          ? section.questions
          : [];

      const answers =
        Array.isArray(
          section
            ?.answers
        )
          ? section.answers
          : [];

      const sectionName =
        String(
          section
            ?.displayName ||
          section
            ?.name ||
          section
            ?.code ||
          "Section"
        );

      const sectionPhotos =
        answers.filter(
          (
            answer: any
          ) =>
            Boolean(
              answer
                ?.existingPhoto
                ?.storagePath
            )
        ).length;

      const sectionIssues =
        answers.filter(
          (
            answer: any
          ) =>
            answer
              ?.isCompliant ===
            false
        ).length;


      totalChecklist +=
        questions.length;

      totalAnswered +=
        answers.length;

      totalPhotos +=
        sectionPhotos;

      totalIssues +=
        sectionIssues;


      sectionSummaries.push(
        `*${sectionName}*`
      );

      sectionSummaries.push(
        sectionIssues > 0
          ? `${answers.length}/${questions.length} Checklist • ${sectionPhotos} Photos • ⚠️ ${sectionIssues} ${
              sectionIssues === 1
                ? "Issue"
                : "Issues"
            }`
          : `${answers.length}/${questions.length} Checklist • ${sectionPhotos} Photos • ✅ No Issue`
      );

      sectionSummaries.push(
        `Submitted by: ${
          section
            ?.submittedBy
            ?.name ||
          "-"
        }`
      );

      sectionSummaries.push(
        ""
      );


      const questionById =
        new Map<
          string,
          any
        >();

      for (
        const question of
        questions
      ) {
        if (
          question?.id
        ) {
          questionById.set(
            question.id,
            question
          );
        }
      }


      for (
        const answer of
        answers
      ) {
        if (
          answer
            ?.isCompliant !==
          false
        ) {
          continue;
        }

        const question =
          questionById.get(
            answer
              ?.questionId
          );

        followUpCount +=
          1;

        if (
          followUpCount >
          maxSummaryIssues
        ) {
          continue;
        }

        followUps.push(
          `${followUpCount}. *${sectionName}*`
        );

        followUps.push(
          `${
            question
              ?.question_text ||
            question
              ?.questionText ||
            "Checklist item"
          }`
        );

        followUps.push(
          `❌ ${formatAnswerValue(
            answer?.value
          )} / OUT OF STANDARD`
        );

        if (
          String(
            answer
              ?.notes ||
            ""
          ).trim()
        ) {
          followUps.push(
            `📝 Notes: ${String(
              answer.notes
            ).trim()}`
          );
        }

        if (
          String(
            answer
              ?.correctiveAction ||
            ""
          ).trim()
        ) {
          followUps.push(
            `🔧 Corrective: ${String(
              answer
                .correctiveAction
            ).trim()}`
          );
        }

        followUps.push(
          ""
        );
      }
    }


    const pdfShareUrl =
      getPdfShareUrl(
        existingFinalization
          ?.id
      );


    const lines:
      string[] = [
        "*CENTRAL KITCHEN CLOSING REPORT*",
        "",
        `📍 ${outletName}`,
        `📅 ${formatWarehouseDate(
            businessDate,
            outletTimeZone
          )} • ⏰ ${formatWarehouseTime(
            finalizedAt,
            outletTimeZone
          )}`,
        `👤 ${leaderName} • Warehouse Leader`,
        `🏭 Warehouse • ✅ ${reviewedCount}/${requiredCount} Reviewed`,
        "",
        "*📊 OVERALL RESULT*",
        `✅ Checklist: ${totalAnswered}/${totalChecklist}`,
        `📷 Photo Evidence: ${totalPhotos}`,
        `⚠️ Issues: ${totalIssues}`,
        `📋 Sections: ${reviewedCount}/${requiredCount}`,
        "🟢 Status: FINALIZED",
        "",
        "*📌 SECTION PERFORMANCE*",
        ...sectionSummaries,
      ];



    if (
      followUps.length
    ) {
      lines.push(
        "",
        `*⚠️ ACTION REQUIRED — ${totalIssues} ${
          totalIssues === 1
            ? "ISSUE"
            : "ISSUES"
        }*`,
        ...followUps
      );

      if (
        totalIssues >
        maxSummaryIssues
      ) {
        lines.push(
          `... + ${
            totalIssues -
            maxSummaryIssues
          } additional issues.`,
          "See full PDF report for complete details."
        );
      }
    } else {
      lines.push(
        "",
        "*✅ ACTION REQUIRED*",
        "No outstanding issues."
      );
    }


    lines.push(
      "",
      "*📄 REPORT INFO*",
      "Report ID:",
      finalReportNumber
    );


    if (
      pdfShareUrl
    ) {
      lines.push(
        "",
        "🔗 PDF Report:",
        pdfShareUrl,
        "",
        "⏳ Link valid for 7 days after finalization."
      );
    }


    lines.push(
      "",
      "✅ *WAREHOUSE FINALIZED*"
    );


    return lines.join(
      "\n"
    );
  }


  async function sharePdf() {
    try {
      setBusy(true);

      setErrorMessage("");

      setStatus(
        "Preparing PDF + summary..."
      );


      const [
        file,
        summary,
      ] =
        await Promise.all([
          getPdfFile(),
          buildWarehouseSummary(),
        ]);


      // Copy first as a fallback.
      //
      // Some mobile/browser + WhatsApp combinations accept the
      // PDF file but omit the text/caption from navigator.share.
      // In that situation the exact same summary is already
      // available in clipboard and can simply be pasted.
      let summaryCopied =
        false;

      try {
        await navigator
          .clipboard
          .writeText(
            summary
          );

        summaryCopied =
          true;
      } catch (
        clipboardError
      ) {
        console.warn(
          "Unable to pre-copy Warehouse summary:",
          clipboardError
        );
      }


      if (
        navigator.share &&
        (
          !navigator.canShare ||
          navigator.canShare({
            files: [
              file,
            ],
          })
        )
      ) {
        const isMobileShare =
          typeof window !== "undefined" &&
          (
            window.matchMedia(
              "(pointer: coarse)"
            ).matches ||
            /Android|iPhone|iPad|iPod/i.test(
              navigator.userAgent
            )
          );


        if (
          isMobileShare
        ) {
          await navigator.share({
            title:
              "Central Kitchen Closing",

            text:
              summary,

            files: [
              file,
            ],
          });

          setStatus(
            summaryCopied
              ? "PDF + summary shared. Jika caption tidak ikut di WhatsApp, summary sudah dicopy dan tinggal paste."
              : "PDF + summary shared."
          );
        } else {
          // Native desktop share on macOS/WhatsApp has been
          // observed to duplicate the PDF attachment.
          //
          // Use deterministic desktop behavior instead:
          // download exactly one PDF and keep the summary
          // ready in clipboard.
          const url =
            URL.createObjectURL(
              file
            );

          const anchor =
            document.createElement(
              "a"
            );

          anchor.href =
            url;

          anchor.download =
            file.name;

          document.body.appendChild(
            anchor
          );

          anchor.click();

          anchor.remove();

          window.setTimeout(
            () => {
              URL.revokeObjectURL(
                url
              );
            },
            1000
          );

          setStatus(
            summaryCopied
              ? "PDF downloaded. Summary sudah dicopy — tinggal paste ke WhatsApp."
              : "PDF downloaded."
          );
        }

        return;
      }


      throw new Error(
        "File sharing tidak didukung browser ini. Gunakan WhatsApp atau Download PDF."
      );

    } catch (
      error: any
    ) {
      if (
        error?.name !==
        "AbortError"
      ) {
        setErrorMessage(
          error?.message ||
            "Share PDF + Summary gagal."
        );
      }

    } finally {
      setBusy(false);
    }
  }


  async function shareWhatsApp() {
    try {
      setBusy(true);

      setErrorMessage("");

      setStatus(
        "Preparing WhatsApp summary..."
      );


      const summary =
        await buildWarehouseSummary();

      const whatsappUrl =
        `https://wa.me/?text=${encodeURIComponent(
          summary
        )}`;


      window.location.assign(
        whatsappUrl
      );

    } catch (
      error: any
    ) {
      setErrorMessage(
        error?.message ||
          "Unable to open WhatsApp."
      );

      setStatus("");

    } finally {
      setBusy(false);
    }
  }


  async function copySummary() {
    try {
      setBusy(true);

      setErrorMessage("");


      const text =
        await buildWarehouseSummary();


      await navigator
        .clipboard
        .writeText(
          text
        );


      setStatus(
        "Warehouse summary copied."
      );

    } catch (
      error: any
    ) {
      setErrorMessage(
        error?.message ||
          "Copy summary gagal."
      );

    } finally {
      setBusy(false);
    }
  }


  async function regenerateWarehousePdf() {
    if (
      !reportId ||
      busy
    ) {
      return;
    }

    try {
      setBusy(true);
      setErrorMessage("");

      setStatus(
        "Preparing Warehouse report..."
      );

      const data =
        await loadPayload();

      const storagePath =
        await generateWarehousePdf(
          data
        );

      setStatus(
        "Updating Final Warehouse PDF..."
      );

      const response =
        await fetch(
          "/api/operations/CLOSING_CK/finalize-warehouse",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify({
                reportId,
                pdfStoragePath:
                  storagePath,
                regeneratePdf:
                  true,
              }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Regenerate Warehouse PDF gagal."
        );
      }

      setPdfStoragePath(
        storagePath
      );

      setStatus(
        "Final Warehouse PDF regenerated successfully."
      );

      router.refresh();
    } catch (
      error: any
    ) {
      console.error(
        "Warehouse PDF regeneration failed:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Regenerate Warehouse PDF gagal."
      );

      setStatus("");
    } finally {
      setBusy(false);
    }
  }


  // ==========================================================
  // FINALIZED STATE
  // ==========================================================

  if (
    pdfStoragePath
  ) {
    return (
      <div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
            ✓ Warehouse Finalized
          </p>

          <p className="mt-1 text-xs font-semibold text-neutral-600">
            Final Warehouse PDF is ready.
          </p>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            disabled={
              busy
            }
            onClick={
              shareWhatsApp
            }
            className="rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
          >
            WhatsApp
          </button>

          <button
            type="button"
            disabled={
              busy
            }
            onClick={
              sharePdf
            }
            className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs font-black text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            Share PDF + Summary
          </button>

          <button
            type="button"
            disabled={
              busy
            }
            onClick={
              downloadPdf
            }
            className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs font-black text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            Download PDF
          </button>

          <button
            type="button"
            disabled={
              busy
            }
            onClick={
              copySummary
            }
            className="rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs font-black text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-50"
          >
            Copy Summary
          </button>
          <button
            type="button"
            disabled={
              busy
            }
            onClick={
              regenerateWarehousePdf
            }
            className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs font-black text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 sm:col-span-2"
          >
            {busy
              ? "Processing..."
              : "Regenerate Final PDF"}
          </button>
        </div>

        {status && (
          <p className="mt-2 text-center text-[11px] font-semibold text-emerald-700">
            {status}
          </p>
        )}

        {errorMessage && (
          <p className="mt-2 text-center text-[11px] font-semibold text-red-600">
            {errorMessage}
          </p>
        )}
      </div>
    );
  }


  // ==========================================================
  // NOT FINALIZED
  // ==========================================================

  return (
    <div>
      <button
        type="button"
        disabled={
          !ready ||
          busy
        }
        onClick={
          finalizeWarehouse
        }
        className={`flex w-full items-center justify-center rounded-xl px-4 py-3.5 text-xs font-black uppercase tracking-wide transition ${
          ready &&
          !busy
            ? "bg-red-700 text-white hover:bg-red-800"
            : "cursor-not-allowed bg-neutral-200 text-neutral-500"
        }`}
      >
        {busy
          ? "Processing..."
          : "Finalize Warehouse"}
      </button>

      <p className="mt-2 text-center text-[11px] font-semibold text-neutral-400">
        {ready
          ? `${requiredCount}/${requiredCount} sections reviewed. Warehouse is ready to finalize.`
          : submittedCount < requiredCount
            ? `${Math.max(
                0,
                requiredCount -
                submittedCount
              )} section${
                requiredCount -
                  submittedCount ===
                1
                  ? ""
                  : "s"
              } belum submitted.`
            : `${Math.max(
                0,
                requiredCount -
                reviewedCount
              )} section${
                requiredCount -
                  reviewedCount ===
                1
                  ? ""
                  : "s"
              } belum direview oleh Warehouse Leader.`}
      </p>

      {status && (
        <p className="mt-2 text-center text-[11px] font-semibold text-neutral-600">
          {status}
        </p>
      )}

      {errorMessage && (
        <p className="mt-2 text-center text-[11px] font-semibold text-red-600">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
