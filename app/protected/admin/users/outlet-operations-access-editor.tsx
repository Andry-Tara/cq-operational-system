"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type FormOption = {
  id: string;
  code: string;
  name: string;
};

type OutletOption = {
  id: string;
  code: string;
  name: string;
};

type Assignment = {
  outletId: string;
  formId: string;
  canFill: boolean;
  canSubmit: boolean;
  canReview: boolean;
  canOverride: boolean;
};

type Preset =
  | "none"
  | "leader"
  | "supervisor"
  | "custom";

function permissionKey(
  outletId: string,
  formId: string
) {
  return `${outletId}:${formId}`;
}

function presetOf(
  assignment?: Assignment
): Preset {
  if (!assignment) {
    return "none";
  }

  if (
    assignment.canFill &&
    assignment.canSubmit &&
    !assignment.canReview &&
    !assignment.canOverride
  ) {
    return "leader";
  }

  if (
    assignment.canFill &&
    assignment.canSubmit &&
    assignment.canReview &&
    assignment.canOverride
  ) {
    return "supervisor";
  }

  return "custom";
}

function presetAssignment(
  outletId: string,
  formId: string,
  preset: Preset
): Assignment | null {
  if (preset === "none") {
    return null;
  }

  if (preset === "leader") {
    return {
      outletId,
      formId,
      canFill: true,
      canSubmit: true,
      canReview: false,
      canOverride: false,
    };
  }

  if (preset === "supervisor") {
    return {
      outletId,
      formId,
      canFill: true,
      canSubmit: true,
      canReview: true,
      canOverride: true,
    };
  }

  return {
    outletId,
    formId,
    canFill: true,
    canSubmit: false,
    canReview: false,
    canOverride: false,
  };
}

