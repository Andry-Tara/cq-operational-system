"use client";

import {
  useEffect,
} from "react";

import {
  useRouter,
} from "next/navigation";

export function AutoRefresh({
  intervalMs = 60000,
}: {
  intervalMs?: number;
}) {
  const router =
    useRouter();

  useEffect(() => {
    function refresh() {
      if (
        document.visibilityState ===
        "visible"
      ) {
        router.refresh();
      }
    }

    const timer =
      window.setInterval(
        refresh,
        intervalMs
      );

    window.addEventListener(
      "focus",
      refresh
    );

    return () => {
      window.clearInterval(
        timer
      );

      window.removeEventListener(
        "focus",
        refresh
      );
    };
  }, [
    router,
    intervalMs,
  ]);

  return null;
}
