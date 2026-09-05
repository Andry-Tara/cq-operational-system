"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  persistOperationalDraftPhoto,
  useOperationalDraftAutosave,
} from "@/lib/operations/use-operational-draft-autosave";

import {
  compressOperationalPhoto,
} from "@/lib/operations/compress-operational-photo";
import { buildClosingPdf } from "@/lib/pdf/closing-report";

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
  config: Record<string, any> | null;
};

type AnswerState = {
  value?: boolean | number | string;

  notes?: string;

  correctiveAction?: string;

  // New / replacement photo selected by user
  photo?: File;

  // Existing photo from saved report
  existingStoragePath?: string;

  existingStorageBucket?: string;

  existingOriginalFilename?: string | null;

  existingMimeType?: string | null;

  existingFileSize?: number | null;

  // Existing photo downloaded from Storage.
  // Used for PDF regeneration and preview.
  existingPhotoFile?: File;

  photoSaveStatus?:
    | "optimizing"
    | "uploading"
    | "saved"
    | "error";

  photoSaveError?: string;
};

type SubmitResult = {
  reportNumber: string;
  submittedAt: string;
  answerCount: number;
  photoCount: number;
  issueCount: number;
  completed: boolean;
  pdfStoragePath: string;
};



function PhotoEvidencePreview({
  file,
  label,
}: {
  file?: File;
  label: string;
}) {
  const [previewUrl, setPreviewUrl] =
    useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const url =
      URL.createObjectURL(file);

    setPreviewUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  if (!previewUrl) {
    return null;
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-white">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-neutral-100">
        <img
          src={previewUrl}
          alt={label}
          className="h-full w-full object-contain"
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-neutral-100 px-4 py-3">
        <p className="truncate text-xs font-medium text-neutral-500">
          {file?.name ?? ""}
        </p>

        <span className="shrink-0 text-xs font-bold text-emerald-700">
          {label}
        </span>
      </div>
    </div>
  );
}

function ProgressSummaryItem({
  label,
  value,
  complete,
}: {
  label: string;
  value: string;
  complete: boolean;
}) {
  return (
    <div className="text-neutral-900">
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">
        {label}
      </p>

      <div className="mt-2 flex items-center gap-3">
        <span className="text-3xl font-bold tracking-tight text-neutral-900">
          {value}
        </span>

        {complete && (
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            COMPLETE
          </span>
        )}
      </div>
    </div>
  );
}

