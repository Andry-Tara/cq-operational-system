"use client";

import { useState } from "react";

export default function ReopenReportButton({
  reportId,
  reportNumber,
}: {
  reportId: string;
  reportNumber: string;
}) {
  const [open, setOpen] =
    useState(false);

  const [reason, setReason] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  
  const [
    reopenQuestions,
    setReopenQuestions,
  ] = useState<
    Array<{
      id: string;
      code?: string | null;
      questionText: string;
    }>
  >([]);

  const [
    selectedQuestionIds,
    setSelectedQuestionIds,
  ] = useState<string[]>([]);

  const [
    loadingQuestions,
    setLoadingQuestions,
  ] = useState(false);

  async function openReopenModal() {
    setReason("");
    setError(null);
    setSelectedQuestionIds([]);
    setReopenQuestions([]);
    setOpen(true);
    setLoadingQuestions(true);

    try {
      const response =
        await fetch(
          `/api/reports/${reportId}/reopen-items`,
          {
            method: "GET",
            cache: "no-store",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
          "Unable to load questions."
        );
      }

      setReopenQuestions(
        Array.isArray(
          data?.questions
        )
          ? data.questions
          : []
      );
    } catch (err: any) {
      setError(
        err?.message ||
        "Unable to load questions."
      );
    } finally {
      setLoadingQuestions(false);
    }
  }

  function toggleReopenQuestion(
    questionId: string
  ) {
    setSelectedQuestionIds(
      (current) =>
        current.includes(
          questionId
        )
          ? current.filter(
              (id) =>
                id !==
                questionId
            )
          : [
              ...current,
              questionId,
            ]
    );
  }

  async function submitReopen() {
    if (loading) return;

    try {
      setError(null);

      const cleanReason =
        reason.trim();

      if (cleanReason.length < 5) {
        setError(
          "Alasan reopen minimal 5 karakter."
        );
        return;
      }

      if (
        selectedQuestionIds.length === 0
      ) {
        setError(
          "Pilih minimal 1 item yang perlu diperbaiki."
        );
        return;
      }

      setLoading(true);

      const response = await fetch(
        `/api/reports/${reportId}/reopen`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            reason: cleanReason,
            questionIds: selectedQuestionIds,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to reopen report."
        );
      }

      // Hard refresh so Server Components
      // immediately read latest DB state.
      window.location.reload();
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to reopen report."
      );

      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openReopenModal}
        className="inline-flex rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-bold text-red-700 transition hover:bg-red-50"
      >
        Reopen
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-[2px]">

          <div className="max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-[28px] border border-neutral-200 bg-white p-6 text-neutral-900 shadow-2xl md:p-8">

            <div className="flex items-start justify-between gap-5">

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-red-700">
                  Authorized Reopen
                </p>

                <h2 className="mt-2 text-2xl font-bold text-neutral-900">
                  Reopen Report
                </h2>

                <p className="mt-2 break-all text-sm text-neutral-500">
                  {reportNumber}
                </p>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  setOpen(false)
                }
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-lg font-bold text-neutral-600 transition hover:bg-neutral-200 hover:text-neutral-900 disabled:opacity-50"
              >
                ×
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm leading-6 text-amber-800">
              Report akan kembali menjadi
              <strong> REOPENED</strong>.
              Daily Lock tetap aktif dan
              tidak membuat report baru.
            </div>

            <label className="mt-6 block">
              <span className="text-xs font-bold uppercase tracking-wide text-neutral-600">
                Reason
              </span>

              <textarea
                rows={4}
                value={reason}
                disabled={loading}
                onChange={(event) =>
                  setReason(
                    event.target.value
                  )
                }
                placeholder="Contoh: Foto chiller salah upload, mohon diperbaiki."
                className="mt-2 w-full resize-none rounded-2xl border border-neutral-300 bg-white px-4 py-4 text-base leading-6 text-neutral-900 caret-red-700 outline-none transition placeholder:text-neutral-400 focus:border-red-400 focus:ring-4 focus:ring-red-50 disabled:bg-neutral-100 disabled:text-neutral-500"
              />
            </label>

            <div className="mt-6">
              <div className="flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-neutral-600">
                    Select Items to Correct
                  </p>

                  <p className="mt-1 text-xs text-neutral-500">
                    Pilih pertanyaan yang harus diperbaiki oleh outlet.
                  </p>
                </div>

                {!loadingQuestions &&
                  reopenQuestions.length > 0 && (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        if (
                          selectedQuestionIds.length ===
                          reopenQuestions.length
                        ) {
                          setSelectedQuestionIds(
                            []
                          );
                        } else {
                          setSelectedQuestionIds(
                            reopenQuestions.map(
                              (
                                question
                              ) =>
                                question.id
                            )
                          );
                        }
                      }}
                      className="shrink-0 text-xs font-bold text-red-700 hover:text-red-800"
                    >
                      {selectedQuestionIds.length ===
                      reopenQuestions.length
                        ? "Clear All"
                        : "Select All"}
                    </button>
                  )}
              </div>

              <div className="mt-3 max-h-[300px] overflow-y-auto rounded-2xl border border-neutral-200 bg-neutral-50 p-2">
                {loadingQuestions && (
                  <div className="px-4 py-8 text-center text-sm font-medium text-neutral-500">
                    Loading questions...
                  </div>
                )}

                {!loadingQuestions &&
                  reopenQuestions.length === 0 && (
                    <div className="px-4 py-8 text-center text-sm text-neutral-500">
                      Tidak ada pertanyaan yang ditemukan.
                    </div>
                  )}

                {!loadingQuestions &&
                  reopenQuestions.map(
                    (
                      question,
                      index
                    ) => {
                      const selected =
                        selectedQuestionIds.includes(
                          question.id
                        );

                      return (
                        <label
                          key={
                            question.id
                          }
                          className={`mb-2 flex cursor-pointer items-start gap-3 rounded-xl border p-3 last:mb-0 ${
                            selected
                              ? "border-amber-300 bg-amber-50"
                              : "border-transparent bg-white hover:border-neutral-200"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={
                              selected
                            }
                            disabled={
                              loading
                            }
                            onChange={() =>
                              toggleReopenQuestion(
                                question.id
                              )
                            }
                            className="mt-1 h-4 w-4 accent-red-700"
                          />

                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-xs font-bold text-neutral-500">
                            {index + 1}
                          </div>

                          <div className="min-w-0">
                            {question.code && (
                              <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">
                                {question.code}
                              </p>
                            )}

                            <p className="text-sm font-semibold leading-5 text-neutral-900">
                              {
                                question.questionText
                              }
                            </p>
                          </div>
                        </label>
                      );
                    }
                  )}
              </div>

              <div className="mt-3 flex items-center justify-between rounded-xl bg-neutral-100 px-4 py-3">
                <span className="text-xs font-medium text-neutral-500">
                  Items selected
                </span>

                <span className="text-sm font-bold text-neutral-900">
                  {
                    selectedQuestionIds.length
                  }
                </span>
              </div>
            </div>


            {error && (
              <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">

              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  setOpen(false)
                }
                className="rounded-2xl border border-neutral-300 bg-white px-5 py-3.5 font-bold text-neutral-700 transition hover:bg-neutral-50 hover:text-neutral-900 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={loading || loadingQuestions || selectedQuestionIds.length === 0}
                onClick={
                  submitReopen
                }
                className="rounded-2xl bg-red-700 px-5 py-3.5 font-bold text-white shadow-sm transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading
                  ? "Reopening..."
                  : "Reopen Report"}
              </button>

            </div>
          </div>
        </div>
      )}
    </>
  );
}
