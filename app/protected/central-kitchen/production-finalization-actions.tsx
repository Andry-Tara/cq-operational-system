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
    "PRODUCTION"
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
    "PRODUCTION";
}


export default function ProductionFinalizationActions({
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
    requiredCount ===
      7 &&
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
            `/api/operations/CLOSING_CK/finalize-production?reportId=${encodeURIComponent(
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
        "Production report belum tersedia."
      );
    }

    const response =
      await fetch(
        `/api/operations/CLOSING_CK/finalize-production?reportId=${encodeURIComponent(
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
        "Unable to prepare Production report."
      );
    }

    if (
      !data
        ?.readyForFinalize
    ) {
      throw new Error(
        `Production belum siap. Submitted ${data?.submittedCount ?? 0}/${data?.requiredCount ?? 7}, Reviewed ${data?.reviewedCount ?? 0}/${data?.requiredCount ?? 7}.`
      );
    }

    return data;
  }


  // ==========================================================
  // BUILD PDF
  // ==========================================================

  async function generateProductionPdf(
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
      7
    ) {
      throw new Error(
        `Production PDF membutuhkan 7 section. Ditemukan ${sections.length}.`
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

    let photoIndex =
      0;


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
          ? `production-general-${section.sectionId}`
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
          photoIndex +=
            1;

          setStatus(
            `Loading Production photo ${photoIndex} of ${photoItems.length}...`
          );

          const bucket =
            photo
              .storageBucket ||
            "operational-photos";

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
            `production-photo-${photoIndex}.jpg`;

          answer.photo =
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
            );
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

    const productionReportNumber =
      `${parentReportNumber}-PRODUCTION`;

    setStatus(
      "Generating Final Production PDF..."
    );

    const pdfBytes =
      await buildClosingPdf({
        reportNumber:
          productionReportNumber,

        outletName:
          data
            ?.outlet
            ?.name ||
          "Central Kitchen",

        submittedBy:
          `${leaderName} · Production Leader`,

        reportArea:
          "CENTRAL KITCHEN - PRODUCTION",

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
        productionReportNumber
      )}.pdf`;

    const storagePath =
      `reports/${reportId}/area/production/${filename}`;

    setStatus(
      "Saving Final Production PDF..."
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
        `Production PDF upload gagal: ${uploadError.message}`
      );
    }

    return storagePath;
  }


  // ==========================================================
  // FINALIZE
  // ==========================================================

  async function finalizeProduction() {
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
        "Checking 7 Production sections..."
      );

      const data =
        await loadPayload();

      const storagePath =
        await generateProductionPdf(
          data
        );

      setStatus(
        "Finalizing Production..."
      );

      const response =
        await fetch(
          "/api/operations/CLOSING_CK/finalize-production",
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
          "Finalize Production gagal."
        );
      }

      setPdfStoragePath(
        storagePath
      );

      setStatus(
        "Production finalized successfully."
      );

      router.refresh();

    } catch (
      error: any
    ) {
      console.error(
        "Production finalization failed:",
        error
      );

      setErrorMessage(
        error?.message ||
        "Finalize Production gagal."
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
        "Production PDF belum tersedia."
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
        "Unable to download Production PDF."
      );
    }

    const filename =
      pdfStoragePath
        .split("/")
        .pop() ||
      `${reportNumber || "CK"}-PRODUCTION.pdf`;

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


  function formatProductionDate(
    value: unknown
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
        timeZone:
          "Asia/Jakarta",
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


  function formatProductionTime(
    value: unknown
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

    return `${new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone:
          "Asia/Jakarta",
        hour:
          "2-digit",
        minute:
          "2-digit",
      }
    ).format(
      date
    )} WIB`;
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


  async function getPdfSignedUrl() {
    if (
      !pdfStoragePath
    ) {
      return null;
    }

    const {
      data,
      error,
    } =
      await supabase
        .storage
        .from(
          "operational-reports"
        )
        .createSignedUrl(
          pdfStoragePath,
          60 * 60 * 24 * 7
        );


    if (
      error ||
      !data?.signedUrl
    ) {
      console.warn(
        "Unable to create Production PDF signed URL:",
        error
      );

      return null;
    }


    return data.signedUrl;
  }


  async function buildProductionSummary() {
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
          "-PRODUCTION"
        )
        ? baseReportNumber
        : `${baseReportNumber}-PRODUCTION`;


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
        `- ${sectionName}: ${answers.length}/${questions.length} | Photos: ${sectionPhotos} | Issues: ${sectionIssues}`
      );

      sectionSummaries.push(
        `  Submitted by: ${
          section
            ?.submittedBy
            ?.name ||
          "-"
        }`
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

        const number =
          followUps.length +
          1;

        followUps.push(
          `${number}. ${sectionName} — ${
            question
              ?.question_text ||
            question
              ?.questionText ||
            "Checklist item"
          }`
        );

        followUps.push(
          `   ❌ ${formatAnswerValue(
            answer?.value
          )}`
        );

        if (
          String(
            answer
              ?.notes ||
            ""
          ).trim()
        ) {
          followUps.push(
            `   Notes: ${String(
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
            `   Corrective: ${String(
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


    const pdfSignedUrl =
      await getPdfSignedUrl();


    const lines:
      string[] = [
        "*CENTRAL KITCHEN CLOSING*",
        "",
        `📍 Outlet: ${outletName}`,
        `👤 Production Leader: ${leaderName}`,
        "🏭 Area: PRODUCTION",
        `📅 Date: ${formatProductionDate(
          businessDate
        )}`,
        `⏰ Finalized: ${formatProductionTime(
          finalizedAt
        )}`,
        `🏷️ Sections Reviewed: ${reviewedCount}/${requiredCount}`,
        "",
        "*OVERALL SUMMARY*",
        `- Total Checklist: ${totalAnswered}/${totalChecklist}`,
        `- Photo Evidence: ${totalPhotos}`,
        `- Issues: ${totalIssues}`,
        "- Status: FINALIZED",
        "",
        "*SECTION SUMMARY*",
        ...sectionSummaries,
      ];


    if (
      followUps.length
    ) {
      lines.push(
        "",
        "*FOLLOW-UP REQUIRED*",
        ...followUps
      );
    } else {
      lines.push(
        "",
        "*FOLLOW-UP REQUIRED*",
        "- No outstanding issues."
      );
    }


    lines.push(
      "",
      "*REPORT INFO*",
      `- Report ID: ${finalReportNumber}`,
      `- Production Leader: ${leaderName}`,
      `- Sections: ${reviewedCount}/${requiredCount}`
    );


    if (
      pdfSignedUrl
    ) {
      lines.push(
        `- PDF (valid 7 days): ${pdfSignedUrl}`
      );
    }


    lines.push(
      "",
      "✅ *PRODUCTION FINALIZED*"
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
          buildProductionSummary(),
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
          "Unable to pre-copy Production summary:",
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
        await buildProductionSummary();

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
        await buildProductionSummary();


      await navigator
        .clipboard
        .writeText(
          text
        );


      setStatus(
        "Production summary copied."
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
            ✓ Production Finalized
          </p>

          <p className="mt-1 text-xs font-semibold text-neutral-600">
            Final Production PDF is ready.
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
          finalizeProduction
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
          : "Finalize Production"}
      </button>

      <p className="mt-2 text-center text-[11px] font-semibold text-neutral-400">
        {ready
          ? "7/7 sections reviewed. Production is ready to finalize."
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
              } belum direview oleh Production Leader.`}
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
