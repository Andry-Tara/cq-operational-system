"use client";

import {
  useMemo,
  useState,
} from "react";


type StandardValue =
  | ""
  | "STANDARD"
  | "NOT_STANDARD";


type Menu = {
  id: string;
  code: string;
  name: string;
  category: string;
  notes: string | null;
  is_seasonal: boolean;
  sort_order: number;
};


type RowState = {
  selected: boolean;
  expiryDate: string;
  colorStatus: StandardValue;
  tasteStatus: StandardValue;
  textureStatus: StandardValue;
  notes: string;
};


type SubmittedShift = {
  shift: string;
  result_status: string | null;
};


const SHIFT_OPTIONS = [
  {
    value: "PAGI",
    label: "MORNING",
  },
  {
    value: "SORE",
    label: "AFTERNOON",
  },
] as const;


function shiftLabel(
  value: string
) {
  return (
    SHIFT_OPTIONS.find(
      (item) =>
        item.value === value
    )?.label ||
    value
  );
}


function initialRows(
  menus: Menu[]
) {
  return Object.fromEntries(
    menus.map(
      (menu) => [
        menu.id,
        {
          selected:
            false,
          expiryDate:
            "",
          colorStatus:
            "",
          tasteStatus:
            "",
          textureStatus:
            "",
          notes:
            "",
        } satisfies RowState,
      ]
    )
  );
}


