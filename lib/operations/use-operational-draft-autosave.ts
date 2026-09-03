"use client";

import {
  useEffect,
  useRef,
  useState,
} from "react";

type DraftStatus =
  | "idle"
  | "loading"
  | "saving"
  | "saved"
  | "error";

type Params = {
  supabase: any;
  reportId?: string | null;
  answers: Record<string, any>;
  setAnswers: any;
  enabled: boolean;
};

function makePayload(
  answers: Record<string, any>
) {
  const payload:
    Record<string, any> = {};

  for (
    const [questionId, answer]
    of Object.entries(answers)
  ) {
    const hasValue =
      answer?.value !== undefined &&
      answer?.value !== "";

    const notes =
      answer?.notes ?? "";

    const correctiveAction =
      answer?.correctiveAction ?? "";

    if (
      !hasValue &&
      !notes.trim() &&
      !correctiveAction.trim()
    ) {
      continue;
    }

    payload[questionId] = {
      ...(answer?.value !== undefined
        ? { value: answer.value }
        : {}),
      notes,
      correctiveAction,
    };
  }

  return payload;
}

export function useOperationalDraftAutosave({
  supabase,
  reportId,
  answers,
  setAnswers,
  enabled,
}: Params) {
  const [draftStatus, setDraftStatus] =
    useState<DraftStatus>("idle");

  const [hydrated, setHydrated] =
    useState(false);

  const lastSavedRef =
    useRef("");

  const queueRef =
    useRef<Promise<void>>(
      Promise.resolve()
    );

  // ==========================================================
  // LOAD DRAFT
  // ==========================================================

  useEffect(() => {
    if (
      !enabled ||
      !reportId
    ) {
      return;
    }

    let cancelled = false;

    async function loadDraft() {
      setDraftStatus("loading");
      setHydrated(false);

      const {
        data,
        error,
      } = await supabase
        .from("reports")
        .select("draft_answers")
        .eq("id", reportId)
        .maybeSingle();

      if (cancelled) {
        return;
      }

      if (error) {
        console.warn(
          "Draft load failed:",
          error
        );

        setDraftStatus("error");
        setHydrated(true);
        return;
      }

      const draft =
        data?.draft_answers;

      if (
        draft &&
        typeof draft === "object" &&
        !Array.isArray(draft)
      ) {
        lastSavedRef.current =
          JSON.stringify(draft);

        if (
          Object.keys(draft).length
        ) {
          setAnswers((prev: any) => {
            const next = {
              ...prev,
            };

            for (
              const [
                questionId,
                saved,
              ]
              of Object.entries(
                draft as Record<
                  string,
                  any
                >
              )
            ) {
              next[questionId] = {
                ...prev[questionId],
                ...saved,
              };
            }

            return next;
          });

          setDraftStatus("saved");
        } else {
          setDraftStatus("idle");
        }
      } else {
        lastSavedRef.current = "{}";
        setDraftStatus("idle");
      }

      setHydrated(true);
    }

    void loadDraft();

    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    reportId,
  ]);

  // ==========================================================
  // SAVE DRAFT
  // 800ms debounce prevents excessive DB writes.
  // ==========================================================

  useEffect(() => {
    if (
      !enabled ||
      !hydrated ||
      !reportId
    ) {
      return;
    }

    const payload =
      makePayload(answers);

    const json =
      JSON.stringify(payload);

    if (
      json ===
      lastSavedRef.current
    ) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        setDraftStatus("saving");

        queueRef.current =
          queueRef.current
            .catch(() => {
              // Keep queue alive.
            })
            .then(async () => {
              const {
                data,
                error,
              } = await supabase
                .from("reports")
                .update({
                  draft_answers:
                    payload,
                })
                .eq(
                  "id",
                  reportId
                )
                .select("id")
                .maybeSingle();

              if (error) {
                throw error;
              }

              if (!data) {
                throw new Error(
                  "Draft report tidak dapat disimpan."
                );
              }

              lastSavedRef.current =
                json;

              setDraftStatus(
                "saved"
              );
            })
            .catch((error) => {
              console.warn(
                "Draft autosave failed:",
                error
              );

              setDraftStatus(
                "error"
              );
            });
      }, 800);

    return () => {
      window.clearTimeout(
        timer
      );
    };
  }, [
    answers,
    enabled,
    hydrated,
    reportId,
  ]);

  return {
    draftStatus,
  };
}
