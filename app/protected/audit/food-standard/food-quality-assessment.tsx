"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import EvidencePhotoInput from "@/components/photo-evidence/evidence-photo-input";

import type {
  OutletPhotoContext,
} from "@/lib/photo-evidence/types";


type StandardValue =
  | ""
  | "STANDARD"
  | "NOT_STANDARD";


type CriterionKey =
  | "visual"
  | "serving_method"
  | "plating"
  | "aroma"
  | "ingredients"
  | "portion"
  | "temperature"
  | "taste"
  | "texture";


type AssessmentState =
  Record<
    `${CriterionKey}_status`,
    StandardValue
  > &
  Record<
    `${CriterionKey}_note`,
    string
  >;


type Evidence = {
  id: string;
  signed_url:
    | string
    | null;
  original_filename:
    | string
    | null;
};


const CRITERIA: {
  key:
    CriterionKey;
  label:
    string;
  description:
    string;
}[] = [
  {
    key:
      "visual",
    label:
      "Visual / Presentation",
    description:
      "Bentuk dan tampilan makanan sesuai standard secara visual.",
  },
  {
    key:
      "serving_method",
    label:
      "Serving Method",
    description:
      "Cara penyajian sesuai standard.",
  },
  {
    key:
      "plating",
    label:
      "Plating & Garnish",
    description:
      "Plating equipment dan garnish baik dan sesuai standard.",
  },
  {
    key:
      "aroma",
    label:
      "Aroma",
    description:
      "Aroma dan fragrance sesuai standard.",
  },
  {
    key:
      "ingredients",
    label:
      "Ingredients",
    description:
      "Bahan baku yang digunakan sesuai standard.",
  },
  {
    key:
      "portion",
    label:
      "Portion",
    description:
      "Porsi tidak kurang atau berlebihan.",
  },
  {
    key:
      "temperature",
    label:
      "Temperature",
    description:
      "Suhu pada saat penyajian sesuai standard.",
  },
  {
    key:
      "taste",
    label:
      "Taste",
    description:
      "Rasa sesuai standard.",
  },
  {
    key:
      "texture",
    label:
      "Texture",
    description:
      "Tekstur sebelum dan sesudah dikonsumsi sesuai standard.",
  },
];


function emptyAssessment():
  AssessmentState {
  return {
    visual_status:
      "",
    visual_note:
      "",

    serving_method_status:
      "",
    serving_method_note:
      "",

    plating_status:
      "",
    plating_note:
      "",

    aroma_status:
      "",
    aroma_note:
      "",

    ingredients_status:
      "",
    ingredients_note:
      "",

    portion_status:
      "",
    portion_note:
      "",

    temperature_status:
      "",
    temperature_note:
      "",

    taste_status:
      "",
    taste_note:
      "",

    texture_status:
      "",
    texture_note:
      "",
  };
}


function formatDuration(
  seconds:
    | number
    | null,
) {
  const value =
    Math.max(
      0,
      Math.floor(
        Number(
          seconds ||
            0,
        ),
      ),
    );

  return `${String(
    Math.floor(
      value / 60,
    ),
  ).padStart(
    2,
    "0",
  )}:${String(
    value % 60,
  ).padStart(
    2,
    "0",
  )}`;
}