export default function ClosingKitchenClient({
  outlet,
  groups,
  questions,
}: {
  outlet: {
    id: string;
    code: string;
    name: string;
  };
  groups: Group[];
  questions: Question[];
}) {
  const supabase = createClient();

  const [answers, setAnswers] =
    useState<Record<string, AnswerState>>({});

  const [submitting, setSubmitting] =
    useState(false);

  const [submitStatus, setSubmitStatus] =
    useState("");

  const [errorMessage, setErrorMessage] =
    useState("");

  const [result, setResult] =
    useState<SubmitResult | null>(null);

  const [sessionData, setSessionData] =
    useState<any>(null);

  const [loadingExisting, setLoadingExisting] =
    useState(true);

  const photoUploadTokenRef =
    useRef<Record<string, string>>({});

  const photoPersistQueueRef =
    useRef<Promise<void>>(
      Promise.resolve()
    );

  const isReopenedDraftSession =
    Boolean(
      sessionData?.isReopened
    ) ||
    String(
      sessionData?.reportStatus ||
      sessionData?.status ||
      ""
    ).toLowerCase() ===
      "reopened";

  const {
    draftStatus,
  } =
    useOperationalDraftAutosave({
      supabase,
      reportId:
        sessionData?.reportId,
      answers,
      setAnswers,
      enabled:
        !loadingExisting &&
        Boolean(
          sessionData?.reportId
        ) &&
        !submitting &&
        !result &&
        !isReopenedDraftSession,
    });


  // ==========================================================
  // LOAD / RESUME EXISTING REPORT
  // ==========================================================

  useEffect(() => {
    let cancelled = false;

    async function loadExistingReport() {
      try {
        setLoadingExisting(true);
        setErrorMessage("");

        const response =
          await fetch(
            "/api/closing/kitchen/session",
            {
              method: "POST",
              cache: "no-store",
            }
          );

        const session =
          await response.json();

        if (!response.ok) {
          throw new Error(
            session.error ||
              "Unable to load Closing session"
          );
        }

        if (cancelled) return;

        setSessionData(session);

        const loadedAnswers:
          Record<string, AnswerState> = {};

        for (
          const saved of
          session.existingAnswers ?? []
        ) {
          const nextAnswer:
            AnswerState = {
              value:
                saved.value,

              notes:
                saved.notes || "",

              correctiveAction:
                saved.correctiveAction || "",
            };

          if (
            saved.existingPhoto
              ?.storagePath
          ) {
            nextAnswer.existingStoragePath =
              saved.existingPhoto.storagePath;

            nextAnswer.existingStorageBucket =
              saved.existingPhoto.storageBucket ||
              "operational-photos";

            nextAnswer.existingOriginalFilename =
              saved.existingPhoto.originalFilename;

            nextAnswer.existingMimeType =
              saved.existingPhoto.mimeType;

            nextAnswer.existingFileSize =
              saved.existingPhoto.fileSize;

            const {
              data: photoBlob,
              error: photoError,
            } = await supabase.storage
              .from(
                saved.existingPhoto
                  .storageBucket ||
                  "operational-photos"
              )
              .download(
                saved.existingPhoto
                  .storagePath
              );

            if (
              !photoError &&
              photoBlob
            ) {
              const filename =
                saved.existingPhoto
                  .originalFilename ||
                "existing-photo.jpg";

              nextAnswer.existingPhotoFile =
                new File(
                  [photoBlob],
                  filename,
                  {
                    type:
                      saved.existingPhoto
                        .mimeType ||
                      photoBlob.type ||
                      "image/jpeg",
                  }
                );
            }
          }

          loadedAnswers[
            saved.questionId
          ] = nextAnswer;
        }

        if (!cancelled) {
          setAnswers(
            loadedAnswers
          );
        }
      } catch (error: any) {
        if (!cancelled) {
          setErrorMessage(
            error?.message ||
              "Unable to resume report."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingExisting(false);
        }
      }
    }

    loadExistingReport();

    return () => {
      cancelled = true;
    };
  }, []);


  function setQuestionValue(
    questionId: string,
    value: boolean | number | string
  ) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        value,
      },
    }));
  }

  function setExtraField(
    questionId: string,
    field: "notes" | "correctiveAction",
    value: string
  ) {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value,
      },
    }));
  }

  async function setPhoto(
    questionId: string,
    file?: File
  ) {
    if (!file) {
      return;
    }

    // Reopened reports tetap memakai
    // replacement flow lama yang stabil.
    if (isReopenedDraftSession) {
      setAnswers((prev) => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          photo: file,
        },
      }));

      return;
    }

    const reportId =
      sessionData?.reportId;

    const reportSectionId =
      sessionData?.reportSectionId;

    const question =
      questions.find(
        (item) =>
          item.id === questionId
      );

    if (
      !reportId ||
      !reportSectionId ||
      !question
    ) {
      setErrorMessage(
        "Draft session belum siap. Tunggu sebentar lalu ambil foto kembali."
      );

      return;
    }

    const previousStoragePath =
      answers[questionId]
        ?.existingStoragePath;

    const token =
      crypto.randomUUID();

    photoUploadTokenRef
      .current[questionId] =
        token;

    // Foto langsung tampil di UI.
    setAnswers((prev) => ({
      ...prev,

      [questionId]: {
        ...prev[questionId],

        photo: file,

        photoSaveStatus:
          "optimizing",

        photoSaveError:
          undefined,
      },
    }));

    try {
      // ===============================================
      // STEP 1 — COMPRESS
      // ===============================================

      const optimizedFile =
        await compressOperationalPhoto(
          file
        );

      if (
        photoUploadTokenRef
          .current[questionId] !==
        token
      ) {
        return;
      }

      setAnswers((prev) => ({
        ...prev,

        [questionId]: {
          ...prev[questionId],

          photo:
            optimizedFile,

          photoSaveStatus:
            "uploading",
        },
      }));


      // ===============================================
      // STEP 2 — STORAGE PATH
      // ===============================================

      const extension =
        optimizedFile.name
          .split(".")
          .pop()
          ?.toLowerCase() ||
        "jpg";

      const safeCode =
        question.code
          .replace(
            /[^a-zA-Z0-9_-]/g,
            "-"
          )
          .toLowerCase();

      const storagePath =
        `report-sections/${reportSectionId}/` +
        `${safeCode}/` +
        `draft-${crypto.randomUUID()}.${extension}`;


      // ===============================================
      // STEP 3 — BACKGROUND UPLOAD
      // ===============================================

      const {
        error:
          uploadError,
      } =
        await supabase.storage
          .from(
            "operational-photos"
          )
          .upload(
            storagePath,
            optimizedFile,
            {
              cacheControl:
                "3600",

              upsert:
                false,

              contentType:
                optimizedFile.type ||
                undefined,
            }
          );

      if (uploadError) {
        throw uploadError;
      }


      // Foto sudah diganti user sebelum
      // upload sebelumnya selesai.
      if (
        photoUploadTokenRef
          .current[questionId] !==
        token
      ) {
        await supabase.storage
          .from(
            "operational-photos"
          )
          .remove([
            storagePath,
          ]);

        return;
      }


      // ===============================================
      // STEP 4 — SAVE DRAFT METADATA
      // ===============================================

      const metadata = {
        storageBucket:
          "operational-photos",

        storagePath,

        originalFilename:
          file.name,

        mimeType:
          optimizedFile.type ||
          file.type ||
          null,

        fileSize:
          optimizedFile.size ||
          null,
      };


      // Serialize JSONB updates so two photos
      // selected quickly do not overwrite
      // each other's draft metadata.
      const persistPromise =
        photoPersistQueueRef
          .current
          .catch(() => {
            // Keep queue alive.
          })
          .then(() =>
            persistOperationalDraftPhoto({
              supabase,
              reportId,
              questionId,
              photo:
                metadata,
            })
          );

      photoPersistQueueRef.current =
        persistPromise;

      try {
        await persistPromise;
      } catch (
        metadataError
      ) {
        // Storage succeeded but metadata failed.
        // Remove orphan draft file.
        await supabase.storage
          .from(
            "operational-photos"
          )
          .remove([
            storagePath,
          ]);

        throw metadataError;
      }


      if (
        photoUploadTokenRef
          .current[questionId] !==
        token
      ) {
        return;
      }


      // ===============================================
      // STEP 5 — CLEAN OLD DRAFT REPLACEMENT
      // ===============================================

      if (
        previousStoragePath &&
        previousStoragePath !==
          storagePath &&
        previousStoragePath
          .split("/")
          .pop()
          ?.startsWith(
            "draft-"
          )
      ) {
        await supabase.storage
          .from(
            "operational-photos"
          )
          .remove([
            previousStoragePath,
          ]);
      }


      // ===============================================
      // STEP 6 — SUCCESS
      //
      // photo = undefined means final Submit
      // does not need to upload it again.
      //
      // existingStoragePath now points to
      // already-uploaded Storage photo.
      // ===============================================

      setAnswers((prev) => ({
        ...prev,

        [questionId]: {
          ...prev[questionId],

          photo:
            undefined,

          existingStorageBucket:
            metadata.storageBucket,

          existingStoragePath:
            metadata.storagePath,

          existingOriginalFilename:
            metadata.originalFilename,

          existingMimeType:
            metadata.mimeType,

          existingFileSize:
            metadata.fileSize,

          existingPhotoFile:
            optimizedFile,

          photoSaveStatus:
            "saved",

          photoSaveError:
            undefined,
        },
      }));

    } catch (error: any) {
      console.warn(
        "Background photo save failed:",
        error
      );

      // Background upload gagal:
      // foto lokal tetap disimpan.
      //
      // Final Submit lama masih dapat
      // meng-upload foto ini sebagai fallback.
      setAnswers((prev) => ({
        ...prev,

        [questionId]: {
          ...prev[questionId],

          photo:
            file,

          photoSaveStatus:
            "error",

          photoSaveError:
            error?.message ||
            "Photo belum tersimpan.",
        },
      }));
    }
  }

  function isAnswered(
    question: Question
  ) {
    const answer =
      answers[question.id];

    if (!answer) return false;

    if (
      question.question_type ===
      "yes_no"
    ) {
      return (
        typeof answer.value ===
        "boolean"
      );
    }

    if (
      question.question_type ===
      "temperature"
    ) {
      return (
        typeof answer.value ===
          "number" &&
        Number.isFinite(answer.value)
      );
    }

    return (
      answer.value !== undefined &&
      answer.value !== ""
    );
  }

  function isException(
    question: Question
  ) {
    const answer =
      answers[question.id];

    if (!answer) return false;

    if (
      question.question_type ===
      "yes_no"
    ) {
      return answer.value === false;
    }

    if (
      question.question_type ===
      "temperature"
    ) {
      if (
        typeof answer.value !==
        "number"
      ) {
        return false;
      }

      if (
        question.min_value !== null &&
        answer.value <
          Number(
            question.min_value
          )
      ) {
        return true;
      }

      if (
        question.max_value !== null &&
        answer.value >
          Number(
            question.max_value
          )
      ) {
        return true;
      }
    }

    return false;
  }

  function issueFieldsComplete(
    question: Question
  ) {
    if (!isException(question)) {
      return true;
    }

    const answer =
      answers[question.id];

    return Boolean(
      answer?.notes?.trim() &&
        answer?.correctiveAction?.trim()
    );
  }

  const answeredCount =
    useMemo(
      () =>
        questions.filter(isAnswered)
          .length,
      [answers, questions]
    );

  const photoCount =
    useMemo(
      () =>
        questions.filter(
          (question) =>
            Boolean(
              answers[question.id]?.photo ||
              answers[question.id]?.existingStoragePath ||
              answers[question.id]?.existingPhotoFile
            )
        ).length,
      [answers, questions]
    );

  const issueCount =
    useMemo(
      () =>
        questions.filter(
          isException
        ).length,
      [answers, questions]
    );

  const issueCompleteCount =
    useMemo(
      () =>
        questions.filter(
          (question) =>
            isException(question) &&
            issueFieldsComplete(
              question
            )
        ).length,
      [answers, questions]
    );

  const totalQuestions =
    questions.length;

  const photoDraftBusyCount =
    useMemo(
      () =>
        questions.filter(
          (question) =>
            [
              "optimizing",
              "uploading",
            ].includes(
              answers[
                question.id
              ]
                ?.photoSaveStatus ||
                ""
            )
        ).length,
      [
        answers,
        questions,
      ]
    );

  const overallComplete =
    !loadingExisting &&
    Boolean(sessionData) &&
    answeredCount === totalQuestions &&
    photoCount === totalQuestions &&
    issueCompleteCount === issueCount &&
    photoDraftBusyCount === 0;

  const progress =
    totalQuestions === 0
      ? 0
      : Math.round(
          ((answeredCount +
            photoCount) /
            (totalQuestions * 2)) *
            100
        );


  // ==========================================================
  // REOPEN NOTICE
  // ==========================================================

  const isReopenedSession =
    Boolean(sessionData?.isReopened) ||
    String(
      sessionData?.status ||
      sessionData?.reportStatus ||
      sessionData?.report?.status ||
      ""
    ).toLowerCase() === "reopened";

  const reopenReason =
    sessionData?.reopen?.reason ||
    sessionData?.reopenReason ||
    sessionData?.reopen_reason ||
    sessionData?.report?.reopen_reason ||
    "Report dibuka kembali oleh Administrator untuk diperbaiki.";

  const reopenedAtRaw =
    sessionData?.reopen?.reopenedAt ||
    sessionData?.reopenedAt ||
    sessionData?.reopened_at ||
    sessionData?.report?.reopened_at ||
    null;

  const reopenedAtText = (() => {
    if (!reopenedAtRaw) {
      return null;
    }

    try {
      return new Intl.DateTimeFormat(
        "id-ID",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        }
      ).format(
        new Date(reopenedAtRaw)
      );
    } catch {
      return null;
    }
  })();

  
  const reopenQuestionIdSet =
    useMemo(
      () =>
        new Set<string>(
          Array.isArray(
            sessionData?.reopen
              ?.questionIds
          )
            ? sessionData.reopen
                .questionIds
            : []
        ),
      [
        sessionData?.reopen
          ?.questionIds,
      ]
    );

  async function handleSubmit() {
    if (
      !overallComplete ||
      submitting
    ) {
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSubmitStatus(
        "Preparing Closing report..."
      );

      // ======================================================
      // USE PRELOADED REPORT SESSION
      // ======================================================

      const session =
        sessionData;

      if (!session) {
        throw new Error(
          "Closing session belum siap. Silakan tunggu sebentar."
        );
      }

      const {
        reportId,
        reportSectionId,
      } = session;

      let pdfStoragePath = "";

      // ======================================================
      // UPLOAD PHOTOS
      // ======================================================

      const submissionAnswers: any[] =
        [];

      for (
        let index = 0;
        index < questions.length;
        index++
      ) {
        const question =
          questions[index];

        const answer =
          answers[question.id];

        if (
          !answer?.photo &&
          !answer?.existingStoragePath
        ) {
          throw new Error(
            `Photo evidence belum ada: ${question.question_text}`
          );
        }

        let storagePath =
          answer.existingStoragePath || "";

        let originalFilename =
          answer.existingOriginalFilename ||
          null;

        let mimeType =
          answer.existingMimeType ||
          null;

        let fileSize =
          answer.existingFileSize ||
          null;

        // ====================================================
        // NEW / REPLACEMENT PHOTO
        // ====================================================

        if (answer.photo) {
          setSubmitStatus(
            `Uploading photo ${index + 1} of ${questions.length}...`
          );

          const file =
            answer.photo;

          const extension =
            file.name
              .split(".")
              .pop()
              ?.toLowerCase() ||
            "jpg";

          const safeCode =
            question.code
              .replace(
                /[^a-zA-Z0-9_-]/g,
                "-"
              )
              .toLowerCase();

          storagePath =
            `report-sections/${reportSectionId}/` +
            `${safeCode}/` +
            `${crypto.randomUUID()}.${extension}`;

          const {
            error: uploadError,
          } = await supabase.storage
            .from(
              "operational-photos"
            )
            .upload(
              storagePath,
              file,
              {
                cacheControl:
                  "3600",

                upsert:
                  false,

                contentType:
                  file.type ||
                  undefined,
              }
            );

          if (uploadError) {
            throw new Error(
              `Upload gagal untuk "${question.question_text}": ${uploadError.message}`
            );
          }

          originalFilename =
            file.name;

          mimeType =
            file.type;

          fileSize =
            file.size;
        }

        submissionAnswers.push({
          questionId:
            question.id,

          value:
            answer.value,

          notes:
            answer.notes ||
            null,

          correctiveAction:
            answer.correctiveAction ||
            null,

          storagePath,

          originalFilename,

          mimeType,

          fileSize,
        });
      }

      // ======================================================
      // GENERATE PDF REPORT
      // ======================================================

      setSubmitStatus(
        "Generating PDF report..."
      );

      
      // ======================================================
      // PDF ANSWERS
      //
      // New photo:
      //   use answer.photo
      //
      // Existing reopened photo:
      //   use existingPhotoFile downloaded from Storage
      // ======================================================

      const pdfAnswers:
        Record<string, AnswerState> = {};

      for (const question of questions) {
        const answer =
          answers[question.id];

        if (!answer) continue;

        pdfAnswers[
          question.id
        ] = {
          ...answer,

          photo:
            answer.photo ||
            answer.existingPhotoFile,
        };
      }

      const pdfBytes =
        await buildClosingPdf({
          reportNumber:
            session.reportNumber,
          outletName:
            outlet.name,
          submittedBy:
            "CQ Operational User",
          groups,
          questions,
          answers:
            pdfAnswers,

        });

      const pdfBlob =
        new Blob(
          [new Uint8Array(pdfBytes)],
          {
            type: "application/pdf",
          }
        );

      pdfStoragePath =
        `reports/${reportId}/` +
        `${session.reportNumber}.pdf`;

      const {
        error: pdfUploadError,
      } = await supabase.storage
        .from(
          "operational-reports"
        )
        .upload(
          pdfStoragePath,
          pdfBlob,
          {
            contentType:
              "application/pdf",
            cacheControl:
              "3600",
            upsert: true,
          }
        );

      if (pdfUploadError) {
        throw new Error(
          `PDF upload gagal: ${pdfUploadError.message}`
        );
      }

      const {
        error: pdfUpdateError,
      } = await supabase
        .from("reports")
        .update({
          pdf_storage_path:
            pdfStoragePath,
          pdf_generated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          reportId
        );

      if (pdfUpdateError) {
        throw new Error(
          `PDF metadata gagal disimpan: ${pdfUpdateError.message}`
        );
      }

      // ======================================================
      // SAVE ANSWERS + SUBMIT
      // ======================================================

      setSubmitStatus(
        "Saving checklist..."
      );

      const submitResponse =
        await fetch(
          "/api/closing/kitchen/submit",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              reportId,
              reportSectionId,
              answers:
                submissionAnswers,
            }),
          }
        );

      const submitData =
        await submitResponse.json();

      if (!submitResponse.ok) {
        throw new Error(
          submitData.error ||
            "Unable to submit Closing"
        );
      }

      setSubmitStatus(
        "Closing report saved."
      );

      setResult({
        reportNumber:
          submitData.reportNumber,
        submittedAt:
          submitData.submittedAt,
        answerCount:
          submitData.answerCount,
        photoCount:
          submitData.photoCount,
        issueCount:
          submitData.issueCount,
        completed:
          submitData.completed,
        pdfStoragePath,
      });

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });

    } catch (error: any) {
      console.error(error);

      setErrorMessage(
        error?.message ||
          "Something went wrong."
      );

      setSubmitStatus("");

    } finally {
      setSubmitting(false);
    }
  }

  function buildReportText() {
    if (!result) return "";

    const submittedDate =
      new Date(result.submittedAt);

    const date =
      new Intl.DateTimeFormat(
        "id-ID",
        {
          dateStyle: "long",
          timeZone: "Asia/Jakarta",
        }
      ).format(submittedDate);

    const time =
      new Intl.DateTimeFormat(
        "id-ID",
        {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Jakarta",
        }
      ).format(submittedDate);

    const lines: string[] = [
      "*CLOSING REPORT*",
      "*CHONG QING HOT POT*",
      "",
      `📍 Outlet: ${outlet.name}`,
      `📅 Date: ${date}`,
      `⏰ Submitted: ${time} WIB`,
      "🏷 Section: BOH / Kitchen",
      "",
      "*SUMMARY*",
      `- Checklist: ${result.answerCount}/${totalQuestions}`,
      `- Photo Evidence: ${result.photoCount}`,
      `- Issues: ${result.issueCount}`,
      `- Status: ${result.completed ? "Completed" : "Submitted"}`,
      "",
    ];

    for (const group of groups) {
      const groupQuestions =
        questions.filter(
          (question) =>
            question.question_group_id === group.id
        );

      if (!groupQuestions.length) {
        continue;
      }

      lines.push(
        `*${group.name.toUpperCase()}*`
      );

      for (const question of groupQuestions) {
        const answer =
          answers[question.id];

        const exception =
          isException(question);

        let valueText = "";

        if (
          question.question_type === "temperature"
        ) {
          valueText =
            `: ${answer?.value}${question.unit ?? ""}`;
        }

        lines.push(
          `- ${question.question_text}${valueText} ${exception ? "❌" : "✅"}`
        );

        if (
          exception &&
          answer?.notes?.trim()
        ) {
          lines.push(
            `  _Notes: ${answer.notes.trim()}_`
          );
        }

        if (
          exception &&
          answer?.correctiveAction?.trim()
        ) {
          lines.push(
            `  _Corrective: ${answer.correctiveAction.trim()}_`
          );
        }
      }

      lines.push("");
    }

    lines.push(
      "*REPORT INFO*",
      `- Report ID: ${result.reportNumber}`,
      `- Photo Evidence: ${result.photoCount}`,
      `- Issues: ${result.issueCount}`,
      "",
      "*CLOSING COMPLETED*"
    );

    return lines.join("\n");
  }

  async function copyReport() {
    const text =
      buildReportText();

    try {
      await navigator.clipboard.writeText(
        text
      );

      alert(
        "Report text copied."
      );
    } catch {
      alert(
        "Unable to copy report."
      );
    }
  }

  async function getPdfFile() {
    if (!result?.pdfStoragePath) {
      throw new Error(
        "PDF report belum tersedia."
      );
    }

    const {
      data,
      error,
    } = await supabase.storage
      .from(
        "operational-reports"
      )
      .download(
        result.pdfStoragePath
      );

    if (error || !data) {
      throw new Error(
        error?.message ||
          "Unable to download PDF."
      );
    }

    return new File(
      [data],
      `${result.reportNumber}.pdf`,
      {
        type: "application/pdf",
      }
    );
  }

  function downloadFile(
    file: File
  ) {
    const url =
      URL.createObjectURL(file);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download =
      file.name;

    document.body.appendChild(
      anchor
    );

    anchor.click();

    anchor.remove();

    setTimeout(
      () =>
        URL.revokeObjectURL(url),
      1000
    );
  }

  async function downloadPdf() {
    try {
      const file =
        await getPdfFile();

      downloadFile(file);
    } catch (error: any) {
      alert(
        error?.message ||
          "Unable to download PDF."
      );
    }
  }

  async function sharePdf() {
    try {
      const file =
        await getPdfFile();

      const reportText =
        buildReportText();

      const shareTitle =
        `Closing Report - ${outlet.name}`;

      // ======================================================
      // MOBILE / NATIVE SHARE
      //
      // Preferred:
      // PDF + FULL approved report text in one share action.
      // ======================================================

      if (navigator.share) {

        const canShareFiles =
          typeof navigator.canShare ===
            "function"
            ? navigator.canShare({
                files: [file],
              })
            : true;

        if (canShareFiles) {

          // ---------------------------------------------------
          // FIRST ATTEMPT
          // PDF + FULL TEXT
          // ---------------------------------------------------

          try {
            await navigator.share({
              title:
                shareTitle,

              text:
                reportText,

              files: [
                file,
              ],
            });

            return;

          } catch (
            combinedError: any
          ) {

            if (
              combinedError?.name ===
              "AbortError"
            ) {
              return;
            }

            console.warn(
              "Combined PDF + text share failed:",
              combinedError
            );
          }


          // ---------------------------------------------------
          // FALLBACK
          // Keep PDF attachment.
          // Copy the FULL report text first.
          // ---------------------------------------------------

          try {
            await navigator.clipboard.writeText(
              reportText
            );
          } catch (
            clipboardError
          ) {
            console.warn(
              "Unable to copy report text:",
              clipboardError
            );
          }


          try {
            await navigator.share({
              title:
                shareTitle,

              files: [
                file,
              ],
            });

            return;

          } catch (
            fileShareError: any
          ) {

            if (
              fileShareError?.name ===
              "AbortError"
            ) {
              return;
            }

            console.warn(
              "PDF-only share failed:",
              fileShareError
            );
          }
        }
      }


      // ======================================================
      // LAST FALLBACK
      //
      // Browser cannot share file attachment.
      // Download PDF + copy full report + open WhatsApp text.
      // ======================================================

      downloadFile(
        file
      );

      try {
        await navigator.clipboard.writeText(
          reportText
        );
      } catch (
        clipboardError
      ) {
        console.warn(
          "Unable to copy report text:",
          clipboardError
        );
      }

      const whatsappUrl =
        "https://wa.me/?text=" +
        encodeURIComponent(
          reportText
        );

      window.open(
        whatsappUrl,
        "_blank"
      );

      setTimeout(() => {
        alert(
          "PDF Report sudah didownload. Full report text juga sudah dicopy. Attach PDF ke WhatsApp jika browser tidak dapat melampirkan file secara otomatis."
        );
      }, 400);

    } catch (
      error: any
    ) {
      console.error(
        "Share report error:",
        error
      );

      alert(
        error?.message ||
          "Unable to prepare report."
      );
    }
  }

  // ==========================================================
  // SUCCESS SCREEN
  // ==========================================================

  if (result) {
    const submittedTime =
      new Intl.DateTimeFormat(
        "id-ID",
        {
          hour: "2-digit",
          minute: "2-digit",
          timeZone:
            "Asia/Jakarta",
        }
      ).format(
        new Date(
          result.submittedAt
        )
      );

    return (
      <section className="mt-6">
        <div className="mx-auto max-w-2xl rounded-[28px] border border-black/5 bg-white p-7 text-center shadow-sm md:p-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-3xl text-emerald-700 font-bold">
            ✓
          </div>

          <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">
            Report Saved
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
            Closing Completed
          </h2>

          <p className="mt-2 text-neutral-500">
            {outlet.name}
          </p>

          <p className="mt-1 text-sm text-neutral-400">
            {submittedTime} WIB
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3 text-neutral-900">
            <SummaryStat
              label="Checklist"
              value={`${result.answerCount}/${totalQuestions}`}
            />

            <SummaryStat
              label="Photos"
              value={`${result.photoCount}`}
            />

            <SummaryStat
              label="Issues"
              value={`${result.issueCount}`}
            />
          </div>

          <div className="mt-6 rounded-2xl bg-neutral-50 px-5 py-4">
            <p className="text-xs uppercase tracking-wide text-neutral-400">
              Report ID
            </p>

            <p className="mt-1 break-all font-semibold text-neutral-900">
              {result.reportNumber}
            </p>
          </div>

          <div className="mt-7 grid gap-3">
            <button
              type="button"
              onClick={
                sharePdf
              }
              className="rounded-xl bg-emerald-600 px-6 py-4 font-semibold text-white transition hover:bg-emerald-700"
            >
              📤 Share Report to WhatsApp
            </button>

            <button
              type="button"
              onClick={
                downloadPdf
              }
              className="rounded-xl bg-red-700 px-6 py-4 font-semibold text-white transition hover:bg-red-800"
            >
              ⬇ Download PDF
            </button>

            <button
              type="button"
              onClick={
                copyReport
              }
              className="rounded-xl bg-[#222] px-6 py-4 font-semibold text-white transition hover:bg-black"
            >
              📋 Copy Report Text
            </button>

            <Link
              href="/protected"
              className="rounded-xl border border-neutral-200 px-6 py-4 font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              Back to Dashboard
            </Link>
          </div>

          <p className="mt-5 text-xs leading-5 text-neutral-400">
            Share PDF membuka native share sheet pada HP/tablet yang mendukung. Pilih WhatsApp lalu group outlet yang dituju. Pada desktop, PDF akan didownload untuk dilampirkan manual ke WhatsApp Web.
          </p>
        </div>
      </section>
    );
  }

  // ==========================================================
  // FORM
  // ==========================================================

  return (
    <>
      {isReopenedSession && (
        <section className="mt-6 overflow-hidden rounded-[24px] border border-amber-200 bg-amber-50 shadow-sm">
          <div className="p-6 md:p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-xl font-bold text-amber-800">
                  ↻
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-700">
                    Report Reopened
                  </p>

                  <h2 className="mt-1 text-xl font-bold tracking-tight text-neutral-900">
                    Perlu Perbaikan
                  </h2>

                  <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600">
                    Administrator membuka kembali report ini.
                    Perbaiki checklist atau photo evidence yang diperlukan,
                    lalu submit kembali report yang sama.
                  </p>
                </div>
              </div>

              <span className="w-fit shrink-0 rounded-full border border-amber-200 bg-white px-3 py-1.5 text-xs font-bold text-amber-800">
                NEEDS CORRECTION
              </span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
              <div className="rounded-2xl border border-amber-200/80 bg-white px-5 py-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                  Reason
                </p>

                <p className="mt-2 text-sm font-semibold leading-6 text-neutral-900">
                  {reopenReason}
                </p>
              </div>

              {reopenedAtText && (
                <div className="rounded-2xl border border-amber-200/80 bg-white px-5 py-4 md:min-w-[190px]">
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                    Reopened
                  </p>

                  <p className="mt-2 text-sm font-semibold text-neutral-900">
                    {reopenedAtText} WIB
                  </p>
                </div>
              )}
            </div>

            <div className="mt-4 flex items-start gap-2 rounded-xl bg-amber-100/70 px-4 py-3">
              <span className="mt-0.5 text-amber-800">
                ⚠
              </span>

              <p className="text-xs font-medium leading-5 text-amber-900">
                Daily Lock tetap aktif. Resubmit akan memperbarui report ini,
                bukan membuat report baru.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="mt-6 hidden rounded-[24px] border border-black/5 bg-white p-6 shadow-sm md:block">
        <div className="grid gap-6 md:grid-cols-3">
          <ProgressSummaryItem
            label="Checklist"
            value={`${answeredCount}/${totalQuestions}`}
            complete={
              answeredCount ===
              totalQuestions
            }
          />

          <ProgressSummaryItem
            label="Photo Evidence"
            value={`${photoCount}/${totalQuestions}`}
            complete={
              photoCount ===
              totalQuestions
            }
          />

          <ProgressSummaryItem
            label="Issues"
            value={`${issueCount}`}
            complete={
              issueCompleteCount ===
              issueCount
            }
          />
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs text-neutral-500">
            <span>
              Overall Completion
            </span>

            <span>
              {progress}%
            </span>
          </div>

          <div className="h-3 overflow-hidden rounded-full bg-neutral-100">
            <div
              className="h-full rounded-full bg-red-700 transition-all"
              style={{
                width: `${progress}%`,
                minWidth: progress > 0 ? "10px" : "0px",
              }}
            />
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <strong>
            Submit failed:
          </strong>{" "}
          {errorMessage}
        </div>
      )}

      <div className="mt-4 space-y-6 sm:mt-8 sm:space-y-8">
        {groups.map(
          (
            group,
            groupIndex
          ) => {
            const groupQuestions =
              questions.filter(
                (question) =>
                  question.question_group_id ===
                  group.id
              );

            return (
              <section
                key={group.id}
              >
                <div className="mb-3 flex items-start gap-3 sm:mb-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-50 font-bold text-red-700">
                    {groupIndex + 1}
                  </div>

                  <div>
                    <h2 className="text-xl font-black leading-tight tracking-tight text-neutral-950 sm:text-2xl">
                      {group.name}
                    </h2>

                    {group.description && (
                      <p className="mt-1.5 text-sm font-medium leading-5 text-neutral-700">
                        {
                          group.description
                        }
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  {groupQuestions.map(
                    (
                      question,
                      index
                    ) => {
                      const answer =
                        answers[
                          question.id
                        ];

                      const exception =
                        isException(
                          question
                        );

                      const needsReview =
                        question
                          .config
                          ?.needs_review ===
                        true;

                      const needsCorrection =
                        isReopenedSession &&
                        reopenQuestionIdSet.has(
                          question.id
                        );


                      return (
                        <div
                          key={
                            question.id
                          }
                          className="-mx-2 rounded-[18px] border border-black/5 bg-white p-4 text-neutral-900 shadow-sm sm:mx-0 sm:rounded-[22px] sm:p-6"
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-500">
                              {index +
                                1}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2">
                                <p className="font-semibold leading-6 text-neutral-900">
                                  {
                                    question.question_text
                                  }
                                </p>

                                {question.is_required && (
                                  <span className="text-red-600">
                                    *
                                  </span>
                                )}
                              </div>

                              {needsCorrection && (
                                <div className="mt-3">
                                  <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-800">
                                    Admin Requested Correction
                                  </span>
                                </div>
                              )}

                              {question.help_text && (
                                <p className="mt-2 text-sm text-neutral-500">
                                  {
                                    question.help_text
                                  }
                                </p>
                              )}

                              {question.question_type ===
                                "yes_no" && (
                                <div className="mt-5 grid grid-cols-2 gap-3 md:max-w-md">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setQuestionValue(
                                        question.id,
                                        true
                                      )
                                    }
                                    className={`min-h-[52px] rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                                      answer?.value ===
                                      true
                                        ? "border-emerald-600 bg-emerald-600 text-white"
                                        : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                                    }`}
                                  >
                                    YES
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setQuestionValue(
                                        question.id,
                                        false
                                      )
                                    }
                                    className={`min-h-[52px] rounded-xl border px-4 py-3 text-sm font-semibold transition ${
                                      answer?.value ===
                                      false
                                        ? "border-red-700 bg-red-700 text-white"
                                        : "border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50"
                                    }`}
                                  >
                                    NO
                                  </button>
                                </div>
                              )}

                              {question.question_type ===
                                "temperature" && (
                                <div className="mt-5">
                                  <div className="flex max-w-sm items-center gap-3">
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={
                                        typeof answer?.value ===
                                        "number"
                                          ? answer.value
                                          : ""
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        setQuestionValue(
                                          question.id,
                                          event
                                            .target
                                            .value ===
                                            ""
                                            ? ""
                                            : Number(
                                                event
                                                  .target
                                                  .value
                                              )
                                        )
                                      }
                                      placeholder="0.0"
                                      className={`w-full max-w-[190px] rounded-xl border px-4 py-3 text-lg font-semibold outline-none ${
                                        exception
                                          ? "border-red-300 bg-red-50"
                                          : "border-neutral-200 bg-white"
                                      } text-neutral-900`}
                                    />

                                    <span className="text-neutral-500">
                                      {
                                        question.unit
                                      }
                                    </span>
                                  </div>

                                  {question.min_value !==
                                    null &&
                                    question.max_value !==
                                      null && (
                                      <p className="mt-2 text-xs text-neutral-500">
                                        Standard{" "}
                                        {
                                          question.min_value
                                        }{" "}
                                        –{" "}
                                        {
                                          question.max_value
                                        }
                                        {
                                          question.unit
                                        }
                                      </p>
                                    )}

                                  {question.min_value ===
                                    null &&
                                    question.max_value !==
                                      null && (
                                      <p className="mt-2 text-xs text-neutral-500">
                                        Standard ≤{" "}
                                        {
                                          question.max_value
                                        }
                                        {
                                          question.unit
                                        }
                                      </p>
                                    )}

                                  {typeof answer?.value ===
                                    "number" && (
                                    <span
                                      className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                        exception
                                          ? "bg-red-50 text-red-700"
                                          : "bg-emerald-50 text-emerald-700"
                                      }`}
                                    >
                                      {exception
                                        ? "OUT OF STANDARD"
                                        : "WITHIN STANDARD"}
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-neutral-900">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold">
                                      Photo
                                      Evidence *
                                    </p>

                                    <p className="mt-1 text-xs text-neutral-500">
                                      Wajib
                                      untuk
                                      setiap
                                      pertanyaan
                                    </p>
                                  </div>

                                  {(
                                      answer?.photo ||
                                      answer?.existingStoragePath ||
                                      answer?.existingPhotoFile ||
                                      answer?.photo ||
                                      answer?.existingStoragePath ||
                                      answer?.existingPhotoFile ||
                                      answer?.photoSaveStatus === "saved" ||
                                      answer?.photoSaveStatus === "optimizing" ||
                                      answer?.photoSaveStatus === "uploading" ||
                                      answer?.photoSaveStatus === "error"
                                    ) && (
                                      <span
                                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                          answer?.photoSaveStatus === "error"
                                            ? "bg-red-50 text-red-700"
                                            : answer?.photoSaveStatus === "optimizing" ||
                                                answer?.photoSaveStatus === "uploading"
                                              ? "bg-blue-50 text-blue-700"
                                              : "bg-emerald-50 text-emerald-700"
                                        }`}
                                      >
                                        {answer?.photoSaveStatus === "optimizing"
                                          ? "Optimizing..."
                                          : answer?.photoSaveStatus === "uploading"
                                            ? "Uploading..."
                                            : answer?.photoSaveStatus === "error"
                                              ? "Upload Failed"
                                              : answer?.existingStoragePath ||
                                                  answer?.existingPhotoFile ||
                                                  answer?.photoSaveStatus === "saved"
                                                ? "Photo Evidence ✓"
                                                : "New Photo ✓"}
                                      </span>
                                    )}
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2.5">
                                  <label className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 text-center text-xs font-black text-red-700 transition ${submitting || !sessionData?.reportId || !sessionData?.reportSectionId ? "cursor-wait opacity-45" : "cursor-pointer active:scale-[0.99]"}`}>
                                    <span className="text-base">📷</span>
                                    <span>Take Photo</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      capture="environment"
                                      disabled={submitting || !sessionData?.reportId || !sessionData?.reportSectionId}
                                      className="sr-only"
                                      onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) {
                                          void setPhoto(question.id, file);
                                        }
                                        event.currentTarget.value = "";
                                      }}
                                    />
                                  </label>

                                  <label className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-sky-100 bg-sky-50 px-3 text-center text-xs font-black text-sky-700 transition ${submitting || !sessionData?.reportId || !sessionData?.reportSectionId ? "cursor-wait opacity-45" : "cursor-pointer active:scale-[0.99]"}`}>
                                    <span className="text-base">🖼️</span>
                                    <span>Gallery / Device</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      disabled={submitting || !sessionData?.reportId || !sessionData?.reportSectionId}
                                      className="sr-only"
                                      onChange={(event) => {
                                        const file = event.target.files?.[0];
                                        if (file) {
                                          void setPhoto(question.id, file);
                                        }
                                        event.currentTarget.value = "";
                                      }}
                                    />
                                  </label>
                                </div>

                                {answer?.photo && (
                                  <p className="mt-2 truncate text-xs text-neutral-500">
                                    {
                                      answer
                                        .photo
                                        .name
                                    }
                                  </p>
                                )}
                              </div>

                              {exception && (
                                <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-5">
                                  <p className="text-sm font-bold text-red-800">
                                    Action
                                    Required
                                  </p>

                                  <p className="mt-1 text-xs text-red-700">
                                    Jawaban
                                    ini akan
                                    dibuat
                                    sebagai
                                    operational
                                    issue.
                                  </p>

                                  <div className="mt-4 space-y-4">
                                    <div>
                                      <label className="text-xs font-semibold text-neutral-600">
                                        Notes
                                        *
                                      </label>

                                      <textarea
                                        rows={4}
                                        value={
                                          answer?.notes ??
                                          ""
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          setExtraField(
                                            question.id,
                                            "notes",
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                        placeholder="Jelaskan kondisi yang ditemukan..."
                                        className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none"
                                      />
                                    </div>

                                    <div>
                                      <label className="text-xs font-semibold text-neutral-600">
                                        Corrective
                                        Action
                                        *
                                      </label>

                                      <textarea
                                        rows={4}
                                        value={
                                          answer?.correctiveAction ??
                                          ""
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          setExtraField(
                                            question.id,
                                            "correctiveAction",
                                            event
                                              .target
                                              .value
                                          )
                                        }
                                        placeholder="Tindakan yang sudah dilakukan..."
                                        className="mt-2 w-full rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm outline-none"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}

                              {needsReview && (
                                <div className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs text-amber-700">
                                  ⚠
                                  Wording
                                  pertanyaan
                                  ini perlu
                                  direview
                                  Admin.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </section>
            );
          }
        )}
      </div>

      {/* MOBILE INPUT FOCUS PROGRESS */}
        {!overallComplete && !submitting && (
          <div className="sticky bottom-0 z-30 mt-6 border-t border-black/5 bg-[#f4f4f4]/95 px-1 py-2 backdrop-blur md:hidden">
            <div className="rounded-2xl border border-black/5 bg-white px-3 py-2.5 shadow-lg">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-neutral-800">
                    {answeredCount}/{totalQuestions} answers
                    {" · "}
                    {photoCount}/{totalQuestions} photos
                    {issueCount > 0
                      ? ` · ${issueCount} issue(s)`
                      : ""}
                  </p>

                  <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-neutral-100">
                    <div
                      className="h-full rounded-full bg-red-700 transition-all"
                      style={{
                        width: `${progress}%`,
                        minWidth: progress > 0 ? "10px" : "0px",
                      }}
                    />
                  </div>
                </div>

                <div
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    draftStatus === "error"
                      ? "bg-amber-50 text-amber-700"
                      : draftStatus === "saving" ||
                          draftStatus === "loading"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {draftStatus === "error"
                    ? "Draft error"
                    : draftStatus === "saving"
                      ? "Saving..."
                      : draftStatus === "loading"
                        ? "Loading..."
                        : "✓ Saved"}
                </div>
              </div>
            </div>
          </div>
        )}

        <div
          className={`bottom-0 mt-10 border-t border-black/5 bg-[#f4f4f4]/95 py-4 backdrop-blur ${
            overallComplete || submitting
              ? "sticky"
              : "hidden md:sticky md:block"
          }`}
        >
        <div className="rounded-[22px] border border-black/5 bg-white p-4 text-neutral-950 shadow-lg">
            {!submitting &&
              draftStatus !== "idle" && (
                <div
                  className={`mb-3 rounded-xl px-4 py-2 text-xs font-semibold ${
                    draftStatus === "error"
                      ? "bg-amber-50 text-amber-700"
                      : draftStatus === "saving" ||
                          draftStatus === "loading"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {draftStatus === "loading"
                    ? "Loading draft..."
                    : draftStatus === "saving"
                      ? "Saving draft..."
                      : draftStatus === "error"
                        ? "Draft belum tersimpan. Cek koneksi."
                        : "✓ Draft saved"}
                </div>
              )}

          {submitting && (
            <div className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">
              {submitStatus}
            </div>
          )}

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold">
                Closing
                Checklist
              </p>

              <p className="mt-1 text-xs text-neutral-500">
                {
                  answeredCount
                }
                /
                {
                  totalQuestions
                }{" "}
                answers ·{" "}
                {
                  photoCount
                }
                /
                {
                  totalQuestions
                }{" "}
                photos
                {issueCount >
                0
                  ? ` · ${issueCount} issue(s)`
                  : ""}
              </p>
            </div>

            <button
              type="button"
              onClick={
                handleSubmit
              }
              disabled={
                !overallComplete ||
                submitting
              }
              className={`rounded-xl px-7 py-4 text-sm font-bold transition ${
                overallComplete &&
                !submitting
                  ? "bg-red-700 text-white hover:bg-red-800"
                  : "cursor-not-allowed bg-neutral-200 text-neutral-400"
              }`}
            >
              {submitting
                ? "Submitting..."
                : "Submit Closing"}
            </button>
          </div>

          {!overallComplete &&
            !submitting && (
              <div className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-700">
                {answeredCount !==
                  totalQuestions &&
                  `${
                    totalQuestions -
                    answeredCount
                  } jawaban belum diisi. `}

                {photoCount !==
                  totalQuestions &&
                  `${
                    totalQuestions -
                    photoCount
                  } photo evidence belum diupload. `}

                {issueCompleteCount !==
                  issueCount &&
                  `${
                    issueCount -
                    issueCompleteCount
                  } issue belum memiliki Notes & Corrective Action.`}
              </div>
            )}
        </div>
      </div>
    </>
  );
}

function ProgressItem({
  label,
  value,
  complete,
}: {
  label: string;
  value: string;
  complete: boolean;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <p className="text-2xl font-bold">
          {value}
        </p>

        {complete && (
          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-bold text-emerald-700">
            COMPLETE
          </span>
        )}
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl bg-neutral-50 p-4">
      <p className="text-xs text-neutral-400">
        {label}
      </p>

      <p className="mt-1 text-xl font-bold">
        {value}
      </p>
    </div>
  );
}