export function OutletOperationsAccessEditor({
  userId,
  outletIds,
  disabled,
}: {
  userId?: string;
  outletIds: string[];
  disabled?: boolean;
}) {
  const [loading, setLoading] =
    useState(Boolean(userId));
  const [saving, setSaving] =
    useState(false);
  const [ready, setReady] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);
  const [message, setMessage] =
    useState<string | null>(null);

  const [forms, setForms] =
    useState<FormOption[]>([]);
  const [outlets, setOutlets] =
    useState<OutletOption[]>([]);
  const [
    storedUserOutletIds,
    setStoredUserOutletIds,
  ] = useState<string[]>([]);
  const [
    assignments,
    setAssignments,
  ] = useState<Assignment[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!userId) {
        setLoading(false);
        setReady(false);
        setForms([]);
        setOutlets([]);
        setStoredUserOutletIds([]);
        setAssignments([]);
        return;
      }

      setLoading(true);
      setReady(false);
      setError(null);
      setMessage(null);

      try {
        const response = await fetch(
          `/api/admin/users/outlet-operations-access?userId=${encodeURIComponent(
            userId
          )}`,
          {
            cache: "no-store",
          }
        );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result?.error ||
              "Unable to load Outlet Operations access."
          );
        }

        if (cancelled) {
          return;
        }

        setForms(
          Array.isArray(result?.forms)
            ? result.forms
            : []
        );

        setOutlets(
          Array.isArray(result?.outlets)
            ? result.outlets
            : []
        );

        setStoredUserOutletIds(
          Array.isArray(
            result?.userOutletIds
          )
            ? result.userOutletIds
            : []
        );

        setAssignments(
          Array.isArray(
            result?.assignments
          )
            ? result.assignments
            : []
        );

        setReady(true);
      } catch (err: any) {
        if (cancelled) {
          return;
        }

        setError(
          err?.message ||
            "Unable to load Outlet Operations access."
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    const allowed =
      new Set(outletIds);

    setAssignments((current) =>
      current.filter((item) =>
        allowed.has(item.outletId)
      )
    );
  }, [outletIds]);

  const visibleOutlets =
    useMemo(
      () =>
        outlets.filter((outlet) =>
          outletIds.includes(outlet.id)
        ),
      [outlets, outletIds]
    );

  const assignmentMap =
    useMemo(() => {
      const map =
        new Map<string, Assignment>();

      for (const item of assignments) {
        map.set(
          permissionKey(
            item.outletId,
            item.formId
          ),
          item
        );
      }

      return map;
    }, [assignments]);

  const hasUnsavedOutletAdd =
    outletIds.some(
      (id) =>
        !storedUserOutletIds.includes(id)
    );

  function replaceAssignment(
    outletId: string,
    formId: string,
    next: Assignment | null
  ) {
    const key =
      permissionKey(
        outletId,
        formId
      );

    setAssignments((current) => {
      const filtered =
        current.filter(
          (item) =>
            permissionKey(
              item.outletId,
              item.formId
            ) !== key
        );

      return next
        ? [...filtered, next]
        : filtered;
    });

    setMessage(null);
  }

  function toggleCapability(
    outletId: string,
    formId: string,
    field:
      | "canFill"
      | "canSubmit"
      | "canReview"
      | "canOverride"
  ) {
    const current =
      assignmentMap.get(
        permissionKey(
          outletId,
          formId
        )
      ) ??
      presetAssignment(
        outletId,
        formId,
        "custom"
      )!;

    const next = {
      ...current,
      [field]: !current[field],
    };

    const hasAny =
      next.canFill ||
      next.canSubmit ||
      next.canReview ||
      next.canOverride;

    replaceAssignment(
      outletId,
      formId,
      hasAny ? next : null
    );
  }

  async function saveAccess() {
    if (!userId) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        "/api/admin/users/outlet-operations-access",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            userId,
            assignments,
          }),
        }
      );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to save Outlet Operations access."
        );
      }

      setAssignments(
        Array.isArray(
          result?.assignments
        )
          ? result.assignments
          : []
      );

      setStoredUserOutletIds([
        ...outletIds,
      ]);

      setMessage(
        "Outlet Operations access saved."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to save Outlet Operations access."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!userId) {
    return (
      <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-red-700">
          Outlet Operations Access
        </p>
        <p className="mt-2 text-xs leading-5 text-neutral-500">
          Create this user first. Then reopen
          Edit User to assign Leader or
          Supervisor access for Opening and
          Closing operations.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-red-700">
            Outlet Operations Access
          </p>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-neutral-500">
            Leader gives Fill + Submit access
            for the complete form. Supervisor
            gives Fill + Submit + Review +
            Override. Section delegation will
            remain optional and separate.
          </p>
        </div>

        <button
          type="button"
          disabled={
            disabled ||
            saving ||
            loading ||
            !ready ||
            forms.length === 0 ||
            hasUnsavedOutletAdd
          }
          onClick={() =>
            void saveAccess()
          }
          className="rounded-xl bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          {saving
            ? "Saving..."
            : "Save Operations Access"}
        </button>
      </div>

      {hasUnsavedOutletAdd && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold leading-5 text-amber-800">
          Outlet Access above has changed.
          Save the user first, then reopen Edit
          User before assigning access to the
          newly added outlet.
        </div>
      )}

      {loading && (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-4 text-xs font-semibold text-neutral-500">
          Loading Outlet Operations access...
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-xs font-semibold leading-5 text-red-700">
          {error}
        </div>
      )}

      {message && (
        <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-xs font-semibold text-emerald-700">
          {message}
        </div>
      )}

      {!loading &&
        ready &&
        forms.length === 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-xs font-semibold leading-5 text-amber-800">
            The four Outlet Operations form
            masters have not been created yet.
            This access editor is ready and will
            show Opening FOH, Opening BOH,
            Closing FOH and Closing BOH after
            those forms are created.
          </div>
        )}

      {!loading &&
        ready &&
        visibleOutlets.length === 0 &&
        forms.length > 0 && (
          <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-4 text-xs font-semibold text-neutral-500">
            Select at least one Outlet Access
            above.
          </div>
        )}

      {!loading &&
        ready &&
        visibleOutlets.length > 0 &&
        forms.length > 0 && (
          <div className="mt-5 space-y-4">
            {visibleOutlets.map(
              (outlet) => (
                <div
                  key={outlet.id}
                  className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                >
                  <div className="border-b border-neutral-100 px-4 py-3">
                    <p className="text-sm font-bold text-neutral-900">
                      {outlet.name}
                    </p>
                    <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-neutral-400">
                      {outlet.code}
                    </p>
                  </div>

                  <div className="divide-y divide-neutral-100">
                    {forms.map(
                      (form) => {
                        const key =
                          permissionKey(
                            outlet.id,
                            form.id
                          );

                        const assignment =
                          assignmentMap.get(
                            key
                          );

                        const preset =
                          presetOf(
                            assignment
                          );

                        return (
                          <div
                            key={form.id}
                            className="px-4 py-4"
                          >
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                              <div>
                                <p className="text-xs font-bold text-neutral-800">
                                  {form.name ||
                                    form.code}
                                </p>
                                <p className="mt-0.5 text-[10px] font-semibold text-neutral-400">
                                  {form.code}
                                </p>
                              </div>

                              <select
                                value={preset}
                                disabled={
                                  disabled ||
                                  saving
                                }
                                onChange={(
                                  event
                                ) => {
                                  const nextPreset =
                                    event
                                      .target
                                      .value as Preset;

                                  replaceAssignment(
                                    outlet.id,
                                    form.id,
                                    presetAssignment(
                                      outlet.id,
                                      form.id,
                                      nextPreset
                                    )
                                  );
                                }}
                                className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs font-bold text-neutral-700 outline-none focus:border-red-300"
                              >
                                <option value="none">
                                  No Access
                                </option>
                                <option value="leader">
                                  Leader
                                </option>
                                <option value="supervisor">
                                  Supervisor
                                </option>
                                <option value="custom">
                                  Custom
                                </option>
                              </select>
                            </div>

                            {assignment && (
                              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {(
                                  [
                                    [
                                      "canFill",
                                      "Fill",
                                    ],
                                    [
                                      "canSubmit",
                                      "Submit",
                                    ],
                                    [
                                      "canReview",
                                      "Review",
                                    ],
                                    [
                                      "canOverride",
                                      "Override",
                                    ],
                                  ] as const
                                ).map(
                                  ([
                                    field,
                                    label,
                                  ]) => (
                                    <label
                                      key={
                                        field
                                      }
                                      className={
                                        assignment[
                                          field
                                        ]
                                          ? "flex cursor-pointer items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5"
                                          : "flex cursor-pointer items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3 py-2.5"
                                      }
                                    >
                                      <input
                                        type="checkbox"
                                        checked={
                                          assignment[
                                            field
                                          ]
                                        }
                                        disabled={
                                          disabled ||
                                          saving
                                        }
                                        onChange={() =>
                                          toggleCapability(
                                            outlet.id,
                                            form.id,
                                            field
                                          )
                                        }
                                      />
                                      <span className="text-[11px] font-bold text-neutral-700">
                                        {
                                          label
                                        }
                                      </span>
                                    </label>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
    </div>
  );
}