export default function TestFoodClient({
  outlet,
  picName,
  businessDate,
  menus,
  submittedShifts,
}: {
  outlet: {
    id: string;
    code: string;
    name: string;
  };
  picName: string;
  businessDate: string;
  menus: Menu[];
  submittedShifts:
    SubmittedShift[];
}) {
  const [
    shift,
    setShift,
  ] =
    useState<
      "" |
      "PAGI" |
      "SORE"
    >("");

  const [
    rows,
    setRows,
  ] =
    useState<
      Record<
        string,
        RowState
      >
    >(
      () =>
        initialRows(
          menus
        )
    );

  const [
    submitting,
    setSubmitting,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null
    );


  const [
    incompleteMenuIds,
    setIncompleteMenuIds,
  ] =
    useState<
      string[]
    >(
      []
    );

  const [
    success,
    setSuccess,
  ] =
    useState<any>(
      null
    );


  const completedShifts =
    useMemo(
      () =>
        new Map(
          submittedShifts.map(
            (item) => [
              item.shift,
              item.result_status,
            ]
          )
        ),
      [
        submittedShifts,
      ]
    );


  const selectedMenus =
    useMemo(
      () =>
        menus.filter(
          (menu) =>
            rows[
              menu.id
            ]?.selected
        ),
      [
        menus,
        rows,
      ]
    );


  function patchRow(
    menuId: string,
    patch:
      Partial<RowState>
  ) {
    setIncompleteMenuIds(
      (
        current
      ) =>
        current.filter(
          (
            id
          ) =>
            id !==
            menuId
        )
    );

    setRows(
      (current) => ({
        ...current,
        [menuId]: {
          ...current[
            menuId
          ],
          ...patch,
        },
      })
    );
  }


  function hasIssue(
    row: RowState
  ) {
    return (
      row.colorStatus ===
        "NOT_STANDARD" ||
      row.tasteStatus ===
        "NOT_STANDARD" ||
      row.textureStatus ===
        "NOT_STANDARD"
    );
  }


  function rowComplete(
    row: RowState
  ) {
    if (
      !row.expiryDate ||
      !row.colorStatus ||
      !row.tasteStatus ||
      !row.textureStatus
    ) {
      return false;
    }

    if (
      hasIssue(
        row
      ) &&
      !row.notes.trim()
    ) {
      return false;
    }

    return true;
  }


  const canAttemptSubmit =
    Boolean(
      shift
    ) &&
    selectedMenus.length >
      0 &&
    !completedShifts.has(
      shift
    );


  async function submit() {
    if (
      !canAttemptSubmit ||
      !shift ||
      submitting
    ) {
      return;
    }


    const incomplete =
      selectedMenus
        .filter(
          (
            menu
          ) =>
            !rowComplete(
              rows[
                menu.id
              ]
            )
        )
        .map(
          (
            menu
          ) =>
            menu.id
        );


    if (
      incomplete.length
    ) {
      setIncompleteMenuIds(
        incomplete
      );

      setError(
        `Complete ${incomplete.length} selected ${
          incomplete.length === 1
            ? "menu"
            : "menus"
        } before submitting.`
      );


      window.setTimeout(
        () => {
          document
            .getElementById(
              `test-food-${incomplete[0]}`
            )
            ?.scrollIntoView({
              behavior:
                "smooth",
              block:
                "center",
            });
        },
        80
      );

      return;
    }


    setIncompleteMenuIds(
      []
    );

    setSubmitting(
      true
    );

    setError(
      null
    );

    setSuccess(
      null
    );

    try {
      const response =
        await fetch(
          "/api/test-food/submit",
          {
            method:
              "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body:
              JSON.stringify(
                {
                  shift,
                  checks:
                    selectedMenus.map(
                      (
                        menu
                      ) => {
                        const row =
                          rows[
                            menu.id
                          ];

                        return {
                          menu_id:
                            menu.id,
                          expiry_date:
                            row.expiryDate,
                          color_status:
                            row.colorStatus,
                          taste_status:
                            row.tasteStatus,
                          texture_status:
                            row.textureStatus,
                          notes:
                            row.notes.trim() ||
                            null,
                        };
                      }
                    ),
                }
              ),
          }
        );

      const payload =
        await response.json();

      if (
        !response.ok
      ) {
        throw new Error(
          payload?.error ||
          "Unable to submit Test Food."
        );
      }

      setSuccess(
        payload
      );

    } catch (
      submitError: any
    ) {
      setError(
        submitError
          ?.message ||
        "Unable to submit Test Food."
      );

    } finally {
      setSubmitting(
        false
      );
    }
  }


  if (
    success
  ) {
    const passed =
      success.result ===
      "PASS";

    const completedAfterSubmit =
      new Set([
        ...submittedShifts.map(
          (
            item
          ) =>
            item.shift
        ),
        success.shift,
      ]).size >=
      2;

    return (
      <main className="min-h-screen bg-[#F6F4F1] px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-2xl">
          <div className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
              Test Food Submitted
            </p>

            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black text-[#292824]">
                  {passed
                    ? "PASS"
                    : "NEEDS CORRECTION"}
                </h1>

                <p className="mt-2 text-sm text-neutral-500">
                  {outlet.name}
                  {" · "}
                  {shiftLabel(
                    success.shift
                  )}
                  {" · "}
                  {success.checked_count} menu
                </p>
              </div>

              <div
                className={
                  passed
                    ? "rounded-full bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-700"
                    : "rounded-full bg-amber-50 px-4 py-2 text-xs font-black text-amber-800"
                }
              >
                {success.result}
              </div>
            </div>

            {!passed && (
              <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                Menu yang tidak sesuai standard sudah tersimpan.
                Correction / Re-Test akan kita sambungkan pada step berikutnya.
              </div>
            )}

            <div className="mt-7 flex flex-col gap-2 sm:flex-row">
              {completedAfterSubmit && (
                <a
                  href="/protected/test-food/report"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#292824] px-6 text-sm font-black text-white"
                >
                  View Daily Report
                </a>
              )}

              <a
                href="/protected"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-neutral-200 bg-white px-6 text-sm font-black text-[#292824]"
              >
                Back to Dashboard
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }


  return (
    <main className="min-h-screen bg-[#F6F4F1] px-3 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">

        <section className="rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                Food Quality
              </p>

              <h1 className="mt-2 text-2xl font-black tracking-tight text-[#292824] sm:text-3xl">
                Test Food
              </h1>

              <p className="mt-2 text-sm text-neutral-500">
                {outlet.name}
                {" · "}
                {businessDate}
                {" · "}
                PIC {picName}
              </p>
            </div>


            <div>
              <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-neutral-400">
                Shift
              </p>

              <div className="grid grid-cols-2 gap-2">

                {SHIFT_OPTIONS.map(
                  (
                    option
                  ) => {
                    const done =
                      completedShifts.has(
                        option.value
                      );

                    return (
                      <button
                        key={
                          option.value
                        }
                        type="button"
                        disabled={
                          done
                        }
                        onClick={() => {
                          setShift(
                            option.value
                          );
                          setError(
                            null
                          );
                        }}
                        className={
                          [
                            "min-w-[132px] rounded-2xl border px-5 py-3 text-sm font-black transition",
                            shift === option.value
                              ? "border-[#292824] bg-[#292824] text-white"
                              : "border-neutral-200 bg-white text-neutral-700",
                            done
                              ? "cursor-not-allowed opacity-45"
                              : "hover:border-neutral-400",
                          ].join(
                            " "
                          )
                        }
                      >
                        {option.label}

                        {done && (
                          <span className="ml-1 text-[9px]">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  }
                )}

              </div>
            </div>

          </div>
        </section>


        <section className="mt-4 rounded-[30px] border border-neutral-200 bg-white p-4 shadow-sm sm:p-6">

          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
                Menu Checklist
              </p>

              <h2 className="mt-1 text-lg font-black text-[#292824]">
                Select menus to test
              </h2>
            </div>

            <div className="rounded-full bg-[#F6F4F1] px-3 py-1.5 text-xs font-black text-neutral-600">
              {selectedMenus.length} selected
            </div>
          </div>


          <div className="space-y-3">

            {menus.map(
              (
                menu
              ) => {
                const row =
                  rows[
                    menu.id
                  ];

                const issue =
                  hasIssue(
                    row
                  );

                return (
                  <article
                    id={
                      `test-food-${menu.id}`
                    }
                    key={
                      menu.id
                    }
                    className={
                      [
                        "overflow-hidden rounded-[24px] border transition",
                        incompleteMenuIds.includes(
                          menu.id
                        )
                          ? "border-red-300 bg-red-50/20 shadow-[0_0_0_2px_rgba(239,68,68,0.06)]"
                          : row.selected
                            ? "border-[#D8D355] bg-[#fffef6]"
                            : "border-neutral-200 bg-white",
                      ].join(
                        " "
                      )
                    }
                  >
                    <label className="flex cursor-pointer items-start gap-3 p-4 sm:p-5">
                      <input
                        type="checkbox"
                        checked={
                          row.selected
                        }
                        onChange={
                          (
                            event
                          ) =>
                            patchRow(
                              menu.id,
                              {
                                selected:
                                  event
                                    .target
                                    .checked,
                              }
                            )
                        }
                        className="mt-1 h-5 w-5 accent-[#292824]"
                      />

                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black text-[#292824] sm:text-base">
                          {menu.name}
                        </span>

                        {menu.notes && (
                          <span className="mt-1 block text-xs leading-5 text-neutral-500">
                            {menu.notes}
                          </span>
                        )}

                        {menu.is_seasonal && (
                          <span className="mt-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-amber-700">
                            Seasonal
                          </span>
                        )}
                      </span>
                    </label>


                    {row.selected && (
                      <div className="border-t border-neutral-200/80 bg-white p-4 sm:p-5">

                        <div className="grid gap-4 md:grid-cols-4">

                          <Field
                            label="Expiry Date"
                          >
                            <div className="relative">
                              <input
                                type="date"
                                value={
                                  row.expiryDate
                                }
                                onClick={
                                  (
                                    event
                                  ) => {
                                    const input =
                                      event.currentTarget as HTMLInputElement & {
                                        showPicker?: () => void;
                                      };

                                    input
                                      .showPicker
                                      ?.();
                                  }
                                }
                                onChange={
                                  (
                                    event
                                  ) =>
                                    patchRow(
                                      menu.id,
                                      {
                                        expiryDate:
                                          event
                                            .target
                                            .value,
                                      }
                                    )
                                }
                                className="h-11 w-full cursor-pointer rounded-xl border border-neutral-200 bg-white px-3 pr-10 text-sm font-bold text-neutral-800 outline-none focus:border-neutral-500"
                              />

                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-neutral-400">
                                ◫
                              </span>
                            </div>
                          </Field>


                          <StandardSelect
                            label="Warna"
                            value={
                              row.colorStatus
                            }
                            onChange={
                              (
                                value
                              ) =>
                                patchRow(
                                  menu.id,
                                  {
                                    colorStatus:
                                      value,
                                  }
                                )
                            }
                          />


                          <StandardSelect
                            label="Rasa"
                            value={
                              row.tasteStatus
                            }
                            onChange={
                              (
                                value
                              ) =>
                                patchRow(
                                  menu.id,
                                  {
                                    tasteStatus:
                                      value,
                                  }
                                )
                            }
                          />


                          <StandardSelect
                            label="Tekstur"
                            value={
                              row.textureStatus
                            }
                            onChange={
                              (
                                value
                              ) =>
                                patchRow(
                                  menu.id,
                                  {
                                    textureStatus:
                                      value,
                                  }
                                )
                            }
                          />

                        </div>


                        {issue && (
                          <div className="mt-4">
                            <Field
                              label="Notes · Required"
                            >
                              <textarea
                                value={
                                  row.notes
                                }
                                onChange={
                                  (
                                    event
                                  ) =>
                                    patchRow(
                                      menu.id,
                                      {
                                        notes:
                                          event
                                            .target
                                            .value,
                                      }
                                    )
                                }
                                placeholder="Contoh: Prawn Ball terlalu lembek."
                                rows={
                                  2
                                }
                                className="w-full resize-none rounded-xl border border-amber-200 bg-amber-50/50 px-3 py-3 text-sm font-medium text-neutral-800 outline-none focus:border-amber-400"
                              />
                            </Field>
                          </div>
                        )}

                      </div>
                    )}

                  </article>
                );
              }
            )}

          </div>


          {error && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}


          <div className="mt-6 flex flex-col gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:items-center sm:justify-between">

            <p className="text-xs leading-5 text-neutral-500">
              Pilih hanya menu yang memang diperiksa pada shift ini.
            </p>

            <button
              type="button"
              disabled={
                !canAttemptSubmit ||
                submitting
              }
              onClick={
                submit
              }
              className="inline-flex h-12 min-w-[180px] items-center justify-center rounded-2xl bg-[#292824] px-6 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-35"
            >
              {submitting
                ? "Submitting..."
                : "Submit Test Food"}
            </button>

          </div>

        </section>

      </div>
    </main>
  );
}


function Field({
  label,
  children,
}: {
  label: string;
  children:
    React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.13em] text-neutral-400">
        {label}
      </span>

      {children}
    </label>
  );
}


function StandardSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value:
    StandardValue;
  onChange:
    (
      value:
        StandardValue
    ) => void;
}) {
  return (
    <Field
      label={
        label
      }
    >
      <select
        value={
          value
        }
        onChange={
          (
            event
          ) =>
            onChange(
              event
                .target
                .value as
                StandardValue
            )
        }
        className={
          [
            "h-11 w-full rounded-xl border bg-white px-3 text-sm font-bold outline-none",
            value ===
            "NOT_STANDARD"
              ? "border-red-300 text-red-700"
              : "border-neutral-200 text-neutral-800 focus:border-neutral-500",
          ].join(
            " "
          )
        }
      >
        <option value="">
          Select
        </option>

        <option value="STANDARD">
          Standard
        </option>

        <option value="NOT_STANDARD">
          Not Standard
        </option>
      </select>
    </Field>
  );
}
