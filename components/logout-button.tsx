"use client";

import { useState } from "react";

import { createClient } from "@/lib/supabase/client";

export function LogoutButton({
  compact = false,
}: {
  compact?: boolean;
}) {
  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  async function logout() {
    if (loading) return;

    setLoading(true);
    setError("");

    try {
      const supabase =
        createClient();

      const {
        error:
          signOutError,
      } =
        await supabase.auth.signOut();

      if (signOutError) {
        throw signOutError;
      }

      // Hard navigation is intentional here.
      // It guarantees authenticated state is fully cleared.
      window.location.href =
        "/auth/login";

    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to sign out."
      );

      setLoading(false);
    }
  }

  if (compact) {
    return (
      <div>
        <button
          type="button"
          disabled={loading}
          onClick={logout}
          className="flex w-full items-center rounded-xl px-3 py-2.5 text-left text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
        >
          {loading
            ? "Signing out..."
            : "Log out"}
        </button>

        {error && (
          <p className="px-3 pb-2 text-[10px] text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={logout}
      className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-white px-4 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
    >
      {loading
        ? "Signing out..."
        : "↪ Log out"}
    </button>
  );
}
