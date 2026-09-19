import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  getActiveOutlet,
} from "@/lib/active-outlet";


function businessDate(
  timezone: string
) {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        timezone ||
        "Asia/Jakarta",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",
    }
  ).format(
    new Date()
  );
}


function displayDate(
  value: string
) {
  const [
    year,
    month,
    day,
  ] =
    value.split(
      "-"
    );

  return `${day}/${month}/${year}`;
}


const ORDER:
  Record<
    string,
    number
  > = {
    MORNING:
      0,

    AFTERNOON:
      1,

    CLOSING:
      2,
  };


export default async function BriefingReportPage() {
  const supabase =
    await createClient();


  const {
    data: {
      user,
    },
  } =
    await supabase.auth.getUser();


  if (!user) {
    redirect(
      "/auth/login"
    );
  }


  const outlet =
    await getActiveOutlet();


  if (!outlet) {
    redirect(
      "/protected/select-outlet"
    );
  }


  const admin =
    createAdminClient();


  const [
    outletResult,
    assignmentResult,
  ] =
    await Promise.all([
      admin
        .from(
          "outlets"
        )
        .select(`
          id,
          code,
          name,
          timezone
        `)
        .eq(
          "id",
          outlet.id
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle(),

      admin
        .from(
          "user_outlets"
        )
        .select(`
          outlet_id
        `)
        .eq(
          "user_id",
          user.id
        )
        .eq(
          "outlet_id",
          outlet.id
        )
        .eq(
          "is_active",
          true
        )
        .maybeSingle(),
    ]);


  const outletRow =
    outletResult.data;


  if (
    !outletRow ||
    !assignmentResult.data
  ) {
    redirect(
      "/protected"
    );
  }


  if (
    String(
      outletRow.code
    )
      .trim()
      .toUpperCase() ===
    "CNT"
  ) {
    redirect(
      "/protected"
    );
  }


  const date =
    businessDate(
      outletRow.timezone ||
      "Asia/Jakarta"
    );


  const {
    data:
      sessions,
    error,
  } =
    await admin
      .from(
        "briefing_sessions"
      )
      .select(`
        id,
        business_date,
        session_type,
        title,
        notes,
        sections,
        photo_storage_path,
        pic_name_snapshot,
        submitted_at
      `)
      .eq(
        "outlet_id",
        outletRow.id
      )
      .eq(
        "business_date",
        date
      )
      .eq(
        "status",
        "SUBMITTED"
      );


  if (error) {
    throw error;
  }


  const ordered =
    [...(
      sessions ??
      []
    )].sort(
      (
        a: any,
        b: any
      ) =>
        (
          ORDER[
            a.session_type
          ] ??
          99
        ) -
        (
          ORDER[
            b.session_type
          ] ??
          99
        )
    );


  const rows =
    await Promise.all(
      ordered.map(
        async (
          session: any
        ) => {
          const {
            data:
              signed,
          } =
            await admin.storage
              .from(
                "operational-photos"
              )
              .createSignedUrl(
                session
                  .photo_storage_path,
                3600
              );


          return {
            ...session,

            photoUrl:
              signed
                ?.signedUrl ||
              null,
          };
        }
      )
    );


  return (
    <main className="min-h-screen bg-[#F6F4F1] px-4 py-7 sm:px-6 md:py-10">

      <div className="mx-auto max-w-6xl">

        <section className="rounded-[30px] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">

          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
            Daily Outlet Operations
          </p>


          <div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

            <div>
              <h1 className="text-3xl font-black tracking-tight text-[#292824]">
                Briefing Report
              </h1>

              <p className="mt-2 text-sm text-neutral-500">
                {outletRow.name}
                {" · "}
                {displayDate(
                  date
                )}
              </p>
            </div>


            <div className="rounded-full border border-neutral-200 bg-[#F6F4F1] px-4 py-2 text-xs font-black text-neutral-600">
              {rows.length}/3 sessions
            </div>

          </div>

        </section>


        <div className="mt-5 space-y-5">

          {rows.map(
            (
              session: any
            ) => {
              const customSections =
                Array.isArray(
                  session.sections
                )
                  ? session.sections
                  : [];


              return (
                <section
                  key={
                    session.id
                  }
                  className="overflow-hidden rounded-[30px] border border-neutral-200 bg-white shadow-sm"
                >

                  <div className="border-b border-neutral-100 p-5 sm:p-6">

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-neutral-400">
                          {
                            session.session_type
                          }
                        </p>

                        <h2 className="mt-1 text-xl font-black text-[#292824]">
                          {
                            session.title ||
                            `${session.session_type} Briefing`
                          }
                        </h2>

                        <p className="mt-1 text-xs text-neutral-500">
                          PIC {
                            session.pic_name_snapshot
                          }
                        </p>
                      </div>


                      <span className="w-fit rounded-full bg-emerald-50 px-3 py-1.5 text-[9px] font-black text-emerald-700">
                        SUBMITTED
                      </span>

                    </div>

                  </div>


                  {session.photoUrl && (
                    <div className="bg-neutral-100">

                      <img
                        src={
                          session.photoUrl
                        }
                        alt={`${session.session_type} briefing`}
                        className="max-h-[640px] w-full object-contain"
                      />

                    </div>
                  )}


                  <div className="p-5 sm:p-6">

                    {session.notes && (
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
                          Notes
                        </p>

                        <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-neutral-700">
                          {
                            session.notes
                          }
                        </p>
                      </div>
                    )}


                    {customSections.length >
                      0 && (
                      <div className={[
                        session.notes
                          ? "mt-6 border-t border-neutral-100 pt-6"
                          : "",
                        "grid gap-3",
                      ].join(
                        " "
                      )}>

                        {customSections.map(
                          (
                            section: any,
                            index: number
                          ) => (
                            <article
                              key={
                                index
                              }
                              className="rounded-[20px] border border-neutral-200 bg-[#F6F4F1]/60 p-4"
                            >

                              <p className="font-black text-[#292824]">
                                {
                                  section.title
                                }
                              </p>

                              <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-neutral-700">
                                {
                                  section.content
                                }
                              </p>

                            </article>
                          )
                        )}

                      </div>
                    )}


                    {!session.notes &&
                     customSections.length ===
                     0 && (
                      <p className="text-sm font-medium text-neutral-400">
                        No additional briefing notes.
                      </p>
                    )}

                  </div>

                </section>
              );
            }
          )}


          {rows.length ===
            0 && (
            <section className="rounded-[28px] border border-neutral-200 bg-white p-8 text-center shadow-sm">

              <p className="text-sm font-bold text-neutral-500">
                No Briefing submitted today.
              </p>

            </section>
          )}

        </div>


        <div className="mt-6 flex gap-2">

          <a
            href="/protected/briefing"
            className="inline-flex h-11 items-center justify-center rounded-2xl border border-neutral-200 bg-white px-5 text-sm font-black text-[#292824]"
          >
            Briefing
          </a>


          <a
            href="/protected"
            className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#292824] px-5 text-sm font-black text-white"
          >
            Dashboard
          </a>

        </div>

      </div>

    </main>
  );
}
