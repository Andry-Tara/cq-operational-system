"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

type PublishVersionButtonProps = {
  formVersionId: string;
};

export default function PublishVersionButton({
  formVersionId,
}: PublishVersionButtonProps) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function publishVersion() {
    if (isPublishing) return;

    const confirmed = window.confirm(
      "Publish this version?\n\nAfter publishing, this version becomes immutable. Publishing does not activate it for any outlet.",
    );

    if (!confirmed) return;

    setIsPublishing(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/forms/${formVersionId}/publish`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
        },
      );
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.error || "Unable to publish this version.");
      }

      setMessage("Published");
      router.refresh();
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Unable to publish this version.",
      );
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        onClick={publishVersion}
        disabled={isPublishing}
      >
        {isPublishing ? "Publishing..." : "Publish"}
      </Button>
      {message && (
        <span className="text-xs font-medium text-emerald-700">
          {message}
        </span>
      )}
      {error && (
        <span className="max-w-48 text-xs font-medium text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}
