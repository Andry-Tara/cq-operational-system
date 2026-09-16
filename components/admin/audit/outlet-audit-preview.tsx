"use client";

import {
  useMemo,
  useState,
} from "react";

export type AuditPreviewData = {
  form: {
    id: string;
    code: string;
    name: string;
    description: string | null;
  };
  version: {
    id: string;
    versionNumber: number;
    status: string;
  };
  groups: Array<{
    id: string;
    code: string;
    name: string;
    sortOrder: number;
    questions: Array<{
      id: string;
      code: string;
      text: string;
      sortOrder: number;
    }>;
  }>;
  categories: Array<{
    id: string;
    code: string;
    name: string;
  }>;
};

type Question = AuditPreviewData["groups"][number]["questions"][number];

type DraftFinding = {
  id: string;
  questionId: string;
  questionCode: string;
  questionText: string;
  groupCode: string;
  groupName: string;
  risk: "minor" | "medium" | "major" | "critical";
  categoryId: string;
  categoryName: string;
  notes: string;
  photoName: string | null;
};

const riskOptions = [
  {
    value: "minor",
    label: "Minor",
  },
  {
    value: "medium",
    label: "Medium",
  },
  {
    value: "major",
    label: "Major",
  },
  {
    value: "critical",
    label: "Critical",
  },
] as const;

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase();
}

