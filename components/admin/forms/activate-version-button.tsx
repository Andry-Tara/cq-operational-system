"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type OutletOption = {
  id: string;
  code: string;
  name: string;
  currentVersionNumber: number | null;
  isSelectedVersionActive: boolean;
};

type ActivationResult = {
  outletId: string;
  assignmentId?: string;
  ok: boolean;
  error?: string;
};

type Props = {
  formName: string;
  formVersionId: string;
  versionNumber: number;
  activeOutletCount: number;
  outlets: OutletOption[];
};

type Filter = "all" | "needs-change" | "already-active" | "no-active";

export default function ActivateVersionButton({
  formName,
  formVersionId,
  versionNumber,
  activeOutletCount,
  outlets,
}: Props) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [selectedOutletIds, setSelectedOutletIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [isActivating, setIsActivating] = useState(false);
  const [results, setResults] = useState<ActivationResult[] | null>(null);
  const [error, setError] = useState("");

  const alreadyActiveCount = activeOutletCount;
  const eligibleCount = outlets.length - alreadyActiveCount;
  const selectedOutlets = outlets.filter((outlet) =>
    selectedOutletIds.includes(outlet.id),
  );
  const query = search.trim().toLowerCase();
  const visibleOutlets = outlets.filter((outlet) => {
    const matchesSearch =
      !query ||
      outlet.name.toLowerCase().includes(query) ||
      outlet.code.toLowerCase().includes(query);
    const matchesFilter =
      filter === "all" ||
      (filter === "already-active" && outlet.isSelectedVersionActive) ||
      (filter === "needs-change" &&
        !outlet.isSelectedVersionActive &&
        outlet.currentVersionNumber !== null) ||
      (filter === "no-active" && outlet.currentVersionNumber === null);
    return matchesSearch && matchesFilter;
  });
  const visibleEligibleIds = visibleOutlets
    .filter((outlet) => !outlet.isSelectedVersionActive)
    .map((outlet) => outlet.id);
  const successfulResults = results?.filter((result) => result.ok) ?? [];
  const failedResults = results?.filter((result) => !result.ok) ?? [];
  const successfulIds = new Set(
    successfulResults.map((result) => result.outletId),
  );
  const resultAlreadyActiveCount = selectedOutlets.filter(
    (outlet) =>
      outlet.isSelectedVersionActive && successfulIds.has(outlet.id),
  ).length;

  function openDialog() {
    setIsOpen(true);
    setIsConfirming(false);
    setSelectedOutletIds([]);
    setSearch("");
    setFilter("all");
    setResults(null);
    setError("");
  }

  function closeDialog() {
    if (!isActivating) setIsOpen(false);
  }

  function toggleOutlet(outletId: string) {
    setSelectedOutletIds((current) =>
      current.includes(outletId)
        ? current.filter((id) => id !== outletId)
        : [...current, outletId],
    );
  }

  async function activateVersion() {
    if (isActivating || selectedOutletIds.length === 0) return;
    setIsActivating(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/forms/${formVersionId}/activate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ outletIds: selectedOutletIds }),
        },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(result.error || "Unable to activate this version.");
      }
      setResults(result.results ?? []);
      setIsConfirming(false);
    } catch (activationError) {
      setError(
        activationError instanceof Error
          ? activationError.message
          : "Unable to activate this version.",
      );
    } finally {
      setIsActivating(false);
    }
  }

  const resultComplete = results !== null;
  const failedDetails = failedResults.map((result) => ({
    ...result,
    name:
      outlets.find((outlet) => outlet.id === result.outletId)?.name ??
      result.outletId,
  }));
  const closeWithRefresh = () => {
    setIsOpen(false);
    router.refresh();
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={openDialog}
        disabled={isActivating || outlets.length === 0}
      >
        Activate
      </Button>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Activate version ${versionNumber}`}
            className="flex max-h-[84vh] w-full max-w-[620px] flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-xl"
          >
            <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">
                  Activate Version {versionNumber}
                </h3>
                <p className="mt-1 text-sm text-slate-700">{formName}</p>
              </div>
              <button
                type="button"
                className="text-sm font-medium text-slate-700 underline"
                onClick={closeDialog}
                disabled={isActivating}
              >
                Close
              </button>
            </div>

            {!resultComplete && !isConfirming && (
              <>
                <div className="grid grid-cols-3 gap-2 border-b border-slate-200 px-5 py-3 text-center text-xs text-slate-700">
                  <span><strong className="block text-base text-slate-950">{outlets.length}</strong>outlets</span>
                  <span><strong className="block text-base text-emerald-700">{alreadyActiveCount}</strong>already active</span>
                  <span><strong className="block text-base text-amber-700">{eligibleCount}</strong>need activation</span>
                </div>
                <div className="space-y-3 overflow-y-auto px-5 py-4">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search outlets..."
                    className="min-h-9 w-full rounded border border-slate-300 px-2 text-sm text-slate-900 outline-none focus:border-slate-600 focus:ring-1 focus:ring-slate-600"
                  />
                  <div className="flex flex-wrap gap-2 text-xs">
                    {([
                      ["all", "All"],
                      ["needs-change", "Needs Change"],
                      ["already-active", "Already Active"],
                      ["no-active", "No Active Version"],
                    ] as const).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFilter(value)}
                        className={`rounded border px-2 py-1 ${filter === value ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 text-slate-700"}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-700">
                    <span>{selectedOutletIds.length} selected</span>
                    <div className="flex gap-3">
                      <button type="button" className="font-medium underline" onClick={() => setSelectedOutletIds(visibleEligibleIds)} disabled={isActivating}>Select Visible</button>
                      <button type="button" className="font-medium underline" onClick={() => setSelectedOutletIds([])} disabled={isActivating}>Clear All</button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {visibleOutlets.map((outlet) => {
                      const isAlreadyActive = outlet.isSelectedVersionActive;
                      return (
                        <label key={outlet.id} className="flex items-start gap-3 rounded border border-slate-200 px-3 py-2 text-sm text-slate-800">
                          <input type="checkbox" className="mt-1" checked={selectedOutletIds.includes(outlet.id)} onChange={() => toggleOutlet(outlet.id)} disabled={isActivating || isAlreadyActive} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center justify-between gap-2">
                              <span className="font-medium">{outlet.name} ({outlet.code})</span>
                              <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${isAlreadyActive ? "bg-emerald-100 text-emerald-800" : outlet.currentVersionNumber === null ? "bg-amber-100 text-amber-800" : "bg-sky-100 text-sky-800"}`}>
                                {isAlreadyActive ? "ACTIVE" : outlet.currentVersionNumber === null ? "NEEDS ACTIVATION" : "SWITCH"}
                              </span>
                            </span>
                            <span className="block text-xs text-slate-600">
                              {isAlreadyActive ? `Current: V${outlet.currentVersionNumber} - Already Active` : outlet.currentVersionNumber === null ? `No active version - Target: V${versionNumber}` : `Current: V${outlet.currentVersionNumber} - Target: V${versionNumber}`}
                            </span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3">
                  <button type="button" className="text-sm font-medium text-slate-700 underline" onClick={closeDialog}>Cancel</button>
                  <Button type="button" onClick={() => setIsConfirming(true)} disabled={selectedOutletIds.length === 0}>Activate Selected ({selectedOutletIds.length})</Button>
                </div>
              </>
            )}

            {!resultComplete && isConfirming && (
              <div className="space-y-4 px-5 py-6">
                <div>
                  <h4 className="text-base font-semibold text-slate-950">Activate Version {versionNumber} for {selectedOutlets.length} outlets?</h4>
                  <p className="mt-2 text-sm leading-6 text-slate-700">New operations in selected outlets will use this version. Existing reports keep their original versions.</p>
                </div>
                {error && <p className="text-sm font-medium text-red-700">{error}</p>}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsConfirming(false)} disabled={isActivating}>Back</Button>
                  <Button type="button" onClick={activateVersion} disabled={isActivating}>{isActivating ? `Activating ${selectedOutlets.length} outlets...` : `Activate ${selectedOutlets.length} Outlets`}</Button>
                </div>
              </div>
            )}

            {resultComplete && (
              <div className="space-y-4 overflow-y-auto px-5 py-6">
                <div className="grid grid-cols-3 gap-2 text-center text-xs text-slate-700">
                  <span><strong className="block text-base text-emerald-700">{successfulResults.length - resultAlreadyActiveCount}</strong>activated</span>
                  <span><strong className="block text-base text-slate-700">{resultAlreadyActiveCount}</strong>already active</span>
                  <span><strong className="block text-base text-red-700">{failedResults.length}</strong>failed</span>
                </div>
                {failedDetails.length > 0 && <div className="space-y-2 text-sm text-red-700">{failedDetails.map((result) => <p key={result.outletId}>{result.name}: {result.error ?? "Activation failed."}</p>)}</div>}
                <div className="flex justify-end"><Button type="button" onClick={closeWithRefresh}>{failedResults.length ? "Close" : "Done"}</Button></div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
