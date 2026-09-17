"use client";

import { useMemo, useState } from "react";

export type AuditRuntimeData = {
  runtimeMode: "assigned" | "staging";
  outlet: {
    id: string;
    code: string;
    name: string;
    timezone: string;
  };
  auditor: {
    id: string;
    name: string;
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
  initialSession: AuditSession | null;
  initialFindings: Finding[];
};

type AuditSession = {
  id: string;
  auditNumber: string;
  auditDate: string;
  status: string;
  formVersionId: string;
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
};

type Question =
  AuditRuntimeData["groups"][number]["questions"][number];

type Risk = "minor" | "medium" | "major" | "critical";

type Finding = {
  id: string;
  sessionId: string;
  questionId: string;
  questionCode: string;
  questionText: string;
  groupCode: string;
  groupName: string;
  categoryId: string;
  categoryCode: string;
  categoryName: string;
  risk: Risk;
  notes: string;
  createdAt: string;
  photo: {
    originalFilename: string | null;
  } | null;
};

const riskOptions: Array<{ value: Risk; label: string }> = [
  { value: "minor", label: "Minor" },
  { value: "medium", label: "Medium" },
  { value: "major", label: "Major" },
  { value: "critical", label: "Critical" },
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function riskClass(risk: Risk) {
  if (risk === "critical") return "border-red-200 bg-red-50 text-red-700";
  if (risk === "major") return "border-orange-200 bg-orange-50 text-orange-700";
  if (risk === "medium") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-neutral-200 bg-neutral-50 text-neutral-600";
}

async function compressPhoto(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("File harus berupa image.");
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxDimension = 1600;
    const scale = Math.min(
      1,
      maxDimension / Math.max(bitmap.width, bitmap.height),
    );

    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");

    if (!context) {
      bitmap.close();
      return file;
    }

    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.78);
    });

    if (!blob) return file;

    const base =
      file.name.replace(/\.[^.]+$/, "").slice(0, 80) ||
      "audit-photo";

    return new File([blob], `${base}.jpg`, {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
  } catch {
    return file;
  }
}

