"use client";

import {
  useState,
} from "react";


type StandardValue =
  | ""
  | "STANDARD"
  | "NOT_STANDARD";


export default function RetestPanel({
  checkId,
  menuName,
}: {
  checkId: string;
  menuName: string;
}) {
  const [
    open,
    setOpen,
  ] =
    useState(
      false
    );

  const [
    correctionNote,
    setCorrectionNote,
  ] =
    useState(
      ""
    );

  const [
    colorStatus,
    setColorStatus,
  ] =
    useState<
      StandardValue
    >(
      ""
    );

  const [
    tasteStatus,
    setTasteStatus,
  ] =
    useState<
      StandardValue
    >(
      ""
    );

  const [
    textureStatus,
    setTextureStatus,
  ] =
    useState<
      StandardValue
    >(
      ""
    );

  const [
    notes,
    setNotes,
  ] =
    useState(
      ""
    );

  const [
    submitting,
    setSubmitting,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(
      null
    );


  const stillIssue =
    colorStatus ===
      "NOT_STANDARD" ||
    tasteStatus ===
      "NOT_STANDARD" ||
    textureStatus ===
      "NOT_STANDARD";


  const complete =
    Boolean(
      correctionNote.trim()
    ) &&
    Boolean(
      colorStatus
    ) &&
    Boolean(
      tasteStatus
    ) &&
    Boolean(
      textureStatus
    ) &&
    (
      !stillIssue ||
      Boolean(
        notes.trim()
      )
    );


  async function submit() {
    if (
      !complete ||
      submitting
    ) {
      return;
    }

    setSubmitting(
      true
    );

    setError(
      null
    );

    try {
      const response =
        await fetch(
          "/api/test-food/retest",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                check_id:
                  checkId,

                correction_note:
                  correctionNote,

                color_status:
                  colorStatus,

                taste_status:
                  tasteStatus,

                texture_status:
                  textureStatus,

                notes:
                  notes.trim() ||
                  null,
              }),
          }
        );


      const payload =
        await response.json();


      if (
        !response.ok
      ) {
        throw new Error(
          payload?.error ||
          "Unable to submit Re-Test."
        );
      }


      window.location.reload();

    } catch (
      submitError: any
    ) {
      setError(
        submitError
          ?.message ||
        "Unable to submit Re-Test."
      );

    } finally {
      setSubmitting(
        false
      );
    }
  }


  if (!open) {
    return (
      <button
        type="button"
        onClick={() =>
          setOpen(
            true
          )
        }
        className="mt-4 inline-flex h-11 items-center justify-center rounded-2xl bg-[#292824] px-5 text-sm font-black text-white"
      >
        Start Correction / Re-Test
      </button>
    );
  }


  return (
    <div className="mt-5 rounded-[22px] border border-amber-200 bg-amber-50/40 p-4 sm:p-5">

      <div>
        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-amber-700">
          Correction / Re-Test
        </p>

        <h4 className="mt-1 font-black text-[#292824]">
          {menuName}
        </h4>
      </div>


      <div className="mt-4">
        <label className="block">
          <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.13em] text-neutral-500">
            Correction Note
          </span>

          <textarea
            rows={
              2
            }
            value={
              correctionNote
            }
            onChange={
              (
                event
              ) =>
                setCorrectionNote(
                  event.target.value
                )
            }
            placeholder="Contoh: Batch diganti dan product dibuat ulang sesuai standard."
            className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm font-medium text-neutral-800 outline-none focus:border-neutral-500"
          />
        </label>
      </div>


      <div className="mt-4 grid gap-3 sm:grid-cols-3">

        <RetestSelect
          label="Warna"
          value={
            colorStatus
          }
          onChange={
            setColorStatus
          }
        />

        <RetestSelect
          label="Rasa"
          value={
            tasteStatus
          }
          onChange={
            setTasteStatus
          }
        />

        <RetestSelect
          label="Tekstur"
          value={
            textureStatus
          }
          onChange={
            setTextureStatus
          }
        />

      </div>


      {stillIssue && (
        <div className="mt-4">
          <label className="block">
            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.13em] text-red-600">
              Notes · Required
            </span>

            <textarea
              rows={
                2
              }
              value={
                notes
              }
              onChange={
                (
                  event
                ) =>
                  setNotes(
                    event.target.value
                  )
              }
              placeholder="Jelaskan hasil Re-Test yang masih Not Standard."
              className="w-full resize-none rounded-xl border border-red-200 bg-white px-3 py-3 text-sm font-medium text-neutral-800 outline-none focus:border-red-400"
            />
          </label>
        </div>
      )}


      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700">
          {error}
        </div>
      )}


      <div className="mt-5 flex flex-col gap-2 sm:flex-row">

        <button
          type="button"
          disabled={
            !complete ||
            submitting
          }
          onClick={
            submit
          }
          className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#292824] px-5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
        >
          {submitting
            ? "Submitting..."
            : "Submit Re-Test"}
        </button>


        <button
          type="button"
          disabled={
            submitting
          }
          onClick={() =>
            setOpen(
              false
            )
          }
          className="inline-flex h-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white px-5 text-sm font-black text-neutral-600"
        >
          Cancel
        </button>

      </div>

    </div>
  );
}


function RetestSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value:
    StandardValue;
  onChange:
    (
      value:
        StandardValue
    ) => void;
}) {
  return (
    <label className="block">

      <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.13em] text-neutral-500">
        {label}
      </span>

      <select
        value={
          value
        }
        onChange={
          (
            event
          ) =>
            onChange(
              event
                .target
                .value as
                StandardValue
            )
        }
        className={[
          "h-11 w-full rounded-xl border bg-white px-3 text-sm font-bold outline-none",
          value ===
          "NOT_STANDARD"
            ? "border-red-300 text-red-700"
            : "border-neutral-200 text-neutral-800",
        ].join(
          " "
        )}
      >
        <option value="">
          Select
        </option>

        <option value="STANDARD">
          Standard
        </option>

        <option value="NOT_STANDARD">
          Not Standard
        </option>
      </select>

    </label>
  );
}
