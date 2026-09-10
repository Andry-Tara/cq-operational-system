"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

type AreaCode =
  | "STORE"
  | "PRODUCTION";

type SectionAssignment = {
  outletId: string;
  formId: string;
  sectionId: string;
};

type LeaderAssignment = {
  outletId: string;
  formId: string;
  areaCode: AreaCode;
};

type SectionOption = {
  id: string;
  code: string;
  name: string;
  areaCode: AreaCode;
};

type Config = {
  outletId: string;
  outletCode: string;
  outletName: string;
  formId: string;
  formCode: string;
  formName: string;
  formVersionId: string;
  sections: SectionOption[];
};

function sectionKey(
  row: SectionAssignment
) {
  return [
    row.outletId,
    row.formId,
    row.sectionId,
  ].join(":");
}

function leaderKey(
  row: LeaderAssignment
) {
  return [
    row.outletId,
    row.formId,
    row.areaCode,
  ].join(":");
}

export function CkAccessEditor({
  userId,
  roleCode,
  outletIds,
  disabled,
}: {
  userId?: string;
  roleCode?: string | null;
  outletIds: string[];
  disabled?: boolean;
}) {
  const [loading, setLoading] =
    useState(true);

  const [ready, setReady] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const [configs, setConfigs] =
    useState<Config[]>([]);

  const [
    sectionAssignments,
    setSectionAssignments,
  ] =
    useState<
      SectionAssignment[]
    >([]);

  const [
    leaderAssignments,
    setLeaderAssignments,
  ] =
    useState<
      LeaderAssignment[]
    >([]);

  const isLeader =
    roleCode === "CK_MANAGER";

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setReady(false);
      setError(null);

      try {
        const query =
          userId
            ? `?userId=${encodeURIComponent(
                userId
              )}`
            : "";

        const response =
          await fetch(
            `/api/admin/users/ck-access${query}`,
            {
              cache: "no-store",
            }
          );

        const result =
          await response.json();

        if (!response.ok) {
          throw new Error(
            result?.error ||
              "Unable to load Central Kitchen access."
          );
        }

        if (cancelled) {
          return;
        }

        setConfigs(
          Array.isArray(
            result?.assignments
          )
            ? result.assignments
            : []
        );

        setSectionAssignments(
          Array.isArray(
            result
              ?.sectionAssignments
          )
            ? result
                .sectionAssignments
            : []
        );

        setLeaderAssignments(
          Array.isArray(
            result
              ?.leaderAssignments
          )
            ? result
                .leaderAssignments
            : []
        );

        setReady(true);
      } catch (err: any) {
        if (cancelled) {
          return;
        }

        setError(
          err?.message ||
            "Unable to load Central Kitchen access."
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

    setSectionAssignments(
      (current) =>
        current.filter(
          (item) =>
            allowed.has(
              item.outletId
            )
        )
    );

    setLeaderAssignments(
      (current) =>
        current.filter(
          (item) =>
            allowed.has(
              item.outletId
            )
        )
    );
  }, [outletIds]);

  useEffect(() => {
    if (!isLeader) {
      setLeaderAssignments(
        []
      );
    }
  }, [isLeader]);

  const visibleConfigs =
    useMemo(
      () =>
        configs.filter(
          (config) =>
            outletIds.includes(
              config.outletId
            )
        ),
      [
        configs,
        outletIds,
      ]
    );

  function toggleSection(
    row: SectionAssignment
  ) {
    const key =
      sectionKey(row);

    setSectionAssignments(
      (current) =>
        current.some(
          (item) =>
            sectionKey(item) ===
            key
        )
          ? current.filter(
              (item) =>
                sectionKey(item) !==
                key
            )
          : [
              ...current,
              row,
            ]
    );
  }

  function toggleLeader(
    row: LeaderAssignment
  ) {
    const key =
      leaderKey(row);

    setLeaderAssignments(
      (current) =>
        current.some(
          (item) =>
            leaderKey(item) ===
            key
        )
          ? current.filter(
              (item) =>
                leaderKey(item) !==
                key
            )
          : [
              ...current,
              row,
            ]
    );
  }

  return (
    <div className="rounded-[22px] border border-neutral-200 bg-neutral-50 p-4 md:p-5">
      <input
        type="hidden"
        name="ckAccessReady"
        value={
          ready
            ? "true"
            : "false"
        }
      />

      <input
        type="hidden"
        name="ckSectionAssignments"
        value={JSON.stringify(
          sectionAssignments
        )}
      />

      <input
        type="hidden"
        name="ckLeaderAssignments"
        value={JSON.stringify(
          leaderAssignments
        )}
      />

      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.12em] text-red-700">
          Central Kitchen Access
        </p>

        <p className="mt-1 text-xs leading-5 text-neutral-500">
          Section Assignment
          controls PIC access.
          Leadership controls
          review and finalization.
        </p>
      </div>

      {loading && (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white px-4 py-4 text-xs font-semibold text-neutral-500">
          Loading Central Kitchen
          configuration...
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-xs font-semibold text-red-700">
          {error}
        </div>
      )}

      {!loading &&
        ready &&
        visibleConfigs.length ===
          0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-xs font-semibold text-amber-800">
            No active Central
            Kitchen form is
            assigned to the
            selected outlet.
          </div>
        )}

      {!loading &&
        ready && (
          <div className="mt-5 space-y-5">
            {visibleConfigs.map(
              (config) => {
                const groups = [
                  {
                    areaCode:
                      "STORE" as const,
                    label:
                      "Warehouse / Store",
                    sections:
                      config.sections.filter(
                        (section) =>
                          section.areaCode ===
                          "STORE"
                      ),
                  },
                  {
                    areaCode:
                      "PRODUCTION" as const,
                    label:
                      "Production",
                    sections:
                      config.sections.filter(
                        (section) =>
                          section.areaCode ===
                          "PRODUCTION"
                      ),
                  },
                ];

                return (
                  <div
                    key={`${config.outletId}:${config.formId}`}
                    className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
                  >
                    <div className="border-b border-neutral-100 px-4 py-4">
                      <p className="text-sm font-bold text-neutral-900">
                        {config.formName ||
                          config.formCode}
                      </p>

                      <p className="mt-1 text-[11px] font-medium text-neutral-400">
                        {
                          config.outletName
                        }{" "}
                        ·{" "}
                        {
                          config.formCode
                        }
                      </p>
                    </div>

                    {isLeader && (
                      <div className="border-b border-neutral-100 px-4 py-4">
                        <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500">
                          Leadership
                        </p>

                        <p className="mt-1 text-[11px] leading-5 text-neutral-400">
                          Area leaders can
                          monitor, review
                          and finalize the
                          assigned area.
                        </p>

                        <div className="mt-3 grid gap-2 sm:grid-cols-2">
                          {groups
                            .filter(
                              (group) =>
                                group
                                  .sections
                                  .length >
                                0
                            )
                            .map(
                              (
                                group
                              ) => {
                                const assignment:
                                  LeaderAssignment =
                                  {
                                    outletId:
                                      config.outletId,
                                    formId:
                                      config.formId,
                                    areaCode:
                                      group.areaCode,
                                  };

                                const checked =
                                  leaderAssignments.some(
                                    (
                                      item
                                    ) =>
                                      leaderKey(
                                        item
                                      ) ===
                                      leaderKey(
                                        assignment
                                      )
                                  );

                                return (
                                  <label
                                    key={
                                      group.areaCode
                                    }
                                    className={
                                      checked
                                        ? "flex cursor-pointer items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3"
                                        : "flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-3"
                                    }
                                  >
                                    <input
                                      type="checkbox"
                                      checked={
                                        checked
                                      }
                                      disabled={
                                        disabled
                                      }
                                      onChange={() =>
                                        toggleLeader(
                                          assignment
                                        )
                                      }
                                    />

                                    <span className="text-xs font-bold text-neutral-700">
                                      {
                                        group.label
                                      }{" "}
                                      Leader
                                    </span>
                                  </label>
                                );
                              }
                            )}
                        </div>
                      </div>
                    )}

                    <div className="px-4 py-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500">
                        Section Assignment
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-neutral-400">
                        Selected sections
                        can be viewed,
                        filled and
                        submitted by this
                        user.
                      </p>

                      {groups.map(
                        (group) =>
                          group.sections
                            .length >
                            0 && (
                            <div
                              key={
                                group.areaCode
                              }
                              className="mt-4"
                            >
                              <p className="mb-2 text-[10px] font-black uppercase text-neutral-400">
                                {
                                  group.label
                                }
                              </p>

                              <div className="grid gap-2 sm:grid-cols-2">
                                {group.sections.map(
                                  (
                                    section
                                  ) => {
                                    const assignment:
                                      SectionAssignment =
                                      {
                                        outletId:
                                          config.outletId,
                                        formId:
                                          config.formId,
                                        sectionId:
                                          section.id,
                                      };

                                    const checked =
                                      sectionAssignments.some(
                                        (
                                          item
                                        ) =>
                                          sectionKey(
                                            item
                                          ) ===
                                          sectionKey(
                                            assignment
                                          )
                                      );

                                    return (
                                      <label
                                        key={
                                          section.id
                                        }
                                        className={
                                          checked
                                            ? "flex cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-3"
                                            : "flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-3"
                                        }
                                      >
                                        <input
                                          type="checkbox"
                                          className="mt-0.5"
                                          checked={
                                            checked
                                          }
                                          disabled={
                                            disabled
                                          }
                                          onChange={() =>
                                            toggleSection(
                                              assignment
                                            )
                                          }
                                        />

                                        <span className="min-w-0">
                                          <span className="block text-xs font-bold text-neutral-700">
                                            {section.name ||
                                              section.code}
                                          </span>

                                          <span className="mt-0.5 block truncate text-[10px] font-medium text-neutral-400">
                                            {
                                              section.code
                                            }
                                          </span>
                                        </span>
                                      </label>
                                    );
                                  }
                                )}
                              </div>
                            </div>
                          )
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
    </div>
  );
}
