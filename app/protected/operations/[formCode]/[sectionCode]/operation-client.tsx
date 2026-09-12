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
import { buildOpeningPdf } from "@/lib/pdf/opening-report";
import { buildClosingPdf } from "@/lib/pdf/closing-report";
import {
  getOperationalEvidenceMode,
  hasOperationalPhotoEvidence,
  isOperationalPhotoRequired,
} from "@/lib/operations/evidence";
import {
  isSupportedLocale,
  OPERATION_COPY,
  resolveLocalizedText,
  type AppLocale,
} from "@/lib/localization/locale";

type Group = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sort_order: number;
  translation?: Partial<Record<AppLocale, {
    display_name?: string | null;
    description?: string | null;
  }>>;
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
  translations?: Partial<Record<AppLocale, {
    question_text?: string | null;
    help_text?: string | null;
  }>>;
};

type AnswerState = {
  value?: boolean | number | string;

  isCompliant?: boolean | null;

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
  reportId: string;
  reportNumber: string;
  submittedAt: string;
  answerCount: number;
  photoCount: number;
  issueCount: number;
  completed: boolean;

  picCompleted: boolean | null;
  picAssignedCount: number | null;
  picCompletedCount: number | null;
  picReadyForPdf: boolean;

  pdfStoragePath: string;
  pdfError: string | null;
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

export default function OperationClient({
  outlet,
  operation,
  pic,
  groups,
  questions: allQuestions,
  requestedReportId,
}: {
  outlet: {
    id: string;
    code: string;
    name: string;
  };
  operation: {
    formCode: string;
    sectionCode: string;
    displayName: string;
    sectionName: string;
      sectionTranslation?: Partial<Record<AppLocale, {
      display_name?: string | null;
      description?: string | null;
      }>>;
    sectionScoped: boolean;
  };

  pic: {
    id: string;
    name: string;
    jobTitle: string | null;
  };

  groups: Group[];
  questions: Question[];

  requestedReportId?:
    string | null;
}) {
  const supabase = createClient();

  const apiBase =
    `/api/operations/${operation.formCode}/${operation.sectionCode}`;

  const operationKind =
    operation.formCode.startsWith(
      "CLOSING"
    )
      ? "Closing"
      : "Opening";

  const operationLabel =
    operation.displayName;

  const [displayLocale, setDisplayLocale] =
    useState<AppLocale>("en");

  const copy =
    OPERATION_COPY[displayLocale];

  const sectionLabel =
    resolveLocalizedText(
      operation.sectionName,
      Object.fromEntries(
        Object.entries(
          operation.sectionTranslation ?? {}
        ).map(
          ([locale, translation]) => [
            locale,
            translation?.display_name,
          ]
        )
      ) as Partial<Record<AppLocale, string | null>>,
      displayLocale
    );

  function questionText(
    question: Question
  ) {
    return resolveLocalizedText(
      question.question_text,
      Object.fromEntries(
        Object.entries(
          question.translations ?? {}
        ).map(
          ([locale, translation]) => [
            locale,
            translation?.question_text,
          ]
        )
      ) as Partial<Record<AppLocale, string | null>>,
      displayLocale
    );
  }

  function questionHelpText(
    question: Question
  ) {
    return resolveLocalizedText(
      question.help_text,
      Object.fromEntries(
        Object.entries(
          question.translations ?? {}
        ).map(
          ([locale, translation]) => [
            locale,
            translation?.help_text,
          ]
        )
      ) as Partial<Record<AppLocale, string | null>>,
      displayLocale
    );
  }

  function groupName(
    group: Group
  ) {
    return resolveLocalizedText(
      group.name,
      Object.fromEntries(
        Object.entries(
          group.translation ?? {}
        ).map(
          ([locale, translation]) => [
            locale,
            translation?.display_name,
          ]
        )
      ) as Partial<Record<AppLocale, string | null>>,
      displayLocale
    );
  }

  function groupDescription(
    group: Group
  ) {
    return resolveLocalizedText(
      group.description,
      Object.fromEntries(
        Object.entries(
          group.translation ?? {}
        ).map(
          ([locale, translation]) => [
            locale,
            translation?.description,
          ]
        )
      ) as Partial<Record<AppLocale, string | null>>,
      displayLocale
    );
  }

  // ==========================================================
  // CK PRODUCTION SECTION PIC
  //
  // Production PIC submits section only.
  // Final Production report belongs to Production Leader.
  // ==========================================================

  const isProductionSection =
    operation.sectionScoped &&
    [
      "BEVERAGE",
      "BUTCHER",
      "STEWARD",
      "PREMIX",
      "COLD_KITCHEN",
      "HOT_KITCHEN",
      "HDS",
    ].includes(
      String(
        operation.sectionCode ||
        ""
      ).toUpperCase()
    );

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

  const [applicabilityReason, setApplicabilityReason] = useState("");
  const [applicabilitySaving, setApplicabilitySaving] = useState(false);

  const isCkProductionSection =
    operation.formCode === "CLOSING_CK" &&
    [
      "BEVERAGE",
      "BUTCHER",
      "STEWARD",
      "PREMIX",
      "COLD_KITCHEN",
      "HOT_KITCHEN",
      "HDS",
    ].includes(operation.sectionCode.toUpperCase());

  async function setApplicability(status: "active" | "no_production", requestedReason?: string) {
    if (!sessionData?.reportId || !sessionData?.versionSectionId) return;
    const reason = requestedReason ?? applicabilityReason;
    if (status === "no_production" && !reason.trim()) {
      setErrorMessage("A reason is required for No Production Today.");
      return;
    }
    setApplicabilitySaving(true);
    try {
      const response = await fetch("/api/closing/kitchen/applicability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: sessionData.reportId,
          versionSectionId: sessionData.versionSectionId,
          status,
          reason: status === "no_production" ? reason : null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Unable to update applicability.");
      setSessionData((current: any) => ({
        ...current,
        applicabilityStatus: status,
        noProductionReason: status === "no_production" ? reason.trim() : null,
      }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to update applicability.");
    } finally {
      setApplicabilitySaving(false);
    }
  }

  // ==========================================================
  // PIC QUESTION APPLICABILITY
  //
  // V1 / legacy:
  //   session has no applicability lifecycle -> all questions.
  //
  // V2:
  //   authoritative report snapshot decides which questions
  //   participate in UI, progress, evidence and submission.
  //
  // N/A questions intentionally disappear from the PIC form.
  // PIC has no control to mark a question N/A.
  // ==========================================================

  const applicabilityEnabled =
    sessionData?.applicability
      ?.enabled === true;

  const applicableQuestionIds =
    useMemo(
      () =>
        new Set<string>(
          applicabilityEnabled &&
          Array.isArray(
            sessionData
              ?.applicability
              ?.applicableQuestionIds
          )
            ? sessionData
                .applicability
                .applicableQuestionIds
                .map(
                  (
                    value: unknown
                  ) =>
                    String(
                      value ||
                        ""
                    ).trim()
                )
                .filter(Boolean)
            : []
        ),
      [
        applicabilityEnabled,
        sessionData?.applicability
          ?.applicableQuestionIds,
      ]
    );

  const questions =
    useMemo(
      () => {
        if (
          !applicabilityEnabled
        ) {
          return allQuestions;
        }

        return allQuestions.filter(
          (question) =>
            applicableQuestionIds.has(
              String(
                question.id
              )
            )
        );
      },
      [
        allQuestions,
        applicabilityEnabled,
        applicableQuestionIds,
      ]
    );

  const [loadingExisting, setLoadingExisting] =
    useState(true);

  const [
    sessionRetryKey,
    setSessionRetryKey,
  ] = useState(0);

  const sessionReady =
    Boolean(
      sessionData?.reportId &&
      sessionData?.reportSectionId
    );

  const reviewAreaCode =
    String(
      sessionData?.reviewAreaCode ||
        ""
    )
      .trim()
      .toUpperCase();

  const isAreaLeaderReviewMode =
    Boolean(
      sessionData?.reviewMode
    );

  const reviewAreaLabel =
    reviewAreaCode === "STORE"
      ? "Warehouse"
      : reviewAreaCode ===
          "PRODUCTION"
        ? "Production"
        : "Central Kitchen";

  const reviewLeaderLabel =
    `${reviewAreaLabel} Leader`;

  const reviewProgressLabel =
    reviewAreaCode === "STORE"
      ? "Warehouse Progress"
      : reviewAreaCode ===
          "PRODUCTION"
        ? "Production Progress"
        : "Central Kitchen Progress";

  const isSectionCorrectionMode =
    Boolean(
      sessionData?.correctionMode
    ) ||
    String(
      sessionData?.reportSectionStatus ||
        ""
    )
      .trim()
      .toLowerCase() ===
      "needs_correction";

  const correctionQuestionIdSet =
    useMemo(
      () =>
        new Set<string>(
          Array.isArray(
            sessionData?.correction
              ?.questionIds
          )
            ? sessionData.correction
                .questionIds
                .map(
                  (value: unknown) =>
                    String(
                      value ||
                        ""
                    ).trim()
                )
                .filter(Boolean)
            : []
        ),
      [
        sessionData?.correction
          ?.questionIds,
      ]
    );

  const correctionReason =
    String(
      sessionData?.correction
        ?.reason ||
        ""
    ).trim();

  const correctionRound =
    Number(
      sessionData?.correction
        ?.round ||
        0
    );

  const [
    reviewBusy,
    setReviewBusy,
  ] =
    useState(false);

  const [
    reviewMessage,
    setReviewMessage,
  ] =
    useState("");

  const [
    selectedCorrectionQuestionIds,
    setSelectedCorrectionQuestionIds,
  ] =
    useState<string[]>([]);

  const [
    reviewCorrectionReason,
    setReviewCorrectionReason,
  ] =
    useState("");

  const [
    correctionReturnBusy,
    setCorrectionReturnBusy,
  ] =
    useState(false);

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
        sessionReady &&
        !submitting &&
        !result &&
        !isReopenedDraftSession &&
        !isAreaLeaderReviewMode &&
        !isSectionCorrectionMode,
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

        let session: any =
          null;

        let sessionFailure: any =
          null;

        // ====================================================
        // SESSION RETRY
        //
        // Mobile connections can be slow / interrupted.
        // Also handles a daily-report race where another
        // request creates the report milliseconds earlier.
        // ====================================================

        for (
          let attempt = 1;
          attempt <= 3;
          attempt += 1
        ) {
          try {
            const response =
              await fetch(
                `${apiBase}/session`,
                {
                  method: "POST",
                  cache: "no-store",
                  headers: {
                    "Content-Type":
                      "application/json",
                  },
                  body:
                    JSON.stringify({
                      reportId:
                        requestedReportId ||
                        null,
                    }),
                }
              );

            const payload =
              await response
                .json()
                .catch(
                  () => ({})
                );

            if (!response.ok) {
              const failure: any =
                new Error(
                  payload?.error ||
                    `Unable to start ${operationLabel} session.`
                );

              failure.status =
                response.status;

              failure.code =
                payload?.code;

              throw failure;
            }

            if (
              !payload?.reportId ||
              !payload?.reportSectionId
            ) {
              const failure: any =
                new Error(
                  `${operationLabel} session tidak lengkap: reportId / reportSectionId belum tersedia.`
                );

              failure.code =
                "SESSION_INCOMPLETE";

              throw failure;
            }

            session =
              payload;

            break;
          } catch (
            error: any
          ) {
            sessionFailure =
              error;

            const status =
              Number(
                error?.status || 0
              );

            const retryable =
              !status ||
              status >= 500 ||
              error?.code ===
                "DAILY_REPORT_EXISTS" ||
              error?.code ===
                "SESSION_INCOMPLETE";

            if (
              !retryable ||
              attempt === 3
            ) {
              break;
            }

            await new Promise(
              (resolve) =>
                setTimeout(
                  resolve,
                  attempt * 700
                )
            );
          }
        }

        if (!session) {
          throw (
            sessionFailure ||
            new Error(
              `Unable to start ${operationLabel} session.`
            )
          );
        }

        if (cancelled) return;

        setSessionData(
          session
        );

        setDisplayLocale(
          isSupportedLocale(
            session.locale
          )
            ? session.locale
            : "en"
        );

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
          setSessionData(null);

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
  }, [
    apiBase,
    operationLabel,
    requestedReportId,
    sessionRetryKey,
  ]);


  function retrySession() {
    if (submitting) {
      return;
    }

    setSessionData(null);
    setErrorMessage("");
    setLoadingExisting(true);

    setSessionRetryKey(
      (current) =>
        current + 1
    );
  }

  function setQuestionValue(
    questionId: string,
    value: boolean | number | string
  ) {

    if (
      !sessionReady ||
      submitting
    ) {
      return;
    }

    if (
      isSectionCorrectionMode &&
      !correctionQuestionIdSet.has(
        questionId
      )
    ) {
      return;
    }

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

    if (
      !sessionReady ||
      submitting
    ) {
      return;
    }

    if (
      isSectionCorrectionMode &&
      !correctionQuestionIdSet.has(
        questionId
      )
    ) {
      return;
    }

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

    if (
      isSectionCorrectionMode &&
      !correctionQuestionIdSet.has(
        questionId
      )
    ) {
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
            hasOperationalPhotoEvidence(
              answers[question.id]
            )
        ).length,
      [answers, questions]
    );

  const requiredPhotoCount =
    useMemo(
      () =>
        questions.filter(
          (question) =>
            isOperationalPhotoRequired(
              question,
              answers[question.id]
            )
        ).length,
      [answers, questions]
    );

  const requiredPhotoCompleteCount =
    useMemo(
      () =>
        questions.filter(
          (question) =>
            isOperationalPhotoRequired(
              question,
              answers[question.id]
            ) &&
            hasOperationalPhotoEvidence(
              answers[question.id]
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
    requiredPhotoCompleteCount ===
      requiredPhotoCount &&
    issueCompleteCount === issueCount &&
    photoDraftBusyCount === 0;

  const progressDenominator =
    totalQuestions +
    requiredPhotoCount;

  const progress =
    progressDenominator === 0
      ? 0
      : Math.round(
          ((answeredCount +
            requiredPhotoCompleteCount) /
            progressDenominator) *
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

  async function generatePicPdf(
    reportId: string
  ): Promise<string> {
    setSubmitStatus(
      "Preparing your CK report..."
    );

    // ========================================================
    // LOAD ALL COMPLETED SECTIONS FOR CURRENT PIC
    // ========================================================

    const response =
      await fetch(
        `/api/operations/${operation.formCode}/pic-report?reportId=${encodeURIComponent(
          reportId
        )}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
          "Unable to prepare PIC report."
      );
    }

    if (!data.readyForPdf) {
      throw new Error(
        "PIC checklist belum lengkap."
      );
    }

    const sections:
      any[] =
      Array.isArray(
        data.sections
      )
        ? data.sections
        : [];

    if (!sections.length) {
      throw new Error(
        "Tidak ada section untuk PIC PDF."
      );
    }

    // ========================================================
    // FLATTEN:
    //
    // CK SECTION
    //   -> QUESTION GROUP
    //
    // becomes:
    //
    // MAIN WAREHOUSE · CLEANING
    // MAIN WAREHOUSE · STORAGE
    // SECONDARY WAREHOUSE · GENERAL
    // ========================================================

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
                answer.existingPhoto
                  ?.storagePath
              )
          )
      );

    const totalPhotos =
      photoItems.length;

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
      // Synthetic group for questions without question_group_id
      // ------------------------------------------------------

      const hasUngrouped =
        sectionQuestions.some(
          (
            question: any
          ) =>
            !question.question_group_id
        );

      const generalGroupId =
        hasUngrouped
          ? `ck-general-${section.sectionId}`
          : null;

      if (generalGroupId) {
        pdfGroups.push({
          id:
            generalGroupId,

          code:
            `${section.code || "SECTION"}-GENERAL`,

          name:
            `${sectionName} · GENERAL`,

          description:
            null,

          sort_order:
            pdfGroups.length,
        });
      }

      // ------------------------------------------------------
      // Existing question groups
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
            `${sectionName} · ${group.name}`,

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
            question.question_group_id ||
            generalGroupId,

          code:
            question.code,

          question_text:
            question.question_text,

          help_text:
            question.help_text ??
            null,

          question_type:
            question.question_type,

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
            saved.correctiveAction ||
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
          saved.existingPhoto;

        if (
          photo?.storagePath
        ) {
          photoIndex += 1;

          setSubmitStatus(
            `Loading CK photo ${photoIndex} of ${totalPhotos}...`
          );

          const bucket =
            photo.storageBucket ||
            "operational-photos";

          const {
            data:
              photoBlob,
            error:
              photoError,
          } =
            await supabase.storage
              .from(bucket)
              .download(
                photo.storagePath
              );

          if (
            photoError ||
            !photoBlob
          ) {
            throw new Error(
              `Unable to load photo evidence: ${
                photoError?.message ||
                photo.storagePath
              }`
            );
          }

          const filename =
            photo.originalFilename ||
            `ck-photo-${photoIndex}.jpg`;

          answer.photo =
            new File(
              [
                photoBlob,
              ],
              filename,
              {
                type:
                  photo.mimeType ||
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

    const rawPicName =
      data.pic?.name ||
      pic.name ||
      "PIC";

    const safePicName =
      String(
        rawPicName
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
      "PIC";

    const parentReportNumber =
      String(
        data.report
          ?.reportNumber ||
        "CK-REPORT"
      );

    const picReportNumber =
      `${parentReportNumber}-${safePicName}`;

    // ========================================================
    // CK REPORT AREA
    //
    // Warehouse-only responsibility:
    //   CENTRAL KITCHEN - STORE
    //
    // Any non-warehouse responsibility:
    //   CENTRAL KITCHEN - PRODUCTION
    // ========================================================

    const isCentralKitchenStore =
      sections.length > 0 &&
      sections.every(
        (
          section: any
        ) => {
          const sectionIdentity =
            String(
              section.displayName ||
              section.name ||
              section.code ||
              ""
            )
              .trim()
              .toUpperCase();

          return sectionIdentity.includes(
            "WAREHOUSE"
          );
        }
      );

    const reportArea =
      isCentralKitchenStore
        ? "CENTRAL KITCHEN - STORE"
        : "CENTRAL KITCHEN - PRODUCTION";

    // ========================================================
    // BUILD PDF
    // ========================================================

    setSubmitStatus(
      "Generating your CK PDF..."
    );

    const pdfBytes =
      operation.formCode.startsWith(
        "CLOSING"
      )
        ? await buildClosingPdf({
            reportNumber:
              picReportNumber,

            outletName:
              data.outlet?.name ||
              outlet.name,

            submittedBy:
              rawPicName,

            reportArea,

            groups:
              pdfGroups,

            questions:
              pdfQuestions,

            answers:
              pdfAnswers,
          })
        : await buildOpeningPdf({
            reportNumber:
              picReportNumber,

            outletName:
              data.outlet?.name ||
              outlet.name,

            submittedBy:
              rawPicName,

            reportArea,

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
    // USER-SCOPED STORAGE PATH
    // ========================================================

    const filename =
      `${picReportNumber}.pdf`;

    const pdfStoragePath =
      `reports/${reportId}/pic/${pic.id}/${filename}`;

    setSubmitStatus(
      "Saving your CK PDF..."
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
          pdfStoragePath,
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

    if (uploadError) {
      throw new Error(
        `PIC PDF upload gagal: ${uploadError.message}`
      );
    }

    // ========================================================
    // EXPORT METADATA
    // ========================================================

    const generatedAt =
      new Date()
        .toISOString();

    const {
      error:
        exportError,
    } =
      await supabase
        .from(
          "report_pic_exports"
        )
        .upsert(
          {
            report_id:
              reportId,

            user_id:
              pic.id,

            pic_name:
              rawPicName,

            pdf_storage_path:
              pdfStoragePath,

            pdf_generated_at:
              generatedAt,

            updated_at:
              generatedAt,
          },
          {
            onConflict:
              "report_id,user_id",
          }
        );

    if (exportError) {
      throw new Error(
        `PIC PDF metadata gagal disimpan: ${exportError.message}`
      );
    }

    return pdfStoragePath;
  }

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
        `Preparing ${operationLabel}...`
      );

      // ======================================================
      // USE PRELOADED REPORT SESSION
      // ======================================================

      const session =
        sessionData;

      if (!session) {
        throw new Error(
          `${operationLabel} session belum siap. Silakan tunggu sebentar.`
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

        if (
          isSectionCorrectionMode &&
          !correctionQuestionIdSet.has(
            question.id
          )
        ) {
          continue;
        }

        const answer =
          answers[question.id];

        if (
          isOperationalPhotoRequired(
            question,
            answer
          ) &&
          !hasOperationalPhotoEvidence(
            answer
          )
        ) {
          throw new Error(
            `Photo evidence wajib belum ada: ${question.question_text}`
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
      // PDF REPORT
      //
      // Existing Opening keeps its stable single-section PDF.
      // CK does NOT generate a parent PDF from one section,
      // because multiple PICs share the same parent report.
      // Consolidated CK PDF is handled in a later phase.
      // ======================================================

      if (!operation.sectionScoped) {
        setSubmitStatus(
          "Generating PDF report..."
        );

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
          await buildOpeningPdf({
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
              type:
                "application/pdf",
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
              new Date()
                .toISOString(),
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
      }

      // ======================================================
      // SAVE ANSWERS + SUBMIT
      // ======================================================

      setSubmitStatus(
        "Saving checklist..."
      );

      const submitResponse =
        await fetch(
          `${apiBase}/submit`,
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
            `Unable to submit ${operationLabel}`
        );
      }

      let picPdfError:
        string | null = null;

      if (
        operation.sectionScoped &&
        !isProductionSection &&
        Boolean(
          submitData.picReadyForPdf
        )
      ) {
        try {
          pdfStoragePath =
            await generatePicPdf(
              reportId
            );

          setSubmitStatus(
            "Your CK PDF is ready."
          );
        } catch (
          pdfGenerationError: any
        ) {
          console.error(
            "PIC PDF generation failed:",
            pdfGenerationError
          );

          picPdfError =
            pdfGenerationError?.message ||
            "PIC PDF gagal dibuat.";

          // Checklist has already been submitted successfully.
          // PDF failure must not make the submit appear failed.
          setSubmitStatus(
            `${sectionLabel} submitted, but PIC PDF could not be generated.`
          );
        }
      } else {
        setSubmitStatus(
          operation.sectionScoped
            ? `${sectionLabel} submitted.`
            : `${operationLabel} report saved.`
        );
      }

      setResult({
        reportId:
          submitData.reportId,

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

          picCompleted:
            submitData.picCompleted ?? null,

          picAssignedCount:
            submitData.picAssignedCount ?? null,

          picCompletedCount:
            submitData.picCompletedCount ?? null,

          picReadyForPdf:
            Boolean(
              submitData.picReadyForPdf
            ),

          pdfStoragePath,
          pdfError:
            picPdfError,
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
      `*${operationLabel.toUpperCase()}*`,
      "*CHONG QING HOT POT*",
      "",
      `📍 Outlet: ${outlet.name}`,
      `📅 Date: ${date}`,
      `⏰ Submitted: ${time} WIB`,
      `🏷 Section: ${sectionLabel}`,
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
      `*${
        result.completed
          ? `${operationLabel.toUpperCase()} COMPLETED`
            : `${(sectionLabel ?? operation.sectionName).toUpperCase()} SUBMITTED`
      }*`
    );

    return lines.join("\n");
  }

  // ==========================================================
  // CK CONSOLIDATED PIC REPORT TEXT
  //
  // Used after all sections assigned to the current PIC
  // are complete. Detailed checklist stays in the PDF.
  // ==========================================================

  async function buildPicConsolidatedReportText() {

    if (!result) return "";

    const response =
      await fetch(
        `/api/operations/${operation.formCode}/pic-report?reportId=${encodeURIComponent(
          result.reportId
        )}`,
        {
          cache: "no-store",
        }
      );

    const data =
      await response.json();

    if (
      !response.ok ||
      !data?.readyForPdf
    ) {
      throw new Error(
        data?.error ||
          "Unable to prepare consolidated CK summary."
      );
    }

    const sections: any[] =
      Array.isArray(
        data.sections
      )
        ? data.sections
        : [];

    const submittedDate =
      new Date(
        result.submittedAt
      );

    const timezone =
      data.outlet?.timezone ||
      "Asia/Jakarta";

    const date =
      new Intl.DateTimeFormat(
        "id-ID",
        {
          dateStyle: "long",
          timeZone: timezone,
        }
      ).format(
        submittedDate
      );

    const time =
      new Intl.DateTimeFormat(
        "id-ID",
        {
          hour: "2-digit",
          minute: "2-digit",
          timeZone: timezone,
        }
      ).format(
        submittedDate
      );

    const rawPicName =
      data.pic?.name ||
      pic.name ||
      "PIC";

    const safePicName =
      String(rawPicName)
        .normalize("NFKD")
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
      "PIC";

    const parentReportNumber =
      String(
        data.report?.reportNumber ||
        result.reportNumber
      );

    const picReportNumber =
      `${parentReportNumber}-${safePicName}`;

    let totalQuestions = 0;
    let totalAnswers = 0;
    let totalPhotos = 0;
    let totalIssues = 0;

    const sectionSummaryLines:
      string[] = [];

    for (
      const section of
      sections
    ) {

      const sectionName =
        section.displayName ||
        section.name ||
        section.code ||
        "Section";

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

      const questionCount =
        sectionQuestions.length;

      const answerCount =
        sectionAnswers.length;

      const photoCount =
        sectionAnswers.filter(
          (answer: any) =>
            Boolean(
              answer.existingPhoto
                ?.storagePath
            )
        ).length;

      const issueCount =
        sectionAnswers.filter(
          (answer: any) =>
            answer.isCompliant ===
            false
        ).length;

      totalQuestions +=
        questionCount;

      totalAnswers +=
        answerCount;

      totalPhotos +=
        photoCount;

      totalIssues +=
        issueCount;

      sectionSummaryLines.push(
        `- ${sectionName}: ${answerCount}/${questionCount} | Photos: ${photoCount} | Issues: ${issueCount}`
      );
    }

    const assignedCount =
      Number(
        data.picAssignedCount
      ) ||
      sections.length;

    const completedCount =
      Number(
        data.picCompletedCount
      ) ||
      sections.length;

    const operationTitle =
      String(
        data.operation?.displayName ||
        operationLabel
      ).toUpperCase();

    const lines:
      string[] = [
        `*${operationTitle}*`,
        "*CHONG QING HOT POT*",
        "",
        `📍 Outlet: ${data.outlet?.name || outlet.name}`,
        `👤 PIC: ${rawPicName}`,
        `📅 Date: ${date}`,
        `⏰ Submitted: ${time} WIB`,
        `🏷 Sections Completed: ${completedCount}/${assignedCount}`,
        "",
        "*OVERALL SUMMARY*",
        `- Total Checklist: ${totalAnswers}/${totalQuestions}`,
        `- Photo Evidence: ${totalPhotos}`,
        `- Issues: ${totalIssues}`,
        "- Status: Completed",
        "",
        "*SECTION SUMMARY*",
        ...sectionSummaryLines,
        "",
        "*REPORT INFO*",
        `- Report ID: ${picReportNumber}`,
        `- PIC: ${rawPicName}`,
        `- Sections: ${completedCount}/${assignedCount}`,
        "",
        `✅ *${operationTitle} COMPLETED*`,
      ];

    return lines.join(
      "\n"
    );

  }

  async function getReportTextForSharing() {

    if (
      operation.sectionScoped &&
      result?.picReadyForPdf
    ) {
      return await buildPicConsolidatedReportText();
    }

    return buildReportText();

  }

  async function copyReport() {

    try {

      const text =
        await getReportTextForSharing();

      await navigator.clipboard.writeText(
        text
      );

      alert(
        "Report text copied."
      );

    } catch (error: any) {

      console.error(
        "Unable to copy report:",
        error
      );

      alert(
        error?.message ||
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
        await getReportTextForSharing();

      const shareTitle =
        `${operationLabel} - ${sectionLabel} - ${outlet.name}`;

      // ======================================================
      // COMPACT FALLBACK TEXT
      //
      // Full report tetap menjadi pilihan utama.
      // Compact version hanya dipakai jika native share
      // menolak kombinasi PDF + full text.
      // ======================================================

      const compactReportText =
        reportText.length <= 3200
          ? reportText
          : `${reportText.slice(
              0,
              3000
            )}

... Full checklist detail is available in the attached PDF.`;

      // ======================================================
      // NATIVE SHARE
      // ======================================================

      const canShareFiles =
        typeof navigator.canShare ===
        "function"
          ? navigator.canShare({
              files: [file],
            })
          : true;

      if (
        navigator.share &&
        canShareFiles
      ) {
        // ----------------------------------------------------
        // ATTEMPT 1
        // PDF + FULL REPORT TEXT
        // ----------------------------------------------------

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
            "Opening PDF + full text share failed:",
            combinedError
          );
        }


        // ----------------------------------------------------
        // ATTEMPT 2
        // PDF + COMPACT REPORT TEXT
        //
        // Some Android / iOS share targets reject a large
        // text payload when a PDF is attached.
        // ----------------------------------------------------

        try {
          await navigator.share({
            title:
              shareTitle,

            text:
              compactReportText,

            files: [
              file,
            ],
          });

          return;
        } catch (
          compactShareError: any
        ) {
          if (
            compactShareError?.name ===
            "AbortError"
          ) {
            return;
          }

          console.warn(
            "Opening PDF + compact text share failed:",
            compactShareError
          );
        }


        // ----------------------------------------------------
        // LAST MOBILE FALLBACK
        //
        // Never silently lose the report text.
        // Copy full text before sharing PDF-only.
        // ----------------------------------------------------

        let textCopied =
          false;

        try {
          await navigator.clipboard.writeText(
            reportText
          );

          textCopied =
            true;
        } catch (
          clipboardError
        ) {
          console.warn(
            "Unable to copy Opening report text:",
            clipboardError
          );
        }

        if (textCopied) {
          alert(
            "Perangkat ini tidak dapat mengirim PDF + text sekaligus. Full report text sudah dicopy. Setelah memilih WhatsApp, paste text pada caption/message."
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
            "Opening PDF-only share failed:",
            fileShareError
          );
        }
      }


      // ======================================================
      // DESKTOP / BROWSER FALLBACK
      //
      // Download PDF + copy report text + open WhatsApp.
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
          "Unable to copy Opening report text:",
          clipboardError
        );
      }

      const whatsappText =
        encodeURIComponent(
          reportText
        );

      window.open(
        `https://wa.me/?text=${whatsappText}`,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (error: any) {
      console.error(
        "Opening share report failed:",
        error
      );

      alert(
        error?.message ||
          "Unable to share Opening report."
      );
    }
  }

  async function retryPicPdfGeneration() {
    if (
      !result ||
      !operation.sectionScoped ||
      !result.picReadyForPdf
    ) {
      return;
    }

    try {
      setSubmitStatus(
        "Retrying your CK PDF..."
      );

      setResult(
        (
          current
        ) =>
          current
            ? {
                ...current,
                pdfError:
                  null,
              }
            : current
      );

      const newPdfStoragePath =
        await generatePicPdf(
          result.reportId
        );

      setResult(
        (
          current
        ) =>
          current
            ? {
                ...current,
                pdfStoragePath:
                  newPdfStoragePath,
                pdfError:
                  null,
              }
            : current
      );

      setSubmitStatus(
        "Your CK PDF is ready."
      );
    } catch (
      error: any
    ) {
      console.error(
        "PIC PDF retry failed:",
        error
      );

      const message =
        error?.message ||
        "PIC PDF gagal dibuat.";

      setResult(
        (
          current
        ) =>
          current
            ? {
                ...current,
                pdfError:
                  message,
              }
            : current
      );

      setSubmitStatus(
        "Checklist submitted. PIC PDF generation failed."
      );
    }
  }

  // ==========================================================
  // MARK CK AREA SECTION REVIEWED
  // ==========================================================

  async function markAreaSectionReviewed() {
    if (
      !isAreaLeaderReviewMode ||
      !sessionData?.canMarkReviewed ||
      !sessionData?.reportId ||
      reviewBusy
    ) {
      return;
    }

    try {
      setReviewBusy(true);
      setErrorMessage("");
      setReviewMessage(
        `Saving ${reviewLeaderLabel} review...`
      );

      const response =
        await fetch(
          `${apiBase}/review`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                reportId:
                  sessionData.reportId,
              }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "Unable to mark section as reviewed."
        );
      }

      setSessionData(
        (
          current: any
        ) => ({
          ...current,

          reportSectionStatus:
            "reviewed",

          canMarkReviewed:
            false,

          review: {
            ...(
              current?.review ||
              {}
            ),

            reviewedBy:
              data.reviewedBy ??
              null,

            reviewedAt:
              data.reviewedAt ??
              null,
          },
        })
      );

      setReviewMessage(
        `${sectionLabel} reviewed successfully.`
      );

    } catch (
      error: any
    ) {
      console.error(
        "Production section review failed:",
        error
      );

      setErrorMessage(
        error?.message ||
        "Unable to review section."
      );

      setReviewMessage("");
    } finally {
      setReviewBusy(false);
    }
  }


  function toggleCorrectionQuestion(
    questionId: string
  ) {
    if (
      correctionReturnBusy ||
      reviewBusy
    ) {
      return;
    }

    setSelectedCorrectionQuestionIds(
      current =>
        current.includes(
          questionId
        )
          ? current.filter(
              id =>
                id !==
                questionId
            )
          : [
              ...current,
              questionId,
            ]
    );

    setErrorMessage("");
  }


  async function returnAreaSectionForCorrection() {
    if (
      !isAreaLeaderReviewMode ||
      !sessionData?.reportId ||
      correctionReturnBusy ||
      reviewBusy
    ) {
      return;
    }


    const reason =
      reviewCorrectionReason
        .trim();


    if (
      selectedCorrectionQuestionIds
        .length === 0
    ) {
      setErrorMessage(
        "Pilih minimal 1 checklist item yang perlu diperbaiki."
      );

      return;
    }


    if (
      reason.length < 5
    ) {
      setErrorMessage(
        "Reason for Correction wajib diisi minimal 5 karakter."
      );

      return;
    }


    const confirmed =
      window.confirm(
        `Return ${selectedCorrectionQuestionIds.length} item(s) dari ${sectionLabel} untuk diperbaiki?`
      );


    if (!confirmed) {
      return;
    }


    try {
      setCorrectionReturnBusy(
        true
      );

      setErrorMessage("");

      setReviewMessage(
        "Returning section for correction..."
      );


      const response =
        await fetch(
          `${apiBase}/return-for-correction`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                reportId:
                  sessionData
                    .reportId,

                reason,

                questionIds:
                  selectedCorrectionQuestionIds,
              }),
          }
        );


      const data =
        await response.json();


      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to return section for correction."
        );
      }


      setReviewMessage(
        `${sectionLabel} returned for correction.`
      );


      window.location.assign(
        "/protected/central-kitchen"
      );

    } catch (
      error: any
    ) {
      console.error(
        "Return for correction failed:",
        error
      );

      setErrorMessage(
        error?.message ||
          "Unable to return section for correction."
      );

      setReviewMessage("");

    } finally {
      setCorrectionReturnBusy(
        false
      );
    }
  }


  function reviewValue(
    question: Question,
    answer:
      | AnswerState
      | undefined
  ) {
    const value =
      answer?.value;

    if (
      typeof value ===
      "boolean"
    ) {
      return value
        ? "YES"
        : "NO";
    }

    if (
      value ===
        null ||
      value ===
        undefined ||
      value ===
        ""
    ) {
      return "—";
    }

    if (
      question.question_type ===
        "temperature"
    ) {
      return `${value}${
        question.unit ||
        ""
      }`;
    }

    return String(
      value
    );
  }


  if (
    isAreaLeaderReviewMode &&
    !result
  ) {
    const reviewed =
      String(
        sessionData
          ?.reportSectionStatus ||
        ""
      )
        .trim()
        .toLowerCase() ===
      "reviewed";

    const reviewedAt =
      sessionData
        ?.review
        ?.reviewedAt;

    const reviewedAtText =
      reviewedAt
        ? (() => {
            try {
              return new Intl.DateTimeFormat(
                "id-ID",
                {
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
                  timeZone:
                    "Asia/Jakarta",
                }
              ).format(
                new Date(
                  reviewedAt
                )
              );
            } catch {
              return null;
            }
          })()
        : null;

    return (
      <section className="mt-6 overflow-hidden rounded-[28px] border border-red-100 bg-white shadow-sm">

        <div className="border-b border-red-100 bg-red-50/50 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
                {reviewLeaderLabel} Review
              </p>

              <h2 className="mt-1 text-2xl font-black text-neutral-950">
                {sectionLabel}
              </h2>

              <p className="mt-2 text-sm leading-6 text-neutral-600">
                Checklist sudah disubmit dan dikunci.
                Review seluruh jawaban, notes, issue,
                dan photo evidence sebelum approval.
              </p>
            </div>

            <span
              className={`inline-flex w-fit rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wide ${
                reviewed
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {reviewed
                ? "Reviewed"
                : "Submitted"}
            </span>
          </div>
        </div>


        <div className="space-y-4 p-4 sm:p-6">
          {questions.map(
            (
              question,
              index
            ) => {
              const answer =
                answers[
                  question.id
                ];

              const group =
                groups.find(
                  item =>
                    item.id ===
                    question
                      .question_group_id
                );

              const hasIssue =
                answer
                  ?.isCompliant ===
                false;

              return (
                <article
                  key={
                    question.id
                  }
                  className={`rounded-2xl border p-4 transition sm:p-5 ${
                    selectedCorrectionQuestionIds.includes(
                      question.id
                    )
                      ? "border-amber-300 bg-amber-50/40 ring-2 ring-amber-100"
                      : "border-neutral-200 bg-white"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-black text-neutral-600">
                      {index + 1}
                    </div>

                    <div className="min-w-0 flex-1">
                      {group && (
                        <p className="text-[10px] font-black uppercase tracking-[0.13em] text-neutral-400">
                          {groupName(group)}
                        </p>
                      )}

                      <p className="mt-1 text-sm font-bold leading-6 text-neutral-900">
                        {questionText(question)}
                      </p>
                    </div>

                    <label
                      className={`flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wide transition ${
                        selectedCorrectionQuestionIds.includes(
                          question.id
                        )
                          ? "border-amber-300 bg-amber-100 text-amber-900"
                          : "border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={
                          selectedCorrectionQuestionIds.includes(
                            question.id
                          )
                        }
                        disabled={
                          correctionReturnBusy ||
                          reviewBusy
                        }
                        onChange={() =>
                          toggleCorrectionQuestion(
                            question.id
                          )
                        }
                        className="h-4 w-4 accent-amber-700"
                      />

                      <span>
                        Correction
                      </span>
                    </label>
                  </div>

                  <div className="mt-4 rounded-xl bg-neutral-50 px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-neutral-400">
                      Answer
                    </p>

                    <p className="mt-1 text-sm font-black text-neutral-900">
                      {reviewValue(
                        question,
                        answer
                      )}
                    </p>
                  </div>

                  {answer
                    ?.notes
                    ?.trim() && (
                    <div className="mt-3 rounded-xl border border-neutral-200 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-neutral-400">
                        {copy.notes}
                      </p>

                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-neutral-700">
                        {
                          answer.notes
                        }
                      </p>
                    </div>
                  )}

                  {answer
                    ?.correctiveAction
                    ?.trim() && (
                    <div className="mt-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-red-600">
                        {copy.correctiveAction}
                      </p>

                      <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-red-800">
                        {
                          answer
                            .correctiveAction
                        }
                      </p>
                    </div>
                  )}

                  {hasIssue && (
                    <div className="mt-3">
                      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-red-700">
                        Issue
                      </span>
                    </div>
                  )}

                  {answer
                    ?.existingPhotoFile && (
                    <PhotoEvidencePreview
                      file={
                        answer
                          .existingPhotoFile
                      }
                      label={
                        question
                          .question_text
                      }
                    />
                  )}

                  {!answer
                    ?.existingPhotoFile &&
                    answer
                      ?.existingStoragePath && (
                      <p className="mt-3 text-xs font-semibold text-emerald-700">
                        Photo Evidence ✓
                      </p>
                    )}
                </article>
              );
            }
          )}
        </div>


        <div className="border-t border-neutral-100 bg-neutral-50 p-5 sm:p-6">

          <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-amber-700">
                  Return for Correction
                </p>

                <p className="mt-1 text-sm font-bold text-neutral-900">
                  {
                    selectedCorrectionQuestionIds
                      .length
                  }{" "}
                  item(s) selected
                </p>
              </div>

              {reviewed && (
                <span className="rounded-full border border-amber-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wide text-amber-700">
                  Reopens Review
                </span>
              )}
            </div>

            <p className="mt-3 text-xs leading-5 text-amber-900">
              Pilih hanya checklist item yang perlu diperbaiki.
              PIC hanya akan dapat mengubah item yang dipilih.
            </p>

            <div className="mt-4">
              <label className="text-[10px] font-black uppercase tracking-wide text-neutral-500">
                Reason for Correction *
              </label>

              <textarea
                rows={3}
                value={
                  reviewCorrectionReason
                }
                disabled={
                  correctionReturnBusy ||
                  reviewBusy
                }
                onChange={event =>
                  setReviewCorrectionReason(
                    event.target.value
                  )
                }
                placeholder="Contoh: Wrong photo evidence pada chiller cleanliness."
                className="mt-2 w-full resize-none rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm leading-6 text-neutral-900 outline-none transition focus:border-amber-400"
              />
            </div>

            <button
              type="button"
              disabled={
                correctionReturnBusy ||
                reviewBusy ||
                selectedCorrectionQuestionIds
                  .length === 0 ||
                reviewCorrectionReason
                  .trim()
                  .length < 5
              }
              onClick={
                returnAreaSectionForCorrection
              }
              className="mt-3 flex w-full items-center justify-center rounded-xl bg-amber-700 px-4 py-3.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:bg-amber-200 disabled:text-amber-500"
            >
              {correctionReturnBusy
                ? "Returning for Correction..."
                : `Return ${
                    selectedCorrectionQuestionIds
                      .length || ""
                  } ${
                    selectedCorrectionQuestionIds
                      .length === 1
                      ? "Item"
                      : "Items"
                  } for Correction`}
            </button>
          </div>

          {reviewed ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
              <p className="text-xs font-black uppercase tracking-wide text-emerald-700">
                ✓ Section Reviewed
              </p>

              <p className="mt-1 text-xs font-semibold text-neutral-600">
                Reviewed by Production Leader
                {reviewedAtText
                  ? ` · ${reviewedAtText}`
                  : ""}
              </p>
            </div>
          ) : (
            <button
              type="button"
              disabled={
                reviewBusy ||
                correctionReturnBusy ||
                selectedCorrectionQuestionIds
                  .length > 0 ||
                !sessionData
                  ?.canMarkReviewed
              }
              onClick={
                markAreaSectionReviewed
              }
              className="flex w-full items-center justify-center rounded-xl bg-red-700 px-4 py-3.5 text-xs font-black uppercase tracking-wide text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
            >
              {reviewBusy
                ? "Saving Review..."
                : "Mark as Reviewed"}
            </button>
          )}

          {!reviewed &&
            selectedCorrectionQuestionIds
              .length > 0 && (
              <p className="mt-2 text-center text-[11px] font-semibold text-amber-700">
                Clear correction selection before marking this section as reviewed.
              </p>
            )}

          {reviewMessage && (
            <p className="mt-3 text-center text-xs font-semibold text-emerald-700">
              {reviewMessage}
            </p>
          )}

          {errorMessage && (
            <p className="mt-3 text-center text-xs font-semibold text-red-600">
              {errorMessage}
            </p>
          )}

          <Link
            href="/protected/central-kitchen"
            className="mt-3 flex w-full items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-3 text-xs font-black text-neutral-700 transition hover:bg-neutral-100"
          >
            Back to {reviewProgressLabel}
          </Link>
        </div>

      </section>
    );
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
            {isSectionCorrectionMode
              ? "Correction Resubmitted"
              : operation.sectionScoped
                ? "Checklist Saved"
                : "Report Saved"}
          </p>

          <h2 className="mt-2 text-3xl font-bold tracking-tight text-neutral-900">
            {isSectionCorrectionMode
              ? `${sectionLabel} Correction Submitted`
              : operation.sectionScoped
                ? result.picCompleted
                  ? "PIC Checklist Completed"
                  : `${sectionLabel} Submitted`
                : result.completed
                  ? `${operationLabel} Completed`
                  : `${sectionLabel} Submitted`}
          </h2>

          <p className="mt-2 text-neutral-500">
            {outlet.name}
          </p>

          {operation.sectionScoped && (
            <p className="mt-1 text-sm font-semibold text-red-700">
              {operationLabel} · {sectionLabel}
            </p>
          )}

          <p className="mt-1 text-sm text-neutral-400">
            {submittedTime} WIB
          </p>

          <div className="mt-8 grid grid-cols-3 gap-3 text-neutral-900">
            <SummaryStat
              label={
                isSectionCorrectionMode
                  ? "Corrected Items"
                  : "Checklist"
              }
              value={
                isSectionCorrectionMode
                  ? `${result.answerCount}`
                  : `${result.answerCount}/${totalQuestions}`
              }
            />

            <SummaryStat
              label={
                isSectionCorrectionMode
                  ? "Photos Updated"
                  : "Photos"
              }
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

          {operation.sectionScoped &&
              isProductionSection && (
                <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-5 text-left">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">
                        Section PIC
                      </p>

                      <p className="mt-1 font-bold text-neutral-900">
                        {pic.name}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-bold tracking-wide text-emerald-700">
                      {isSectionCorrectionMode
                        ? "CORRECTION RESUBMITTED"
                        : "SECTION SUBMITTED"}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-neutral-600">
                    {isSectionCorrectionMode
                      ? "Correction berhasil dikirim. Production Leader perlu melakukan review ulang sebelum section dapat masuk ke Final Production report."
                      : "Section Anda sudah berhasil disubmit. Final Production report akan direview dan difinalisasi oleh Production Leader."}
                  </p>
                </div>
              )}

            {operation.sectionScoped &&
              !isProductionSection && (
            <div className="mt-6 rounded-2xl border border-neutral-200 bg-neutral-50 px-5 py-5 text-left">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-neutral-400">
                    PIC Progress
                  </p>

                  <p className="mt-1 font-bold text-neutral-900">
                    {pic.name}
                  </p>
                </div>

                <span className="shrink-0 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-[11px] font-bold tracking-wide text-neutral-700">
                  {result.pdfStoragePath
                    ? "PDF READY"
                    : result.picReadyForPdf
                      ? result.pdfError
                        ? "PDF FAILED"
                        : "PDF PENDING"
                      : "IN PROGRESS"}
                </span>
              </div>

              <div className="mt-5 flex items-center justify-between text-sm">
                <span className="font-medium text-neutral-500">
                  Sections completed
                </span>

                <span className="font-bold text-neutral-900">
                  {result.picCompletedCount ?? 0}
                  {" / "}
                  {result.picAssignedCount ?? 0}
                </span>
              </div>

              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-200">
                <div
                  className="h-full rounded-full bg-red-700 transition-all"
                  style={{
                    width: `${Math.round(
                      (
                        (result.picCompletedCount ?? 0) /
                        Math.max(
                          result.picAssignedCount ?? 0,
                          1
                        )
                      ) * 100
                    )}%`,
                  }}
                />
              </div>

              {result.picCompleted && (
                <p className="mt-3 text-sm font-semibold text-emerald-700">
                  ✓ All required sections assigned to you are complete.
                </p>
              )}

              {result.pdfError && (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-amber-800">
                    PDF Generation Failed
                  </p>

                  <p className="mt-1 break-words text-sm leading-5 text-amber-900">
                    {result.pdfError}
                  </p>

                  <p className="mt-2 text-xs leading-5 text-amber-700">
                    Checklist sudah tersimpan. Anda tidak perlu submit section kembali.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="mt-7 grid gap-3">
            {!isProductionSection &&
              result.pdfStoragePath && (
              <>
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
              </>
            )}

            {operation.sectionScoped &&
              !isProductionSection &&
              result.picReadyForPdf &&
              !result.pdfStoragePath && (
                <button
                  type="button"
                  onClick={
                    retryPicPdfGeneration
                  }
                  className="rounded-xl border border-amber-300 bg-amber-50 px-6 py-4 font-semibold text-amber-900 transition hover:bg-amber-100"
                >
                  ↻ Retry Generate PDF
                </button>
              )}

            {!isProductionSection && (
            <button
              type="button"
              onClick={
                copyReport
              }
              className="rounded-xl bg-[#222] px-6 py-4 font-semibold text-white transition hover:bg-black"
            >
              📋 Copy Report Text
            </button>
            )}

            <Link
              href={
                operation.sectionScoped
                  ? "/protected/central-kitchen"
                  : "/protected"
              }
              className="rounded-xl border border-neutral-200 px-6 py-4 font-semibold text-neutral-700 transition hover:bg-neutral-50"
            >
              {operation.sectionScoped
                ? "Back to CK Sections"
                : "Back to Dashboard"}
            </Link>
          </div>

          {result.pdfStoragePath ? (
            <p className="mt-5 text-xs leading-5 text-neutral-400">
              Share PDF membuka native share sheet pada HP/tablet yang mendukung. Pilih WhatsApp lalu group outlet yang dituju. Pada desktop, PDF akan didownload untuk dilampirkan manual ke WhatsApp Web.
            </p>
          ) : (
            <p className="mt-5 text-xs leading-5 text-neutral-400">
              {operation.sectionScoped
                ? isProductionSection
                  ? "Section berhasil disimpan. Final Production report akan direview dan difinalisasi oleh Production Leader."
                  : result.picReadyForPdf
                  ? result.pdfError
                    ? "Checklist PIC sudah lengkap, tetapi PDF belum berhasil dibuat. Gunakan Retry Generate PDF di atas."
                    : "Checklist PIC sudah lengkap. PDF PIC sedang dipersiapkan."
                  : "Section berhasil disimpan. PDF PIC akan dibuat otomatis setelah seluruh required section yang ditugaskan kepada Anda selesai."
                : "Report berhasil disimpan."}
            </p>
          )}
        </div>
      </section>
    );
  }

  // ==========================================================
  // FORM
  // ==========================================================

  return (
    <>
      {isCkProductionSection && sessionData?.reportBusinessDate && (
        <section className="mt-6 rounded-2xl border border-sky-200 bg-sky-50 px-5 py-4 text-sm text-sky-900">
          <p className="font-bold">Previous Closing Still Open</p>
          <p className="mt-1">Business Date: {sessionData.reportBusinessDate}</p>
        </section>
      )}

      {isCkProductionSection && sessionData?.reportSectionId && (
        <section className="mt-6 rounded-2xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-neutral-500">Production today?</p>
              {sessionData.applicabilityStatus === "no_production" && <p className="mt-2 text-sm font-semibold text-amber-800">NO PRODUCTION TODAY</p>}
              {sessionData.noProductionReason && <p className="mt-1 text-sm text-neutral-700">Reason: {sessionData.noProductionReason}</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={applicabilitySaving} onClick={() => setApplicability("active")} className="rounded-lg border border-neutral-200 px-3 py-2 text-xs font-semibold text-neutral-700">Operating Today</button>
              <button type="button" disabled={applicabilitySaving} onClick={() => { const reason = window.prompt("Reason for No Production Today"); if (reason !== null) void setApplicability("no_production", reason); }} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">No Production Today</button>
            </div>
          </div>
        </section>
      )}

      {isCkProductionSection && sessionData?.applicabilityStatus === "no_production" && (
        <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          Normal question entry is disabled for this section while it is marked no production. Existing answers and evidence are preserved.
          <div className="mt-3"><button type="button" onClick={() => setApplicability("active")} disabled={applicabilitySaving} className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-800">Restore Operating Today</button></div>
        </section>
      )}

      <div className="mt-6 flex justify-end">
        <div className="inline-flex rounded-xl border border-neutral-200 bg-white p-1 shadow-sm">
          {([
            ["id-ID", "ID"],
            ["en", "EN"],
          ] as const).map(
            ([locale, label]) => (
              <button
                key={locale}
                type="button"
                onClick={() =>
                  setDisplayLocale(locale)
                }
                className={`rounded-lg px-3 py-1.5 text-[10px] font-black tracking-wide transition ${
                  displayLocale === locale
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-500 hover:bg-neutral-100"
                }`}
                aria-pressed={
                  displayLocale === locale
                }
              >
                {label}
              </button>
            )
          )}
        </div>
      </div>

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
            label="Required Photos"
            value={`${requiredPhotoCompleteCount}/${requiredPhotoCount}`}
            complete={
              requiredPhotoCompleteCount ===
              requiredPhotoCount
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
            {sessionReady
                ? "Submit failed:"
                : "Session failed:"}
          </strong>{" "}
          {errorMessage}

          {!sessionReady &&
            !loadingExisting && (
              <button
                type="button"
                onClick={
                  retrySession
                }
                className="mt-3 block rounded-xl border border-red-200 bg-white px-4 py-2 text-xs font-bold text-red-700"
              >
                Retry Session
              </button>
            )}
        </div>
      )}

      <div className={`mt-4 space-y-6 sm:mt-8 sm:space-y-8 ${isCkProductionSection && sessionData?.applicabilityStatus === "no_production" ? "pointer-events-none select-none opacity-45" : ""}`}>
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
                      {groupName(group)}
                    </h2>

                    {groupDescription(group) && (
                      <p className="mt-1.5 text-sm font-medium leading-5 text-neutral-700">
                        {groupDescription(group)}
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

                      const evidenceMode =
                        getOperationalEvidenceMode(
                          question
                        );

                      const photoRequired =
                        isOperationalPhotoRequired(
                          question,
                          answer
                        );

                      const needsReview =
                        question
                          .config
                          ?.needs_review ===
                        true;

                      const needsCorrection =
                        (
                          isReopenedSession &&
                          reopenQuestionIdSet.has(
                            question.id
                          )
                        ) ||
                        (
                          isSectionCorrectionMode &&
                          correctionQuestionIdSet.has(
                            question.id
                          )
                        );

                      const correctionLocked =
                        isSectionCorrectionMode &&
                        !correctionQuestionIdSet.has(
                          question.id
                        );


                      return (
                        <div
                          key={
                            question.id
                          }
                          className={`-mx-2 rounded-[18px] border p-4 text-neutral-900 shadow-sm sm:mx-0 sm:rounded-[22px] sm:p-6 ${
                            correctionLocked
                              ? "pointer-events-none border-neutral-200 bg-neutral-50 opacity-55"
                              : needsCorrection &&
                                  isSectionCorrectionMode
                                ? "border-amber-300 bg-white ring-2 ring-amber-100"
                                : "border-black/5 bg-white"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-xs font-semibold text-neutral-500">
                              {index +
                                1}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-start gap-2">
                                <p className="font-semibold leading-6 text-neutral-900">
                                  {questionText(question)}
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
                                    {isSectionCorrectionMode
                                      ? copy.correctionRequired
                                      : copy.adminRequestedCorrection}
                                  </span>
                                </div>
                              )}

                              {correctionLocked && (
                                <div className="mt-3">
                                  <span className="inline-flex rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-neutral-500">
                                    🔒 Locked
                                  </span>
                                </div>
                              )}

                              {questionHelpText(question) && (
                                <p className="mt-2 text-sm text-neutral-500">
                                  {questionHelpText(question)}
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
                                      {copy.yes}
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
                                      {copy.no}
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
                                        {copy.standard}{" "}
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
                                        {copy.standard} ≤{" "}
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
                                        ? copy.outOfStandard
                                        : copy.withinStandard}
                                    </span>
                                  )}
                                </div>
                              )}

                              <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4 text-neutral-900">
                                <div className="flex items-center justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold">
                                      {copy.photoEvidence}
                                      {photoRequired
                                        ? " *"
                                        : ""}
                                    </p>

                                    <p className="mt-1 text-xs text-neutral-500">
                                      {evidenceMode ===
                                      "always"
                                        ? "Wajib untuk pertanyaan ini"
                                        : evidenceMode ===
                                            "on_issue"
                                          ? photoRequired
                                            ? "Wajib karena ditemukan issue"
                                            : "Wajib hanya jika ditemukan issue"
                                          : "Tidak wajib"}
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

                                {(
                                  photoRequired ||
                                  (
                                    isSectionCorrectionMode &&
                                    needsCorrection
                                  )
                                ) && (
                                  <div className="mt-4 grid grid-cols-2 gap-2.5">
                                  <label className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 text-center text-xs font-black text-red-700 transition ${submitting || !sessionData?.reportId || !sessionData?.reportSectionId ? "cursor-wait opacity-45" : "cursor-pointer active:scale-[0.99]"}`}>
                                    <span className="text-base">📷</span>
                                    <span>{copy.takePhoto}</span>
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
                                    <span>{copy.gallery}</span>
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

                                )}

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
                                    {copy.actionRequired}
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
                                        {copy.notes}
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
                                        {copy.correctiveAction}
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
                    {requiredPhotoCompleteCount}/{requiredPhotoCount} required photos
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
                    !sessionReady
                      ? loadingExisting
                        ? "bg-blue-50 text-blue-700"
                        : "bg-red-50 text-red-700"
                      : draftStatus === "error"
                        ? "bg-amber-50 text-amber-700"
                        : draftStatus === "saving" ||
                            draftStatus === "loading"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {!sessionReady
                    ? loadingExisting
                      ? copy.startingSession
                      : copy.sessionError
                    : draftStatus === "error"
                      ? "Draft error"
                      : draftStatus === "saving"
                        ? copy.saving
                        : draftStatus === "loading"
                          ? copy.loading
                          : `✓ ${copy.saved}`}
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
              (
                !sessionReady ||
                draftStatus !== "idle"
              ) && (
                <div
                  className={`mb-3 rounded-xl px-4 py-2 text-xs font-semibold ${
                    !sessionReady
                      ? loadingExisting
                        ? "bg-blue-50 text-blue-700"
                        : "bg-red-50 text-red-700"
                      : draftStatus === "error"
                        ? "bg-amber-50 text-amber-700"
                        : draftStatus === "saving" ||
                            draftStatus === "loading"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {!sessionReady
                    ? loadingExisting
                      ? "Starting operational session..."
                      : "Operational session belum siap."
                    : draftStatus === "loading"
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

          {isSectionCorrectionMode && (
            <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-amber-700 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                  Correction Round {correctionRound || 1}
                </span>

                <span className="text-xs font-bold text-amber-900">
                  {correctionQuestionIdSet.size} item(s) opened for correction
                </span>
              </div>

              {correctionReason && (
                <div className="mt-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-amber-700">
                    Reason
                  </p>

                  <p className="mt-1 text-sm font-medium leading-6 text-amber-950">
                    {correctionReason}
                  </p>
                </div>
              )}

              <p className="mt-3 text-xs leading-5 text-amber-800">
                Hanya item bertanda Correction Required yang dapat diperbaiki.
                Item lainnya tetap terkunci.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-semibold">
                {operation.sectionScoped
                  ? sectionLabel
                  : operationKind}{" "}
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
                  requiredPhotoCompleteCount
                }
                /
                {
                  requiredPhotoCount
                }{" "}
                required photos
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
                ? isSectionCorrectionMode
                  ? copy.resubmittingCorrection
                  : copy.submitting
                : isSectionCorrectionMode
                  ? copy.resubmitCorrection
                  : operation.sectionScoped
                    ? `${copy.submit} ${sectionLabel}`
                    : `${copy.submit} ${operationKind}`}
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

                {requiredPhotoCompleteCount !==
                  requiredPhotoCount &&
                  `${
                    requiredPhotoCount -
                    requiredPhotoCompleteCount
                  } required photo evidence belum diupload. `}

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