export default function FoodQualityAssessmentButton({
  itemId,
  menuName,
  serviceStatus,
  serviceSeconds,
  buttonLabel = "Quality Assessment",
}: {
  itemId:
    string;
  menuName:
    string;
  serviceStatus:
    | "STANDARD"
    | "LATE"
    | null;
  serviceSeconds:
    | number
    | null;
  buttonLabel?:
    string;
}) {
  const [
    open,
    setOpen,
  ] =
    useState(
      false,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      false,
    );

  const [
    values,
    setValues,
  ] =
    useState<
      AssessmentState
    >(
      emptyAssessment(),
    );

  const [
    weight,
    setWeight,
  ] =
    useState(
      "",
    );

  const [
    temperature,
    setTemperature,
  ] =
    useState(
      "",
    );

  const [
    existingEvidence,
    setExistingEvidence,
  ] =
    useState<
      Evidence[]
    >(
      [],
    );

  const [
    photoContext,
    setPhotoContext,
  ] =
    useState<
      OutletPhotoContext | null
    >(
      null,
    );

  const [
    saving,
    setSaving,
  ] =
    useState(
      false,
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null);


  const completed =
    CRITERIA.every(
      (
        criterion,
      ) =>
        values[
          `${criterion.key}_status`
        ] !== "",
    );


  const notesComplete =
    CRITERIA.every(
      (
        criterion,
      ) => {
        const status =
          values[
            `${criterion.key}_status`
          ];

        const note =
          values[
            `${criterion.key}_note`
          ];

        return (
          status !==
            "NOT_STANDARD" ||
          note.trim().length >
            0
        );
      },
    );


  const issueCount =
    CRITERIA.filter(
      (
        criterion,
      ) =>
        values[
          `${criterion.key}_status`
        ] ===
        "NOT_STANDARD",
    ).length;


  const photoCount =
    existingEvidence.length;


  async function openAssessment() {
    setOpen(
      true,
    );

    setLoading(
      true,
    );

    setError(
      null,
    );

    try {
      const response =
        await fetch(
          `/api/audit/food-standard/items/${itemId}/assessment`,
          {
            method:
              "GET",

            cache:
              "no-store",
          },
        );

      const payload =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          payload?.error ||
            "Unable to load assessment.",
        );
      }

      const assessment =
        payload.assessment;

      if (
        assessment
      ) {
        const next =
          emptyAssessment();

        for (
          const criterion of
          CRITERIA
        ) {
          const statusKey =
            `${criterion.key}_status` as const;

          const noteKey =
            `${criterion.key}_note` as const;

          next[
            statusKey
          ] =
            assessment[
              statusKey
            ] ||
            "";

          next[
            noteKey
          ] =
            assessment[
              noteKey
            ] ||
            "";
        }

        setValues(
          next,
        );

        setWeight(
          assessment
            .weight_grams ==
            null
            ? ""
            : String(
                assessment
                  .weight_grams,
              ),
        );

        setTemperature(
          assessment
            .serving_temperature_c ==
            null
            ? ""
            : String(
                assessment
                  .serving_temperature_c,
              ),
        );
      } else {
        setValues(
          emptyAssessment(),
        );

        setWeight(
          "",
        );

        setTemperature(
          "",
        );
      }

      setExistingEvidence(
        payload.evidence ||
          [],
      );

      setPhotoContext(
        payload.photo_context ||
          null,
      );
    } catch (
      loadError: any
    ) {
      setError(
        loadError
          ?.message ||
          "Unable to load assessment.",
      );
    } finally {
      setLoading(
        false,
      );
    }
  }


  function setAllStandard() {
    const next =
      emptyAssessment();

    for (
      const criterion of
      CRITERIA
    ) {
      next[
        `${criterion.key}_status`
      ] =
        "STANDARD";
    }

    setValues(
      next,
    );
  }


  function setStatus(
    key:
      CriterionKey,
    status:
      StandardValue,
  ) {
    setValues(
      (
        current,
      ) => ({
        ...current,

        [`${key}_status`]:
          status,

        [`${key}_note`]:
          status ===
          "STANDARD"
            ? ""
            : current[
                `${key}_note`
              ],
      }),
    );
  }


  function setNote(
    key:
      CriterionKey,
    note:
      string,
  ) {
    setValues(
      (
        current,
      ) => ({
        ...current,

        [`${key}_note`]:
          note,
      }),
    );
  }


  async function submit() {
    if (
      !completed ||
      !notesComplete ||
      photoCount <
        1 ||
      saving
    ) {
      return;
    }

    setSaving(
      true,
    );

    setError(
      null,
    );

    try {
      const body:
        Record<
          string,
          string
        > = {};

      for (
        const criterion of
        CRITERIA
      ) {
        body[
          `${criterion.key}_status`
        ] =
          values[
            `${criterion.key}_status`
          ];

        body[
          `${criterion.key}_note`
        ] =
          values[
            `${criterion.key}_note`
          ];
      }

      body.weight_grams =
        weight;

      body.serving_temperature_c =
        temperature;

      const response =
        await fetch(
          `/api/audit/food-standard/items/${itemId}/assessment`,
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                body,
              ),
          },
        );

      const responseText =
        await response.text();

      let payload:
        any =
        null;

      if (
        responseText.trim()
      ) {
        try {
          payload =
            JSON.parse(
              responseText,
            );

        } catch {
          if (
            !response.ok
          ) {
            throw new Error(
              `Unable to save assessment (${response.status}).`,
            );
          }
        }
      }

      if (
        !response.ok
      ) {
        throw new Error(
          payload?.error ||
            `Unable to save assessment (${response.status}).`,
        );
      }

      window.location.reload();
    } catch (
      submitError: any
    ) {
      setError(
        submitError
          ?.message ||
          "Unable to save assessment.",
      );
    } finally {
      setSaving(
        false,
      );
    }
  }


  return (
    <>
      <button
        type="button"
        onClick={
          openAssessment
        }
        className="inline-flex h-10 items-center justify-center rounded-xl bg-[#292824] px-4 text-xs font-black text-white transition hover:bg-black"
      >
        {buttonLabel}
      </button>


      {open && (
        <div className="fixed inset-0 z-[120] flex justify-center bg-black/35 sm:items-center sm:p-5">
          <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[calc(100dvh-2.5rem)] sm:max-w-5xl sm:rounded-[28px] sm:border sm:border-neutral-200">

            <header className="shrink-0 border-b border-neutral-100 bg-white px-4 py-4 sm:px-6 sm:py-5">
              <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                  QA Food Standard
                </p>

                <h3 className="mt-1 text-2xl font-black text-[#292824]">
                  {menuName}
                </h3>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span
                    className={[
                      "rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em]",
                      serviceStatus ===
                      "STANDARD"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-red-50 text-red-700",
                    ].join(
                      " ",
                    )}
                  >
                    Service{" "}
                    {formatDuration(
                      serviceSeconds,
                    )}{" "}
                    ·{" "}
                    {serviceStatus}
                  </span>

                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500">
                    9 Quality Checks
                  </span>

                  <span className="rounded-full bg-neutral-100 px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500">
                    Photo Required
                  </span>
                </div>
              </div>

              <button
                type="button"
                disabled={
                  saving
                }
                onClick={() =>
                  setOpen(
                    false,
                  )
                }
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-neutral-200 text-lg font-black text-neutral-500"
              >
                ×
              </button>
              </div>
            </header>


            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">

              {loading ? (
                <div className="py-20 text-center text-sm font-bold text-neutral-400">
                  Loading assessment...
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-neutral-500">
                      Pilih Standard / Not Standard untuk setiap criteria.
                      Notes hanya wajib pada criteria yang tidak sesuai.
                    </p>

                    <button
                      type="button"
                      onClick={
                        setAllStandard
                      }
                      className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-xs font-black text-neutral-700"
                    >
                      Set All Standard
                    </button>
                  </div>


                  <div className="mt-5 space-y-3">
                    {CRITERIA.map(
                      (
                        criterion,
                        index,
                      ) => {
                        const status =
                          values[
                            `${criterion.key}_status`
                          ];

                        const note =
                          values[
                            `${criterion.key}_note`
                          ];

                        return (
                          <div
                            key={
                              criterion.key
                            }
                            className="rounded-[20px] border border-neutral-200 p-4 sm:p-5"
                          >
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

                              <div className="min-w-0">
                                <p className="text-sm font-black text-[#292824]">
                                  {index +
                                    1}
                                  .{" "}
                                  {
                                    criterion.label
                                  }
                                </p>

                                <p className="mt-1 text-xs leading-5 text-neutral-400">
                                  {
                                    criterion.description
                                  }
                                </p>
                              </div>


                              <div className="grid w-full shrink-0 grid-cols-2 gap-2 lg:w-auto">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStatus(
                                      criterion.key,
                                      "STANDARD",
                                    )
                                  }
                                  className={[
                                    "h-11 min-w-0 rounded-xl border px-3 text-xs font-black transition lg:min-w-[118px] lg:px-4",
                                    status ===
                                    "STANDARD"
                                      ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                      : "border-neutral-200 bg-white text-neutral-500",
                                  ].join(
                                    " ",
                                  )}
                                >
                                  Standard
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    setStatus(
                                      criterion.key,
                                      "NOT_STANDARD",
                                    )
                                  }
                                  className={[
                                    "h-11 min-w-0 rounded-xl border px-3 text-xs font-black transition lg:min-w-[118px] lg:px-4",
                                    status ===
                                    "NOT_STANDARD"
                                      ? "border-red-400 bg-red-50 text-red-700"
                                      : "border-neutral-200 bg-white text-neutral-500",
                                  ].join(
                                    " ",
                                  )}
                                >
                                  Not Standard
                                </button>
                              </div>
                            </div>


                            {status ===
                              "NOT_STANDARD" && (
                              <div className="mt-4 border-t border-red-100 pt-4">
                                <label className="block">
                                  <span className="text-[10px] font-black uppercase tracking-[0.12em] text-red-600">
                                    Reason / Notes · Required
                                  </span>

                                  <textarea
                                    rows={
                                      2
                                    }
                                    value={
                                      note
                                    }
                                    onChange={
                                      (
                                        event,
                                      ) =>
                                        setNote(
                                          criterion.key,
                                          event
                                            .target
                                            .value,
                                        )
                                    }
                                    placeholder={`Jelaskan kenapa ${criterion.label} tidak sesuai standard...`}
                                    className="mt-2 w-full resize-none rounded-xl border border-red-200 bg-red-50/30 p-3 text-sm font-medium text-neutral-800 outline-none focus:border-red-400"
                                  />
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>


                  {photoContext && (
                    <EvidencePhotoInput
                      itemId={itemId}
                      outlet={photoContext}
                      moduleLabel="QA Food Standard"
                      subjectLabel={menuName}
                      evidence={existingEvidence}
                      onChange={setExistingEvidence}
                      maxPhotos={3}
                    />
                  )}


                  <div className="mt-5 grid gap-4 md:grid-cols-2">

                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">
                        Weight (gram) · Optional
                      </span>

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={
                          weight
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setWeight(
                              event
                                .target
                                .value,
                            )
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-800 outline-none focus:border-neutral-500"
                        placeholder="Example: 120"
                      />
                    </label>


                    <label className="block">
                      <span className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">
                        Serving Temperature °C · Optional
                      </span>

                      <input
                        type="number"
                        step="0.1"
                        value={
                          temperature
                        }
                        onChange={
                          (
                            event,
                          ) =>
                            setTemperature(
                              event
                                .target
                                .value,
                            )
                        }
                        className="mt-2 h-11 w-full rounded-xl border border-neutral-200 bg-white px-4 text-sm font-bold text-neutral-800 outline-none focus:border-neutral-500"
                        placeholder="Example: 68"
                      />
                    </label>

                  </div>


                  {error && (
                    <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                      {error}
                    </div>
                  )}
                </>
              )}
            </div>


            <footer className="shrink-0 border-t border-neutral-200 bg-white px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.04)] sm:px-6 sm:py-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <p className="text-sm font-black text-[#292824]">
                  {
                    CRITERIA.filter(
                      (
                        criterion,
                      ) =>
                        values[
                          `${criterion.key}_status`
                        ] !==
                        "",
                    ).length
                  }{" "}
                  / 9 completed
                </p>

                <p className="mt-1 text-xs text-neutral-400">
                  {issueCount >
                  0
                    ? `${issueCount} Not Standard · notes wajib per issue`
                    : "No quality issue selected"}
                  {" · "}
                  {photoCount}
                  /3 photo
                </p>
              </div>


              <button
                type="button"
                disabled={
                  loading ||
                  !completed ||
                  !notesComplete ||
                  photoCount <
                    1 ||
                  saving
                }
                onClick={
                  submit
                }
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#292824] px-6 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto sm:min-w-[230px]"
              >
                {saving
                  ? "Submitting..."
                  : "Submit Menu Assessment"}
              </button>
              </div>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
