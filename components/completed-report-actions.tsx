"use client";

import Link from "next/link";
import {
  useState,
} from "react";

export default function CompletedReportActions({
  reportId,
  title,
  hasPdf,
}: {
  reportId: string;
  title: string;
  hasPdf: boolean;
}) {
  const [
    busy,
    setBusy,
  ] = useState<
    "copy" |
    "whatsapp" |
    null
  >(null);

  const [
    message,
    setMessage,
  ] = useState("");

  async function loadText() {
    const response =
      await fetch(
        `/api/reports/${encodeURIComponent(
          reportId
        )}/text`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

    const data =
      await response
        .json()
        .catch(
          () => ({})
        );

    if (
      !response.ok ||
      !data?.text
    ) {
      throw new Error(
        data?.error ||
          "Unable to load report recap."
      );
    }

    return String(
      data.text
    );
  }

  async function copyRecap() {
    if (busy) return;

    try {
      setBusy("copy");
      setMessage("");

      const text =
        await loadText();

      await navigator
        .clipboard
        .writeText(
          text
        );

      setMessage(
        "Rekap berhasil dicopy."
      );
    } catch (
      error: any
    ) {
      setMessage(
        error?.message ||
          "Copy rekap gagal."
      );
    } finally {
      setBusy(null);
    }
  }

  async function shareWhatsApp() {
    if (busy) return;

    try {
      setBusy(
        "whatsapp"
      );
      setMessage("");

      const text =
        await loadText();

      const url =
        `https://wa.me/?text=${encodeURIComponent(
          text
        )}`;

      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );
    } catch (
      error: any
    ) {
      setMessage(
        error?.message ||
          "Unable to open WhatsApp."
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border-t border-red-100 bg-red-50 p-3 sm:p-3.5">
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={
            copyRecap
          }
          disabled={
            busy !== null
          }
          className="rounded-xl border border-red-200 bg-white px-2 py-3 text-[11px] font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs"
        >
          {busy ===
          "copy"
            ? "Copying..."
            : "📋 Copy Rekap"}
        </button>

        <button
          type="button"
          onClick={
            shareWhatsApp
          }
          disabled={
            busy !== null
          }
          className="rounded-xl border border-red-200 bg-white px-2 py-3 text-[11px] font-black text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs"
        >
          {busy ===
          "whatsapp"
            ? "Opening..."
            : "📤 WhatsApp"}
        </button>

        {hasPdf ? (
          <Link
            href={`/api/reports/${encodeURIComponent(
              reportId
            )}/pdf`}
            target="_blank"
            className="rounded-xl bg-red-700 px-2 py-3 text-center text-[11px] font-black text-white transition hover:bg-red-800 sm:text-xs"
          >
            ⬇ PDF
          </Link>
        ) : (
          <Link
            href="/protected/reports"
            className="rounded-xl bg-neutral-200 px-2 py-3 text-center text-[11px] font-black text-neutral-600 transition hover:bg-neutral-300 sm:text-xs"
          >
            View Report
          </Link>
        )}
      </div>

      {message ? (
        <p className="mt-2 text-center text-[10px] font-semibold text-neutral-500">
          {message}
        </p>
      ) : null}

      <p className="mt-2 text-center text-[9px] font-medium text-neutral-400">
        {title}
      </p>
    </div>
  );
}