function findingBadgeClass(
  risk: DraftFinding["risk"]
) {
  if (
    risk === "critical"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (
    risk === "major"
  ) {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (
    risk === "medium"
  ) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

export function OutletAuditPreview({
  data,
}: {
  data: AuditPreviewData;
}) {
  const allGroupIds =
    useMemo(
      () =>
        data.groups.map(
          (group) =>
            group.id
        ),
      [
        data.groups,
      ]
    );

  const [
    openGroupIds,
    setOpenGroupIds,
  ] =
    useState<
      Set<string>
    >(
      () =>
        new Set<string>()
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    selected,
    setSelected,
  ] =
    useState<{
      groupCode: string;
      groupName: string;
      question: Question;
    } | null>(
      null
    );

  const [
    risk,
    setRisk,
  ] =
    useState<
      DraftFinding["risk"]
    >(
      "minor"
    );

  const [
    categoryId,
    setCategoryId,
  ] =
    useState(
      data.categories[0]?.id ??
        ""
    );

  const [
    notes,
    setNotes,
  ] =
    useState("");

  const [
    photoName,
    setPhotoName,
  ] =
    useState<
      string | null
    >(
      null
    );

  const [
    findings,
    setFindings,
  ] =
    useState<
      DraftFinding[]
    >(
      []
    );

  const normalizedSearch =
    normalize(
      search
    );

  const visibleGroups =
    useMemo(
      () =>
        data.groups
          .map(
            (group) => {
              if (
                !normalizedSearch
              ) {
                return group;
              }

              const groupMatches =
                normalize(
                  group.name
                ).includes(
                  normalizedSearch
                ) ||
                normalize(
                  group.code
                ).includes(
                  normalizedSearch
                );

              const questions =
                groupMatches
                  ? group.questions
                  : group.questions.filter(
                      (
                        question
                      ) =>
                        normalize(
                          question.code
                        ).includes(
                          normalizedSearch
                        ) ||
                        normalize(
                          question.text
                        ).includes(
                          normalizedSearch
                        )
                    );

              return {
                ...group,
                questions,
              };
            }
          )
          .filter(
            (group) =>
              group.questions
                .length >
              0
          ),
      [
        data.groups,
        normalizedSearch,
      ]
    );

  const findingsByQuestion =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            number
          >();

        findings.forEach(
          (finding) => {
            map.set(
              finding.questionId,
              (
                map.get(
                  finding.questionId
                ) ??
                0
              ) + 1
            );
          }
        );

        return map;
      },
      [
        findings,
      ]
    );

  const findingsByGroup =
    useMemo(
      () => {
        const map =
          new Map<
            string,
            number
          >();

        findings.forEach(
          (finding) => {
            map.set(
              finding.groupCode,
              (
                map.get(
                  finding.groupCode
                ) ??
                0
              ) + 1
            );
          }
        );

        return map;
      },
      [
        findings,
      ]
    );

  function toggleGroup(
    groupId: string
  ) {
    setOpenGroupIds(
      (current) => {
        const next =
          new Set(
            current
          );

        if (
          next.has(
            groupId
          )
        ) {
          next.delete(
            groupId
          );
        } else {
          next.add(
            groupId
          );
        }

        return next;
      }
    );
  }

  function openFinding(
    groupCode: string,
    groupName: string,
    question: Question
  ) {
    setSelected({
      groupCode,
      groupName,
      question,
    });

    setRisk(
      "minor"
    );

    setCategoryId(
      data.categories[0]?.id ??
        ""
    );

    setNotes("");
    setPhotoName(
      null
    );
  }

  function closeFinding() {
    setSelected(
      null
    );
  }

  function saveFinding() {
    if (
      !selected ||
      !categoryId
    ) {
      return;
    }

    const category =
      data.categories.find(
        (item) =>
          item.id ===
          categoryId
      );

    if (
      !category
    ) {
      return;
    }

    const finding: DraftFinding = {
      id:
        crypto.randomUUID(),
      questionId:
        selected.question.id,
      questionCode:
        selected.question.code,
      questionText:
        selected.question.text,
      groupCode:
        selected.groupCode,
      groupName:
        selected.groupName,
      risk,
      categoryId:
        category.id,
      categoryName:
        category.name,
      notes:
        notes.trim(),
      photoName,
    };

    setFindings(
      (current) => [
        ...current,
        finding,
      ]
    );

    closeFinding();
  }

  function removeFinding(
    id: string
  ) {
    setFindings(
      (current) =>
        current.filter(
          (finding) =>
            finding.id !==
            id
        )
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 bg-gradient-to-br from-white via-white to-red-50/40 px-5 py-6 sm:px-7">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.13em] text-red-700">
                  Audit Preview
                </span>

                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.13em] text-neutral-500">
                  {data.version.status}
                </span>

                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.13em] text-neutral-500">
                  Finding Only
                </span>
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">
                Outlet Audit
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-neutral-500">
                Auditor hanya membuka area yang relevan dan mencatat point yang ditemukan.
                Point yang tidak disentuh tidak dianggap pass.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
              <Metric
                label="Areas"
                value={String(data.groups.length)}
              />
              <Metric
                label="Points"
                value={String(
                  data.groups.reduce(
                    (sum, group) =>
                      sum +
                      group.questions.length,
                    0
                  )
                )}
              />
              <Metric
                label="Findings"
                value={String(findings.length)}
                accent
              />
            </div>
          </div>
        </div>

        <div className="border-b border-neutral-100 px-5 py-4 sm:px-7">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative flex-1">
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search point, code, or area..."
                className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 pr-10 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-red-300 focus:bg-white focus:ring-4 focus:ring-red-50"
              />

              {search ? (
                <button
                  type="button"
                  onClick={() =>
                    setSearch("")
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setOpenGroupIds(
                    new Set(
                      allGroupIds
                    )
                  )
                }
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                Expand All
              </button>

              <button
                type="button"
                onClick={() =>
                  setOpenGroupIds(
                    new Set()
                  )
                }
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50"
              >
                Collapse All
              </button>
            </div>
          </div>

          <p className="mt-3 text-xs text-neutral-400">
            Preview only - finding yang dibuat di halaman ini belum disimpan ke database.
          </p>
        </div>

        <div className="grid gap-5 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0">
            <div className="grid gap-3">
              {visibleGroups.map(
                (group) => {
                  const forcedOpen =
                    Boolean(
                      normalizedSearch
                    );

                  const isOpen =
                    forcedOpen ||
                    openGroupIds.has(
                      group.id
                    );

                  const groupFindingCount =
                    findingsByGroup.get(
                      group.code
                    ) ??
                    0;

                  return (
                    <article
                      key={group.id}
                      className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          toggleGroup(
                            group.id
                          )
                        }
                        className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-neutral-50 sm:px-5"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h2 className="text-base font-bold text-neutral-900">
                              {group.name}
                            </h2>

                            {groupFindingCount >
                            0 ? (
                              <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">
                                {groupFindingCount}{" "}
                                {groupFindingCount ===
                                1
                                  ? "finding"
                                  : "findings"}
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-1 text-xs text-neutral-400">
                            {group.questions.length} reference points
                          </p>
                        </div>

                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border border-neutral-200 text-lg text-neutral-500 transition ${
                            isOpen
                              ? "rotate-180 bg-neutral-50"
                              : "bg-white"
                          }`}
                        >
                          ⌄
                        </span>
                      </button>

                      {isOpen ? (
                        <div className="border-t border-neutral-100">
                          {group.questions.map(
                            (
                              question,
                              index
                            ) => {
                              const findingCount =
                                findingsByQuestion.get(
                                  question.id
                                ) ??
                                0;

                              return (
                                <div
                                  key={question.id}
                                  className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${
                                    index >
                                    0
                                      ? "border-t border-neutral-100"
                                      : ""
                                  }`}
                                >
                                  <div className="min-w-0">
                                    <div className="flex items-start gap-3">
                                      <span className="mt-0.5 shrink-0 rounded-lg bg-neutral-100 px-2 py-1 font-mono text-[10px] font-bold text-neutral-500">
                                        {question.code}
                                      </span>

                                      <div>
                                        <p className="text-sm font-medium leading-6 text-neutral-800">
                                          {question.text}
                                        </p>

                                        {findingCount >
                                        0 ? (
                                          <p className="mt-1 text-xs font-semibold text-red-600">
                                            {findingCount} finding recorded in preview
                                          </p>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      openFinding(
                                        group.code,
                                        group.name,
                                        question
                                      )
                                    }
                                    className="shrink-0 rounded-xl bg-neutral-950 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-red-700"
                                  >
                                    + Add Finding
                                  </button>
                                </div>
                              );
                            }
                          )}
                        </div>
                      ) : null}
                    </article>
                  );
                }
              )}

              {visibleGroups.length ===
              0 ? (
                <div className="rounded-2xl border border-dashed border-neutral-300 bg-neutral-50 px-6 py-12 text-center">
                  <p className="text-sm font-semibold text-neutral-700">
                    No audit point found.
                  </p>
                  <p className="mt-1 text-sm text-neutral-400">
                    Try another keyword.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <aside className="xl:sticky xl:top-5 xl:self-start">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-bold text-neutral-900">
                    Findings Preview
                  </h2>
                  <p className="mt-1 text-xs leading-5 text-neutral-400">
                    Temporary local list untuk validasi UX.
                  </p>
                </div>

                <span className="grid h-9 min-w-9 place-items-center rounded-xl bg-white px-2 text-sm font-bold text-red-700 shadow-sm">
                  {findings.length}
                </span>
              </div>

              <div className="mt-4 grid gap-3">
                {findings.map(
                  (finding) => (
                    <div
                      key={finding.id}
                      className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                            {finding.groupName} · {finding.questionCode}
                          </p>

                          <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-neutral-800">
                            {finding.questionText}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeFinding(
                              finding.id
                            )
                          }
                          className="rounded-lg px-2 py-1 text-xs font-bold text-neutral-400 transition hover:bg-red-50 hover:text-red-600"
                        >
                          ×
                        </button>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <span
                          className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${findingBadgeClass(
                            finding.risk
                          )}`}
                        >
                          {finding.risk}
                        </span>

                        <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-1 text-[10px] font-semibold text-neutral-500">
                          {finding.categoryName}
                        </span>
                      </div>

                      {finding.notes ? (
                        <p className="mt-2 text-xs leading-5 text-neutral-500">
                          {finding.notes}
                        </p>
                      ) : null}

                      {finding.photoName ? (
                        <p className="mt-2 truncate text-[10px] font-medium text-neutral-400">
                          Photo: {finding.photoName}
                        </p>
                      ) : null}
                    </div>
                  )
                )}

                {findings.length ===
                0 ? (
                  <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center">
                    <p className="text-xs font-semibold text-neutral-500">
                      No findings yet.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-5">
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] border border-neutral-200 bg-white shadow-2xl sm:max-w-2xl sm:rounded-[28px]">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-neutral-100 bg-white/95 px-5 py-5 backdrop-blur sm:px-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-red-600">
                  Add Finding · {selected.groupName}
                </p>

                <h2 className="mt-1 text-lg font-bold leading-7 text-neutral-950">
                  {selected.question.text}
                </h2>

                <p className="mt-1 font-mono text-[10px] font-semibold text-neutral-400">
                  {selected.question.code}
                </p>
              </div>

              <button
                type="button"
                onClick={
                  closeFinding
                }
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-lg font-bold text-neutral-500 transition hover:bg-neutral-200"
              >
                ×
              </button>
            </div>

            <div className="grid gap-5 px-5 py-5 sm:px-6">
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                  Risk
                </label>

                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {riskOptions.map(
                    (option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setRisk(
                            option.value
                          )
                        }
                        className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                          risk ===
                          option.value
                            ? "border-red-600 bg-red-600 text-white shadow-sm"
                            : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
                        }`}
                      >
                        {option.label}
                      </button>
                    )
                  )}
                </div>
              </div>

              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                  Finding Category
                </span>

                <select
                  value={
                    categoryId
                  }
                  onChange={(
                    event
                  ) =>
                    setCategoryId(
                      event.target.value
                    )
                  }
                  className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-800 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
                >
                  {data.categories.map(
                    (
                      category
                    ) => (
                      <option
                        key={
                          category.id
                        }
                        value={
                          category.id
                        }
                      >
                        {category.name}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                  Notes
                </span>

                <textarea
                  value={notes}
                  onChange={(
                    event
                  ) =>
                    setNotes(
                      event.target.value
                    )
                  }
                  placeholder="Describe the finding..."
                  className="min-h-28 resize-y rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm leading-6 text-neutral-800 outline-none placeholder:text-neutral-400 focus:border-red-300 focus:ring-4 focus:ring-red-50"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                  Photo Evidence
                </span>

                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(
                    event
                  ) =>
                    setPhotoName(
                      event.target.files?.[0]?.name ??
                        null
                    )
                  }
                  className="block w-full rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-3 text-xs text-neutral-500 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white"
                />

                <span className="text-[11px] leading-5 text-neutral-400">
                  Preview only. File belum di-upload.
                </span>
              </label>
            </div>

            <div className="sticky bottom-0 flex gap-2 border-t border-neutral-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
              <button
                type="button"
                onClick={
                  closeFinding
                }
                className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-600 transition hover:bg-neutral-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  saveFinding
                }
                disabled={
                  !categoryId
                }
                className="flex-[1.4] rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Add Finding
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function Metric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-3 text-center ${
        accent
          ? "border-red-100 bg-red-50"
          : "border-neutral-200 bg-white"
      }`}
    >
      <div
        className={`text-lg font-bold ${
          accent
            ? "text-red-700"
            : "text-neutral-900"
        }`}
      >
        {value}
      </div>

      <div className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
        {label}
      </div>
    </div>
  );
}
