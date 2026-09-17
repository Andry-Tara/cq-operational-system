"use client";

import {
  useState,
} from "react";

export function AuditShareActions({
  sessionId,
  auditNumber,
  outletName,
}: {
  sessionId: string;
  auditNumber: string;
  outletName: string;
}) {
  const [
    loading,
    setLoading,
  ] =
    useState(false);

  const [
    shareUrl,
    setShareUrl,
  ] =
    useState<string | null>(
      null,
    );

  const [
    expiresAt,
    setExpiresAt,
  ] =
    useState<string | null>(
      null,
    );

  const [
    message,
    setMessage,
  ] =
    useState<string | null>(
      null,
    );

  async function createShare() {
    if (loading) {
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      // First create/update the immutable private PDF copy.
      const persist =
        await fetch(
          `/api/audit/${sessionId}/pdf?persist=1&persistOnly=1`,
          {
            method: "GET",
            credentials:
              "same-origin",
            cache:
              "no-store",
          },
        );

      const persistPayload =
        await persist
          .json()
          .catch(
            () => ({}),
          );

      if (!persist.ok) {
        throw new Error(
          persistPayload?.error ||
            "Unable to prepare PDF.",
        );
      }

      const response =
        await fetch(
          `/api/audit/${sessionId}/share`,
          {
            method: "POST",

            credentials:
              "same-origin",

            cache:
              "no-store",
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => ({}),
          );

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            "Unable to create share link.",
        );
      }

      const url =
        `${window.location.origin}${payload.sharePath}`;

      setShareUrl(
        url,
      );

      setExpiresAt(
        payload.expiresAt ??
          null,
      );

      setMessage(
        "Secure share link created.",
      );
    } catch (
      error: any
    ) {
      setMessage(
        error?.message ||
          "Unable to share report.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!shareUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        shareUrl,
      );

      setMessage(
        "Share link copied.",
      );
    } catch {
      setMessage(
        "Unable to copy link automatically.",
      );
    }
  }

  function shareWhatsApp() {
    if (!shareUrl) {
      return;
    }

    const text =
      [
        "Outlet Audit Report",
        outletName,
        auditNumber,
        "",
        shareUrl,
      ].join("\n");

    window.open(
      `https://wa.me/?text=${encodeURIComponent(
        text,
      )}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  async function revokeShare() {
    if (
      loading ||
      !shareUrl
    ) {
      return;
    }

    try {
      setLoading(true);
      setMessage(null);

      const response =
        await fetch(
          `/api/audit/${sessionId}/share`,
          {
            method: "DELETE",

            credentials:
              "same-origin",

            cache:
              "no-store",
          },
        );

      const payload =
        await response
          .json()
          .catch(
            () => ({}),
          );

      if (!response.ok) {
        throw new Error(
          payload?.error ||
            "Unable to revoke share link.",
        );
      }

      setShareUrl(null);
      setExpiresAt(null);

      setMessage(
        "Share link revoked.",
      );
    } catch (
      error: any
    ) {
      setMessage(
        error?.message ||
          "Unable to revoke share link.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
            Secure Share
          </p>

          <p className="mt-1 text-sm font-bold">
            Share PDF without login
          </p>

          <p className="mt-1 text-xs text-neutral-500">
            Link berlaku 7 hari dan dapat direvoke.
          </p>
        </div>

        {!shareUrl && (
          <button
            type="button"
            disabled={
              loading
            }
            onClick={
              createShare
            }
            className="inline-flex h-11 items-center justify-center rounded-xl bg-neutral-900 px-5 text-sm font-bold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
          >
            {loading
              ? "Preparing..."
              : "Share Report"}
          </button>
        )}
      </div>

      {shareUrl && (
        <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-3">
          <p className="break-all text-xs font-semibold text-neutral-600">
            {shareUrl}
          </p>

          {expiresAt && (
            <p className="mt-2 text-[11px] text-neutral-400">
              Expires{" "}
              {new Intl.DateTimeFormat(
                "en-GB",
                {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                },
              ).format(
                new Date(
                  expiresAt,
                ),
              )}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={
                copyLink
              }
              className="inline-flex h-10 items-center rounded-xl border border-neutral-200 px-4 text-xs font-bold text-neutral-700"
            >
              Copy Link
            </button>

            <button
              type="button"
              onClick={
                shareWhatsApp
              }
              className="inline-flex h-10 items-center rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white"
            >
              WhatsApp
            </button>

            <button
              type="button"
              disabled={
                loading
              }
              onClick={
                revokeShare
              }
              className="inline-flex h-10 items-center rounded-xl border border-red-200 bg-red-50 px-4 text-xs font-bold text-red-700 disabled:opacity-50"
            >
              {loading
                ? "Revoking..."
                : "Revoke Link"}
            </button>
          </div>
        </div>
      )}

      {message && (
        <p className="mt-3 text-xs font-semibold text-neutral-500">
          {message}
        </p>
      )}
    </div>
  );
}
