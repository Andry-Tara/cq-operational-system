"use client";

import {
  useMemo,
  useRef,
  useState,
} from "react";


type SessionType =
  | ""
  | "MORNING"
  | "AFTERNOON"
  | "CLOSING";


type SectionRow = {
  id: string;
  title: string;
  content: string;
};


type SubmittedSession = {
  id: string;
  session_type: string;
  title: string | null;
  submitted_at: string;
};


const SESSION_OPTIONS = [
  "MORNING",
  "AFTERNOON",
  "CLOSING",
] as const;


function makeSection():
  SectionRow {
  return {
    id:
      crypto.randomUUID(),

    title:
      "",

    content:
      "",
  };
}


function formatOutletStamp(
  date: Date,
  timezone: string
) {
  try {
    return new Intl.DateTimeFormat(
      "id-ID",
      {
        timeZone:
          timezone ||
          "Asia/Jakarta",

        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          false,

        timeZoneName:
          "short",
      }
    )
      .format(
        date
      )
      .replace(
        /\./g,
        ":"
      );

  } catch {
    return new Intl.DateTimeFormat(
      "id-ID",
      {
        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          false,
      }
    )
      .format(
        date
      )
      .replace(
        /\./g,
        ":"
      );
  }
}


async function prepareBriefingPhoto(
  file: File,
  {
    outletName,
    sessionType,
    timezone,
  }: {
    outletName: string;
    sessionType: string;
    timezone: string;
  }
): Promise<File> {
  if (
    !file.type.startsWith(
      "image/"
    )
  ) {
    return file;
  }


  try {
    const url =
      URL.createObjectURL(
        file
      );


    const image =
      new Image();


    await new Promise<void>(
      (
        resolve,
        reject
      ) => {
        image.onload =
          () =>
            resolve();

        image.onerror =
          () =>
            reject(
              new Error(
                "Unable to read image."
              )
            );

        image.src =
          url;
      }
    );


    const maxDimension =
      1600;


    const scale =
      Math.min(
        1,
        maxDimension /
          Math.max(
            image.width,
            image.height
          )
      );


    const width =
      Math.max(
        1,
        Math.round(
          image.width *
          scale
        )
      );


    const imageHeight =
      Math.max(
        1,
        Math.round(
          image.height *
          scale
        )
      );


    /*
     * Add a NEW strip underneath the photo.
     *
     * We intentionally do not overlay or crop the original
     * image so an existing camera/GPS timestamp remains visible.
     */
    const stampHeight =
      Math.max(
        74,
        Math.min(
          110,
          Math.round(
            width *
            0.075
          )
        )
      );


    const canvas =
      document.createElement(
        "canvas"
      );


    canvas.width =
      width;

    canvas.height =
      imageHeight +
      stampHeight;


    const context =
      canvas.getContext(
        "2d"
      );


    if (!context) {
      URL.revokeObjectURL(
        url
      );

      return file;
    }


    context.drawImage(
      image,
      0,
      0,
      width,
      imageHeight
    );


    /*
     * System verification strip.
     */
    context.fillStyle =
      "rgba(30, 29, 26, 0.96)";

    context.fillRect(
      0,
      imageHeight,
      width,
      stampHeight
    );


    const horizontalPadding =
      Math.max(
        18,
        Math.round(
          width *
          0.025
        )
      );


    const primarySize =
      Math.max(
        14,
        Math.min(
          24,
          Math.round(
            width *
            0.022
          )
        )
      );


    const secondarySize =
      Math.max(
        11,
        Math.min(
          18,
          Math.round(
            width *
            0.017
          )
        )
      );


    const stampTime =
      formatOutletStamp(
        new Date(),
        timezone
      );


    const line1 =
      `${outletName} · ${sessionType} BRIEFING`;


    const line2 =
      `Submitted ${stampTime}`;


    context.textBaseline =
      "top";


    context.fillStyle =
      "rgba(255, 255, 255, 0.98)";


    context.font =
      `700 ${primarySize}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;


    context.fillText(
      line1,
      horizontalPadding,
      imageHeight +
        Math.max(
          12,
          stampHeight *
            0.18
        )
    );


    context.fillStyle =
      "rgba(255, 255, 255, 0.72)";


    context.font =
      `600 ${secondarySize}px system-ui, -apple-system, BlinkMacSystemFont, sans-serif`;


    context.fillText(
      line2,
      horizontalPadding,
      imageHeight +
        Math.max(
          40,
          stampHeight *
            0.58
        )
    );


    const blob =
      await new Promise<
        Blob |
        null
      >(
        (
          resolve
        ) =>
          canvas.toBlob(
            resolve,
            "image/jpeg",
            0.82
          )
      );


    URL.revokeObjectURL(
      url
    );


    if (!blob) {
      return file;
    }


    const baseName =
      file.name
        .replace(
          /\.[^.]+$/,
          ""
        )
        .replace(
          /[^a-zA-Z0-9_-]+/g,
          "-"
        )
        .slice(
          0,
          80
        ) ||
      "briefing";


    return new File(
      [
        blob,
      ],
      `${baseName}-briefing.jpg`,
      {
        type:
          "image/jpeg",

        lastModified:
          Date.now(),
      }
    );

  } catch {
    /*
     * Some gallery formats may not be decodable by canvas.
     * Keep the original instead of blocking the submission.
     */
    return file;
  }
}


export default function BriefingClient({
  outletName,
  businessDate,
  outletTimezone,
  picName,
  submittedSessions,
}: {
  outletName: string;
  businessDate: string;
  outletTimezone: string;
  picName: string;
  submittedSessions:
    SubmittedSession[];
}) {
  const [
    sessionType,
    setSessionType,
  ] =
    useState<
      SessionType
    >(
      () => {
        const completed =
          new Set(
            submittedSessions.map(
              (
                item
              ) =>
                item.session_type
            )
          );

        const next =
          SESSION_OPTIONS.find(
            (
              option
            ) =>
              !completed.has(
                option
              )
          );

        return (
          next ||
          ""
        );
      }
    );


  const [
    title,
    setTitle,
  ] =
    useState(
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
    sections,
    setSections,
  ] =
    useState<
      SectionRow[]
    >(
      []
    );


  const [
    photo,
    setPhoto,
  ] =
    useState<
      File |
      null
    >(
      null
    );


  const [
    previewUrl,
    setPreviewUrl,
  ] =
    useState<
      string |
      null
    >(
      null
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
      string |
      null
    >(
      null
    );


  const [
    success,
    setSuccess,
  ] =
    useState<any>(
      null
    );


  const cameraInputRef =
    useRef<
      HTMLInputElement |
      null
    >(
      null
    );


  const galleryInputRef =
    useRef<
      HTMLInputElement |
      null
    >(
      null
    );


  const completedSet =
    useMemo(
      () =>
        new Set(
          submittedSessions.map(
            (
              item
            ) =>
              item.session_type
          )
        ),
      [
        submittedSessions,
      ]
    );


  const completedAfterSuccess =
    success
      ? new Set([
          ...submittedSessions.map(
            (
              item
            ) =>
              item.session_type
          ),
          success.session_type,
        ]).size
      : completedSet.size;


  const sectionsValid =
    sections.every(
      (
        section
      ) =>
        Boolean(
          section.title.trim()
        ) &&
        Boolean(
          section.content.trim()
        )
    );


  const canSubmit =
    Boolean(
      sessionType
    ) &&
    Boolean(
      photo
    ) &&
    sectionsValid &&
    !completedSet.has(
      sessionType
    );


  function selectPhoto(
    file:
      File |
      null
  ) {
    setError(
      null
    );


    if (
      previewUrl
    ) {
      URL.revokeObjectURL(
        previewUrl
      );
    }


    if (!file) {
      setPhoto(
        null
      );

      setPreviewUrl(
        null
      );

      return;
    }


    setPhoto(
      file
    );


    setPreviewUrl(
      URL.createObjectURL(
        file
      )
    );
  }


  function addSection() {
    setSections(
      (
        current
      ) => [
        ...current,
        makeSection(),
      ]
    );
  }


  function removeSection(
    id: string
  ) {
    setSections(
      (
        current
      ) =>
        current.filter(
          (
            item
          ) =>
            item.id !==
            id
        )
    );
  }


  function updateSection(
    id: string,
    patch:
      Partial<SectionRow>
  ) {
    setSections(
      (
        current
      ) =>
        current.map(
          (
            item
          ) =>
            item.id ===
            id
              ? {
                  ...item,
                  ...patch,
                }
              : item
        )
    );
  }


  async function submit() {
    if (
      !canSubmit ||
      !sessionType ||
      !photo ||
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
      const optimized =
        await prepareBriefingPhoto(
          photo,
          {
            outletName,
            sessionType,
            timezone:
              outletTimezone,
          }
        );


      const formData =
        new FormData();


      formData.append(
        "session_type",
        sessionType
      );


      formData.append(
        "title",
        title.trim()
      );


      formData.append(
        "notes",
        notes.trim()
      );


      formData.append(
        "sections",
        JSON.stringify(
          sections.map(
            (
              section
            ) => ({
              title:
                section.title.trim(),

              content:
                section.content.trim(),
            })
          )
        )
      );


      formData.append(
        "photo",
        optimized
      );


      const response =
        await fetch(
          "/api/briefing/submit",
          {
            method:
              "POST",

            body:
              formData,
          }
        );


      const payload =
        await response.json();


      if (
        !response.ok
      ) {
        throw new Error(
          payload?.error ||
          "Unable to submit Briefing."
        );
      }


      setSuccess(
        payload.briefing
      );


    } catch (
      submitError: any
    ) {
      setError(
        submitError
          ?.message ||
        "Unable to submit Briefing."
      );

    } finally {
      setSubmitting(
        false
      );
    }
  }


  if (
    success
  ) {
    const allDone =
      completedAfterSuccess >=
      3;


    return (
      <main className="min-h-screen bg-[#F6F4F1] px-4 py-8 sm:px-6">

        <div className="mx-auto max-w-2xl">

          <section className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">

            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
              Briefing Submitted
            </p>


            <h1 className="mt-3 text-3xl font-black text-[#292824]">
              {success.session_type}
            </h1>


            <p className="mt-2 text-sm text-neutral-500">
              {outletName}
              {" · "}
              {completedAfterSuccess}/3 sessions
            </p>


            <div className="mt-7 flex flex-col gap-2 sm:flex-row">

              {allDone && (
                <a
                  href="/protected/briefing/report"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#292824] px-6 text-sm font-black text-white"
                >
                  View Daily Report
                </a>
              )}


              {!allDone && (
                <a
                  href="/protected/briefing"
                  className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#292824] px-6 text-sm font-black text-white"
                >
                  Continue Briefing
                </a>
              )}


              <a
                href="/protected"
                className="inline-flex h-12 items-center justify-center rounded-2xl border border-neutral-200 bg-white px-6 text-sm font-black text-[#292824]"
              >
                Dashboard
              </a>

            </div>

          </section>

        </div>

      </main>
    );
  }


  return (
    <main className="min-h-screen bg-[#F6F4F1] px-3 py-6 sm:px-6 sm:py-8">

      <div className="mx-auto max-w-5xl">

        <section className="rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">

          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                Daily Outlet Operations
              </p>

              <h1 className="mt-2 text-3xl font-black tracking-tight text-[#292824]">
                Briefing
              </h1>

              <p className="mt-2 text-sm text-neutral-500">
                {outletName}
                {" · "}
                {businessDate}
                {" · "}
                PIC {picName}
              </p>
            </div>


            <div className="rounded-full bg-[#F6F4F1] px-4 py-2 text-xs font-black text-neutral-600">
              {completedSet.size}/3 completed
            </div>

          </div>


          <div className="mt-6 grid grid-cols-3 gap-2">

            {SESSION_OPTIONS.map(
              (
                option
              ) => {
                const done =
                  completedSet.has(
                    option
                  );


                return (
                  <button
                    key={
                      option
                    }
                    type="button"
                    disabled={
                      done
                    }
                    onClick={() => {
                      setSessionType(
                        option
                      );

                      setError(
                        null
                      );
                    }}
                    className={[
                      "min-h-[52px] rounded-2xl border px-3 py-3 text-xs font-black transition sm:text-sm",
                      sessionType ===
                      option
                        ? "border-[#292824] bg-[#292824] text-white"
                        : "border-neutral-200 bg-white text-neutral-700",
                      done
                        ? "cursor-not-allowed bg-neutral-50 text-neutral-400 opacity-70"
                        : "",
                    ].join(
                      " "
                    )}
                  >
                    {option}

                    {done && (
                      <span className="ml-1">
                        ✓
                      </span>
                    )}
                  </button>
                );
              }
            )}

          </div>

        </section>


        <section className="mt-4 rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">

          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
              Briefing Evidence
            </p>

            <h2 className="mt-1 text-xl font-black text-[#292824]">
              Photo
              <span className="ml-1 text-red-600">
                *
              </span>
            </h2>
          </div>


          <input
            ref={
              cameraInputRef
            }
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={
              (
                event
              ) =>
                selectPhoto(
                  event.target
                    .files?.[0] ||
                  null
                )
            }
          />


          <input
            ref={
              galleryInputRef
            }
            type="file"
            accept="image/*"
            className="hidden"
            onChange={
              (
                event
              ) =>
                selectPhoto(
                  event.target
                    .files?.[0] ||
                  null
                )
            }
          />


          {!previewUrl ? (
            <div className="mt-4">

              <div className="grid grid-cols-2 gap-2 sm:gap-3">

                <button
                  type="button"
                  onClick={() => {
                    const input =
                      cameraInputRef.current;

                    if (!input) {
                      return;
                    }

                    input.value =
                      "";

                    input.click();
                  }}
                  className="flex min-h-[92px] items-center gap-3 rounded-[18px] border border-neutral-200 bg-white px-3.5 py-3 text-left transition hover:border-neutral-400 sm:px-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#292824] text-white">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4 8.5h3l1.5-2h7l1.5 2h3v9.5H4V8.5Z"
                      />
                      <circle
                        cx="12"
                        cy="13"
                        r="3"
                      />
                    </svg>
                  </span>

                  <span className="min-w-0">
                    <span className="block text-sm font-black text-[#292824]">
                      Take Photo
                    </span>

                    <span className="mt-0.5 block text-[11px] leading-4 text-neutral-500">
                      Open camera
                    </span>
                  </span>
                </button>


                <button
                  type="button"
                  onClick={() => {
                    const input =
                      galleryInputRef.current;

                    if (!input) {
                      return;
                    }

                    input.value =
                      "";

                    input.click();
                  }}
                  className="flex min-h-[92px] items-center gap-3 rounded-[18px] border border-neutral-200 bg-white px-3.5 py-3 text-left transition hover:border-neutral-400 sm:px-4"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F6F4F1] text-neutral-700">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-5 w-5"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <rect
                        x="4"
                        y="5"
                        width="16"
                        height="14"
                        rx="2"
                      />
                      <circle
                        cx="9"
                        cy="10"
                        r="1.5"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m6.5 17 4-4 2.5 2.5 2-2 2.5 3.5"
                      />
                    </svg>
                  </span>

                  <span className="min-w-0">
                    <span className="block text-sm font-black text-[#292824]">
                      Gallery
                    </span>

                    <span className="mt-0.5 block text-[11px] leading-4 text-neutral-500">
                      Choose saved photo
                    </span>
                  </span>
                </button>

              </div>


              <div className="mt-2 flex flex-col gap-1 rounded-xl border border-neutral-200 bg-[#F6F4F1]/55 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">

                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-neutral-400">
                  System Stamp
                </p>

                <p className="text-[10px] font-bold text-neutral-500">
                  Outlet · Session · Submit Time
                </p>

              </div>

            </div>
          ) : (
            <div className="mt-4 overflow-hidden rounded-[24px] border border-neutral-200">

              <img
                src={
                  previewUrl
                }
                alt="Briefing preview"
                className="max-h-[460px] w-full bg-neutral-100 object-contain"
              />

              <div className="flex items-center justify-between gap-3 bg-white p-4">

                <p className="min-w-0 truncate text-xs font-bold text-neutral-600">
                  {photo?.name}
                </p>

                <div className="flex shrink-0 gap-3">

                  <button
                    type="button"
                    onClick={() => {
                      const input =
                        cameraInputRef.current;

                      if (!input) {
                        return;
                      }

                      input.value =
                        "";

                      input.click();
                    }}
                    className="text-xs font-black text-neutral-700"
                  >
                    Retake
                  </button>


                  <button
                    type="button"
                    onClick={() => {
                      const input =
                        galleryInputRef.current;

                      if (!input) {
                        return;
                      }

                      input.value =
                        "";

                      input.click();
                    }}
                    className="text-xs font-black text-red-700"
                  >
                    Gallery
                  </button>

                </div>

              </div>

            </div>
          )}


          {previewUrl && (
            <div className="mt-3 rounded-2xl border border-neutral-200 bg-[#F6F4F1]/60 px-4 py-3">

              <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
                Automatic System Stamp
              </p>

              <p className="mt-1 text-xs font-bold text-neutral-600">
                {outletName}
                {" · "}
                {sessionType || "SELECT SESSION"}
              </p>

              <p className="mt-1 text-[11px] leading-5 text-neutral-500">
                The original photo is not cropped. A submission-time strip will be added underneath the image when submitted.
              </p>

            </div>
          )}

        </section>


        <section className="mt-4 rounded-[30px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">

          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
            Briefing Content
          </p>


          <div className="mt-5 grid gap-5">

            <label className="block">

              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.13em] text-neutral-400">
                Briefing Title · Optional
              </span>

              <input
                value={
                  title
                }
                onChange={
                  (
                    event
                  ) =>
                    setTitle(
                      event.target.value
                    )
                }
                placeholder="Example: Lunch Rush Focus"
                maxLength={
                  250
                }
                className="h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold text-[#292824] outline-none focus:border-neutral-500"
              />

            </label>


            <label className="block">

              <span className="mb-2 block text-[10px] font-black uppercase tracking-[0.13em] text-neutral-400">
                Main Notes · Optional
              </span>

              <textarea
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
                placeholder="General briefing notes..."
                rows={
                  4
                }
                maxLength={
                  10000
                }
                className="w-full resize-none rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-[#292824] outline-none focus:border-neutral-500"
              />

            </label>

          </div>


          <div className="mt-7 flex items-center justify-between gap-3 border-t border-neutral-100 pt-5">

            <div>
              <p className="text-sm font-black text-[#292824]">
                Custom Sections
              </p>

              <p className="mt-1 text-xs text-neutral-500">
                Optional · Add only when needed
              </p>
            </div>


            <button
              type="button"
              onClick={
                addSection
              }
              className="inline-flex h-10 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-xs font-black text-[#292824]"
            >
              + Add Section
            </button>

          </div>


          <div className="mt-4 space-y-3">

            {sections.map(
              (
                section,
                index
              ) => (
                <article
                  key={
                    section.id
                  }
                  className="rounded-[22px] border border-neutral-200 bg-[#F6F4F1]/50 p-4"
                >

                  <div className="flex items-center justify-between gap-3">

                    <p className="text-xs font-black text-neutral-500">
                      Section {
                        index + 1
                      }
                    </p>


                    <button
                      type="button"
                      onClick={() =>
                        removeSection(
                          section.id
                        )
                      }
                      className="text-xs font-black text-red-700"
                    >
                      Remove
                    </button>

                  </div>


                  <div className="mt-3 grid gap-3">

                    <input
                      value={
                        section.title
                      }
                      onChange={
                        (
                          event
                        ) =>
                          updateSection(
                            section.id,
                            {
                              title:
                                event
                                  .target
                                  .value,
                            }
                          )
                      }
                      placeholder="Section title, e.g. Upselling"
                      className="h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm font-bold text-[#292824] outline-none focus:border-neutral-500"
                    />


                    <textarea
                      value={
                        section.content
                      }
                      onChange={
                        (
                          event
                        ) =>
                          updateSection(
                            section.id,
                            {
                              content:
                                event
                                  .target
                                  .value,
                            }
                          )
                      }
                      placeholder="Section content..."
                      rows={
                        3
                      }
                      className="w-full resize-none rounded-xl border border-neutral-200 bg-white px-3 py-3 text-sm font-medium leading-6 text-[#292824] outline-none focus:border-neutral-500"
                    />

                  </div>

                </article>
              )
            )}

          </div>


          {error && (
            <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}


          <div className="mt-7 flex flex-col gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:items-center sm:justify-between">

            <p className="text-xs leading-5 text-neutral-500">
              Photo is required. Title, notes, and custom sections are optional.
            </p>


            <button
              type="button"
              disabled={
                !canSubmit ||
                submitting
              }
              onClick={
                submit
              }
              className="inline-flex h-12 min-w-[180px] items-center justify-center rounded-2xl bg-[#292824] px-6 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
            >
              {submitting
                ? "Submitting..."
                : "Submit Briefing"}
            </button>

          </div>

        </section>

      </div>

    </main>
  );
}