export function OutletAuditRuntime({
  data,
}: {
  data: AuditRuntimeData;
}) {
  const [session, setSession] =
    useState<AuditSession | null>(data.initialSession);

  const [findings, setFindings] =
    useState<Finding[]>(data.initialFindings);

  const [openGroups, setOpenGroups] =
    useState<Set<string>>(() => new Set());

  const [search, setSearch] = useState("");

  const [selected, setSelected] =
    useState<{
      groupCode: string;
      groupName: string;
      question: Question;
    } | null>(null);

  const [risk, setRisk] = useState<Risk>("minor");
  const [categoryId, setCategoryId] =
    useState(data.categories[0]?.id || "");
  const [notes, setNotes] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] =
    useState<string | null>(
      data.initialSession ? "Draft audit dilanjutkan." : null,
    );
  const [error, setError] = useState<string | null>(null);

  const allGroupIds = useMemo(
    () => data.groups.map((group) => group.id),
    [data.groups],
  );

  const normalizedSearch = normalize(search);

  const visibleGroups = useMemo(
    () =>
      data.groups
        .map((group) => {
          if (!normalizedSearch) return group;

          const groupMatches =
            normalize(group.name).includes(normalizedSearch) ||
            normalize(group.code).includes(normalizedSearch);

          return {
            ...group,
            questions: groupMatches
              ? group.questions
              : group.questions.filter(
                  (question) =>
                    normalize(question.code).includes(normalizedSearch) ||
                    normalize(question.text).includes(normalizedSearch),
                ),
          };
        })
        .filter((group) => group.questions.length > 0),
    [data.groups, normalizedSearch],
  );

  const findingsByGroup = useMemo(() => {
    const map = new Map<string, number>();
    for (const finding of findings) {
      map.set(
        finding.groupCode,
        (map.get(finding.groupCode) || 0) + 1,
      );
    }
    return map;
  }, [findings]);

  const findingsByQuestion = useMemo(() => {
    const map = new Map<string, number>();
    for (const finding of findings) {
      map.set(
        finding.questionId,
        (map.get(finding.questionId) || 0) + 1,
      );
    }
    return map;
  }, [findings]);

  const isDraft = session?.status === "draft";

  async function startAudit() {
    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/audit/session", {
        method: "POST",
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to start audit.");
      }

      const raw = payload.session;

      setSession({
        id: raw.id,
        auditNumber: raw.audit_number,
        auditDate: raw.audit_date,
        status: raw.status,
        formVersionId: raw.form_version_id,
        startedAt: raw.started_at,
        submittedAt: raw.submitted_at || null,
        score: raw.score ?? null,
      });

      setMessage(
        payload.resumed ? "Existing draft resumed." : "Audit started.",
      );
    } catch (exception: any) {
      setError(exception?.message || "Unable to start audit.");
    } finally {
      setBusy(false);
    }
  }

  function openFinding(
    groupCode: string,
    groupName: string,
    question: Question,
  ) {
    if (!isDraft) return;

    setSelected({ groupCode, groupName, question });
    setRisk("minor");
    setCategoryId(data.categories[0]?.id || "");
    setNotes("");
    setPhoto(null);
    setError(null);
  }

  async function saveFinding() {
    if (!session || !selected || !categoryId) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.set("sessionId", session.id);
      formData.set("questionId", selected.question.id);
      formData.set("categoryId", categoryId);
      formData.set("risk", risk);
      formData.set("notes", notes.trim());

      if (photo) {
        const optimized = await compressPhoto(photo);
        formData.set("photo", optimized, optimized.name);
      }

      const response = await fetch("/api/audit/findings", {
        method: "POST",
        body: formData,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to save finding.");
      }

      const raw = payload.finding;

      const finding: Finding = {
        id: raw.id,
        sessionId: raw.audit_session_id,
        questionId: raw.question_id,
        questionCode: raw.question_code_snapshot,
        questionText: raw.question_text_snapshot,
        groupCode: raw.area_code_snapshot,
        groupName: raw.area_name_snapshot,
        categoryId: raw.finding_category_id,
        categoryCode: raw.finding_category_code_snapshot,
        categoryName: raw.finding_category_name_snapshot,
        risk: raw.risk_level,
        notes: raw.notes || "",
        createdAt: raw.created_at,
        photo: raw.photo
          ? { originalFilename: raw.photo.original_filename || null }
          : null,
      };

      setFindings((current) => [...current, finding]);
      setSelected(null);
      setNotes("");
      setPhoto(null);
      setMessage("Finding saved.");
    } catch (exception: any) {
      setError(exception?.message || "Unable to save finding.");
    } finally {
      setBusy(false);
    }
  }

  async function removeFinding(id: string) {
    if (!isDraft || busy) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/audit/findings/${id}`, {
        method: "DELETE",
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to remove finding.");
      }

      setFindings((current) =>
        current.filter((finding) => finding.id !== id),
      );
      setMessage("Finding removed.");
    } catch (exception: any) {
      setError(exception?.message || "Unable to remove finding.");
    } finally {
      setBusy(false);
    }
  }

  async function submitAudit() {
    if (!session || !isDraft || busy) return;

    const confirmed = window.confirm(
      findings.length
        ? `Submit audit dengan ${findings.length} finding?`
        : "Submit audit tanpa finding?",
    );

    if (!confirmed) return;

    setBusy(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/audit/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Unable to submit audit.");
      }

      const raw = payload.session;

      setSession((current) =>
        current
          ? {
              ...current,
              status: raw.status,
              submittedAt:
                raw.submitted_at || new Date().toISOString(),
              score: raw.score ?? null,
            }
          : current,
      );

      setMessage("Audit submitted successfully.");
    } catch (exception: any) {
      setError(exception?.message || "Unable to submit audit.");
    } finally {
      setBusy(false);
    }
  }

  function newAudit() {
    setSession(null);
    setFindings([]);
    setSelected(null);
    setError(null);
    setMessage("Ready to start another audit.");
  }

  return (
    <main className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[28px] border border-neutral-200 bg-white shadow-sm">
        <header className="border-b border-neutral-100 bg-gradient-to-br from-white via-white to-red-50/40 px-5 py-6 sm:px-7">
          <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.13em] text-red-700">
                  Outlet Audit
                </span>
                <span className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.13em] text-neutral-500">
                  V{data.version.versionNumber}
                </span>
                {data.runtimeMode === "staging" ? (
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.13em] text-amber-700">
                    Staging
                  </span>
                ) : null}
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-neutral-950 sm:text-3xl">
                {data.outlet.name}
              </h1>

              <p className="mt-2 text-sm leading-6 text-neutral-500">
                Auditor:{" "}
                <span className="font-semibold text-neutral-700">
                  {data.auditor.name}
                </span>
                {" · "}
                catat hanya point yang menjadi temuan.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
              <Metric label="Areas" value={String(data.groups.length)} />
              <Metric
                label="Points"
                value={String(
                  data.groups.reduce(
                    (sum, group) => sum + group.questions.length,
                    0,
                  ),
                )}
              />
              <Metric
                label="Findings"
                value={String(findings.length)}
                accent
              />
            </div>
          </div>
        </header>

        {data.runtimeMode === "staging" ? (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-xs font-medium text-amber-800 sm:px-7">
            STAGING — hanya administrator dapat memakai draft audit sebelum form dipublish dan diassign ke outlet.
          </div>
        ) : null}

        {error || message ? (
          <div className="border-b border-neutral-100 px-5 py-3 sm:px-7">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </div>
            ) : null}
            {message ? (
              <div className={`${error ? "mt-2 " : ""}rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700`}>
                {message}
              </div>
            ) : null}
          </div>
        ) : null}

        {!session ? (
          <div className="p-5 sm:p-7">
            <div className="mx-auto max-w-xl rounded-3xl border border-neutral-200 bg-neutral-50/70 px-6 py-12 text-center">
              <h2 className="text-xl font-bold text-neutral-950">
                Start Outlet Audit
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
                Start audit session untuk {data.outlet.name}. Setelah submit,
                auditor dapat membuat audit baru lagi di hari yang sama.
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={startAudit}
                className="mt-6 rounded-xl bg-red-700 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-50"
              >
                {busy ? "Starting..." : "Start Audit"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="border-b border-neutral-100 px-5 py-4 sm:px-7">
              <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-400">
                    Audit Session
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-neutral-800">
                      {session.auditNumber}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ${
                      session.status === "submitted"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}>
                      {session.status}
                    </span>
                  </div>
                </div>

                {session.status === "submitted" ? (
                  <button
                    type="button"
                    onClick={newAudit}
                    className="rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white"
                  >
                    New Audit
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={submitAudit}
                    className="rounded-xl bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-50"
                  >
                    {busy ? "Please wait..." : "Submit Audit"}
                  </button>
                )}
              </div>
            </div>

            <div className="border-b border-neutral-100 px-5 py-4 sm:px-7">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="relative flex-1">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search point, code, or area..."
                    disabled={!isDraft}
                    className="h-11 w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 pr-10 text-sm outline-none transition focus:border-red-300 focus:bg-white focus:ring-4 focus:ring-red-50 disabled:opacity-60"
                  />
                  {search ? (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-neutral-400"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOpenGroups(new Set(allGroupIds))}
                    className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700"
                  >
                    Expand All
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenGroups(new Set())}
                    className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-700"
                  >
                    Collapse All
                  </button>
                </div>
              </div>
            </div>

            <div className="grid gap-5 p-5 sm:p-7 xl:grid-cols-[minmax(0,1fr)_360px]">
              <section className="min-w-0">
                <div className="grid gap-3">
                  {visibleGroups.map((group) => {
                    const isOpen =
                      Boolean(normalizedSearch) ||
                      openGroups.has(group.id);

                    const groupFindingCount =
                      findingsByGroup.get(group.code) || 0;

                    return (
                      <article
                        key={group.id}
                        className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setOpenGroups((current) => {
                              const next = new Set(current);
                              if (next.has(group.id)) {
                                next.delete(group.id);
                              } else {
                                next.add(group.id);
                              }
                              return next;
                            })
                          }
                          className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-neutral-50 sm:px-5"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-base font-bold text-neutral-900">
                                {group.name}
                              </h2>
                              {groupFindingCount ? (
                                <span className="rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-700">
                                  {groupFindingCount} finding
                                </span>
                              ) : null}
                            </div>
                            <p className="mt-1 text-xs text-neutral-400">
                              {group.questions.length} reference points
                            </p>
                          </div>
                          <span className={`grid h-8 w-8 place-items-center rounded-full border border-neutral-200 text-lg text-neutral-500 transition ${
                            isOpen ? "rotate-180 bg-neutral-50" : "bg-white"
                          }`}>
                            ⌄
                          </span>
                        </button>

                        {isOpen ? (
                          <div className="border-t border-neutral-100">
                            {group.questions.map((question, index) => {
                              const count =
                                findingsByQuestion.get(question.id) || 0;

                              return (
                                <div
                                  key={question.id}
                                  className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5 ${
                                    index ? "border-t border-neutral-100" : ""
                                  }`}
                                >
                                  <div className="flex min-w-0 items-start gap-3">
                                    <span className="mt-0.5 shrink-0 rounded-lg bg-neutral-100 px-2 py-1 font-mono text-[10px] font-bold text-neutral-500">
                                      {question.code}
                                    </span>
                                    <div>
                                      <p className="text-sm font-medium leading-6 text-neutral-800">
                                        {question.text}
                                      </p>
                                      {count ? (
                                        <p className="mt-1 text-xs font-semibold text-red-600">
                                          {count} finding recorded
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>

                                  {isDraft ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openFinding(
                                          group.code,
                                          group.name,
                                          question,
                                        )
                                      }
                                      className="shrink-0 rounded-xl bg-neutral-950 px-3.5 py-2 text-xs font-bold text-white transition hover:bg-red-700"
                                    >
                                      + Add Finding
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </section>

              <aside className="xl:sticky xl:top-24 xl:self-start">
                <div className="rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-neutral-900">
                        Findings
                      </h2>
                      <p className="mt-1 text-xs text-neutral-400">
                        Saved to database.
                      </p>
                    </div>
                    <span className="grid h-9 min-w-9 place-items-center rounded-xl bg-white px-2 text-sm font-bold text-red-700 shadow-sm">
                      {findings.length}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {findings.map((finding) => (
                      <div
                        key={finding.id}
                        className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                              {finding.groupName} · {finding.questionCode}
                            </p>
                            <p className="mt-1 text-xs font-semibold leading-5 text-neutral-800">
                              {finding.questionText}
                            </p>
                          </div>

                          {isDraft ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => removeFinding(finding.id)}
                              className="rounded-lg px-2 py-1 text-xs font-bold text-neutral-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                            >
                              ×
                            </button>
                          ) : null}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase ${riskClass(finding.risk)}`}>
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

                        {finding.photo ? (
                          <p className="mt-2 truncate text-[10px] font-semibold text-emerald-600">
                            ✓ Photo attached
                            {finding.photo.originalFilename
                              ? ` · ${finding.photo.originalFilename}`
                              : ""}
                          </p>
                        ) : null}
                      </div>
                    ))}

                    {!findings.length ? (
                      <div className="rounded-xl border border-dashed border-neutral-300 bg-white px-4 py-8 text-center">
                        <p className="text-xs font-semibold text-neutral-500">
                          No findings recorded.
                        </p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </aside>
            </div>
          </>
        )}
      </div>

      {selected && isDraft ? (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 backdrop-blur-[2px] sm:items-center sm:p-5">
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
                disabled={busy}
                onClick={() => setSelected(null)}
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-neutral-100 text-lg font-bold text-neutral-500"
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
                  {riskOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={busy}
                      onClick={() => setRisk(option.value)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-bold transition ${
                        risk === option.value
                          ? "border-red-600 bg-red-600 text-white"
                          : "border-neutral-200 bg-white text-neutral-600"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                  Finding Category
                </span>
                <select
                  value={categoryId}
                  disabled={busy}
                  onChange={(event) => setCategoryId(event.target.value)}
                  className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm text-neutral-900 [color-scheme:light] outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50 disabled:bg-neutral-100 disabled:text-neutral-500"
                >
                  {data.categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                  Notes
                </span>
                <textarea
                  value={notes}
                  disabled={busy}
                  onChange={(event) => setNotes(event.target.value)}
                  placeholder="Describe the finding..."
                  className="min-h-28 resize-y rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm leading-6 text-neutral-900 placeholder:text-neutral-400 [color-scheme:light] outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50 disabled:bg-neutral-100 disabled:text-neutral-500"
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
                  disabled={busy}
                  onChange={(event) =>
                    setPhoto(event.target.files?.[0] || null)
                  }
                  className="block w-full rounded-xl border border-dashed border-neutral-300 bg-neutral-50 px-3 py-3 text-xs text-neutral-700 [color-scheme:light] file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-900 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white disabled:bg-neutral-100 disabled:text-neutral-400"
                />
                <span className="text-[11px] leading-5 text-neutral-400">
                  Foto dikompres sebelum upload. Untuk A5, photo masih optional.
                </span>
              </label>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {error}
                </div>
              ) : null}
            </div>

            <div className="sticky bottom-0 flex gap-2 border-t border-neutral-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
              <button
                type="button"
                disabled={busy}
                onClick={() => setSelected(null)}
                className="flex-1 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-sm font-bold text-neutral-600 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || !categoryId}
                onClick={saveFinding}
                className="flex-[1.4] rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                {busy ? "Saving..." : "Save Finding"}
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
          accent ? "text-red-700" : "text-neutral-900"
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
