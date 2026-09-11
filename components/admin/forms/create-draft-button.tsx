"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type CreateDraftButtonProps = {
  formVersionId: string;
};

export default function CreateDraftButton({
  formVersionId,
}: CreateDraftButtonProps) {
  const router = useRouter();
  const [pending, setPending] =
    useState(false);
  const [error, setError] =
    useState<string | null>(null);

  async function createDraft() {
    if (pending) return;

    setPending(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/forms/${formVersionId}/clone`,
        {
          method: "POST",
        }
      );
      const payload = await response
        .json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            "Unable to create draft."
        );
      }

      router.refresh();
    } catch (createError: any) {
      setError(
        createError?.message ||
          "Unable to create draft."
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={createDraft}
        disabled={pending}
        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-[10px] font-black uppercase tracking-wide text-red-700 transition hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
      >
        {pending ? "Creating..." : "Create Draft"}
      </button>

      {error && (
        <p className="max-w-[180px] text-right text-[10px] font-semibold leading-4 text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
