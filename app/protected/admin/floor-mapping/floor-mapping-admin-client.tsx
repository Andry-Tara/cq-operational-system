"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";


type Outlet = {
  id: string;
  code: string;
  name: string;
};


type Template = {
  id: string;
  name: string;
  version_number: number;
  image_storage_path: string;
  is_active: boolean;
  created_at: string;
};


type Zone = {
  id: string;
  zone_code: string;
  zone_name: string;
  zone_type: string;
  x_pct: number | string;
  y_pct: number | string;
  shape: string;
  display_label:
    string |
    null;
  capacity:
    number |
    null;
};


type BohPosition = {
  id: string;
  position_code: string;
  position_name: string;
  default_station:
    string |
    null;
};


const ZONE_TYPES = [
  "TABLE",
  "VIP",
  "FLOOR",
  "SERVER",
  "LEADER",
  "RUNNER",
  "CHECKER",
  "CASHIER",
  "HOST",
  "GRO",
  "TA_HK",
  "MOD",
  "SERVICE_AREA",
  "OTHER",
];


function markerClass(
  type: string
) {
  if (
    type ===
    "TABLE"
  ) {
    return "bg-emerald-600 text-white";
  }


  if (
    type ===
    "VIP"
  ) {
    return "bg-sky-500 text-white";
  }


  if (
    type ===
    "LEADER" ||
    type ===
    "MOD"
  ) {
    return "bg-teal-600 text-white";
  }


  if (
    type ===
    "CASHIER" ||
    type ===
    "HOST"
  ) {
    return "bg-orange-500 text-white";
  }


  if (
    type ===
    "GRO"
  ) {
    return "bg-violet-600 text-white";
  }


  return "bg-blue-600 text-white";
}


export default function FloorMappingAdminClient({
  outlets,
}: {
  outlets:
    Outlet[];
}) {
  const [
    outletId,
    setOutletId,
  ] =
    useState(
      outlets[0]
        ?.id ||
      ""
    );


  const [
    templates,
    setTemplates,
  ] =
    useState<
      Template[]
    >(
      []
    );


  const [
    selectedTemplate,
    setSelectedTemplate,
  ] =
    useState<
      Template |
      null
    >(
      null
    );


  const [
    imageUrl,
    setImageUrl,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    zones,
    setZones,
  ] =
    useState<
      Zone[]
    >(
      []
    );


  const [
    bohPositions,
    setBohPositions,
  ] =
    useState<
      BohPosition[]
    >(
      []
    );


  const [
    loading,
    setLoading,
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
    templateName,
    setTemplateName,
  ] =
    useState(
      ""
    );


  const [
    image,
    setImage,
  ] =
    useState<
      File |
      null
    >(
      null
    );


  const [
    uploading,
    setUploading,
  ] =
    useState(
      false
    );


  const [
    pendingPoint,
    setPendingPoint,
  ] =
    useState<{
      x: number;
      y: number;
    } | null>(
      null
    );


  const [
    markerCode,
    setMarkerCode,
  ] =
    useState(
      ""
    );


  const [
    markerName,
    setMarkerName,
  ] =
    useState(
      ""
    );


  const [
    markerType,
    setMarkerType,
  ] =
    useState(
      "TABLE"
    );


  const [
    capacity,
    setCapacity,
  ] =
    useState(
      ""
    );


  const [
    savingMarker,
    setSavingMarker,
  ] =
    useState(
      false
    );


  const outlet =
    useMemo(
      () =>
        outlets.find(
          (
            item
          ) =>
            item.id ===
            outletId
        ) ||
        null,
      [
        outlets,
        outletId,
      ]
    );


  async function load(
    templateId?: string
  ) {
    if (!outletId) {
      return;
    }


    setLoading(
      true
    );

    setError(
      null
    );


    try {
      const params =
        new URLSearchParams({
          outlet_id:
            outletId,
        });


      if (templateId) {
        params.set(
          "template_id",
          templateId
        );
      }


      const response =
        await fetch(
          `/api/admin/floor-mapping/templates?${params.toString()}`,
          {
            cache:
              "no-store",
          }
        );


      const payload =
        await response.json();


      if (!response.ok) {
        throw new Error(
          payload?.error ||
          "Unable to load Floor Mapping."
        );
      }


      setTemplates(
        payload.templates ||
        []
      );


      setSelectedTemplate(
        payload.selectedTemplate ||
        null
      );


      setImageUrl(
        payload.imageUrl ||
        null
      );


      setZones(
        payload.zones ||
        []
      );


      setBohPositions(
        payload.bohPositions ||
        []
      );


      setPendingPoint(
        null
      );

    } catch (
      loadError: any
    ) {
      setError(
        loadError
          ?.message ||
        "Unable to load Floor Mapping."
      );

    } finally {
      setLoading(
        false
      );
    }
  }


  useEffect(
    () => {
      if (outletId) {
        void load();
      }
    },
    [
      outletId,
    ]
  );


  async function uploadTemplate() {
    if (
      !outletId ||
      !templateName.trim() ||
      !image ||
      uploading
    ) {
      return;
    }


    setUploading(
      true
    );

    setError(
      null
    );


    try {
      const form =
        new FormData();


      form.append(
        "outlet_id",
        outletId
      );


      form.append(
        "name",
        templateName.trim()
      );


      form.append(
        "activate",
        "true"
      );


      form.append(
        "image",
        image
      );


      const response =
        await fetch(
          "/api/admin/floor-mapping/templates",
          {
            method:
              "POST",

            body:
              form,
          }
        );


      const payload =
        await response.json();


      if (!response.ok) {
        throw new Error(
          payload?.error ||
          "Unable to upload floor plan."
        );
      }


      setTemplateName(
        ""
      );


      setImage(
        null
      );


      await load(
        payload.template.id
      );

    } catch (
      uploadError: any
    ) {
      setError(
        uploadError
          ?.message ||
        "Unable to upload floor plan."
      );

    } finally {
      setUploading(
        false
      );
    }
  }


  async function activateTemplate(
    id: string
  ) {
    setError(
      null
    );


    const response =
      await fetch(
        "/api/admin/floor-mapping/templates",
        {
          method:
            "PATCH",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              template_id:
                id,
            }),
        }
      );


    const payload =
      await response.json();


    if (!response.ok) {
      setError(
        payload?.error ||
        "Unable to activate template."
      );

      return;
    }


    await load(
      id
    );
  }


  function mapClick(
    event:
      React.MouseEvent<
        HTMLDivElement
      >
  ) {
    if (
      !selectedTemplate ||
      !imageUrl
    ) {
      return;
    }


    const rect =
      event.currentTarget
        .getBoundingClientRect();


    const x =
      (
        (
          event.clientX -
          rect.left
        ) /
        rect.width
      ) *
      100;


    const y =
      (
        (
          event.clientY -
          rect.top
        ) /
        rect.height
      ) *
      100;


    setPendingPoint({
      x:
        Number(
          x.toFixed(
            3
          )
        ),

      y:
        Number(
          y.toFixed(
            3
          )
        ),
    });
  }


  async function saveMarker() {
    if (
      !selectedTemplate ||
      !pendingPoint ||
      !markerCode.trim() ||
      !markerName.trim() ||
      savingMarker
    ) {
      return;
    }


    setSavingMarker(
      true
    );

    setError(
      null
    );


    try {
      const response =
        await fetch(
          "/api/admin/floor-mapping/zones",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                template_id:
                  selectedTemplate.id,

                zone_code:
                  markerCode,

                zone_name:
                  markerName,

                zone_type:
                  markerType,

                x_pct:
                  pendingPoint.x,

                y_pct:
                  pendingPoint.y,

                capacity:
                  capacity,
              }),
          }
        );


      const payload =
        await response.json();


      if (!response.ok) {
        throw new Error(
          payload?.error ||
          "Unable to save marker."
        );
      }


      setMarkerCode(
        ""
      );


      setMarkerName(
        ""
      );


      setCapacity(
        ""
      );


      setPendingPoint(
        null
      );


      await load(
        selectedTemplate.id
      );

    } catch (
      markerError: any
    ) {
      setError(
        markerError
          ?.message ||
        "Unable to save marker."
      );

    } finally {
      setSavingMarker(
        false
      );
    }
  }


  async function removeMarker(
    id: string
  ) {
    if (
      !window.confirm(
        "Remove this marker?"
      )
    ) {
      return;
    }


    const response =
      await fetch(
        `/api/admin/floor-mapping/zones?id=${encodeURIComponent(
          id
        )}`,
        {
          method:
            "DELETE",
        }
      );


    const payload =
      await response.json();


    if (!response.ok) {
      setError(
        payload?.error ||
        "Unable to remove marker."
      );

      return;
    }


    if (
      selectedTemplate
    ) {
      await load(
        selectedTemplate.id
      );
    }
  }


  return (
    <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 md:py-9">

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
            Administration
          </p>

          <h1 className="mt-1.5 text-3xl font-black tracking-tight text-[#292824]">
            Floor Mapping Templates
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
            Upload outlet floor plans, version layouts and place responsive FOH markers.
          </p>
        </div>


        <label className="block min-w-[260px]">

          <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
            Outlet
          </span>

          <select
            value={
              outletId
            }
            onChange={
              (
                event
              ) =>
                setOutletId(
                  event.target.value
                )
            }
            className="h-12 w-full rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-black text-[#292824]"
          >
            {outlets.map(
              (
                item
              ) => (
                <option
                  key={
                    item.id
                  }
                  value={
                    item.id
                  }
                >
                  {item.name}
                </option>
              )
            )}
          </select>

        </label>

      </div>


      {error && (
        <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}


      <section className="mt-6 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">

          <label className="flex-1">

            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
              Template Name
            </span>

            <input
              value={
                templateName
              }
              onChange={
                (
                  event
                ) =>
                  setTemplateName(
                    event.target.value
                  )
              }
              placeholder={
                outlet
                  ? `${outlet.name} Floor Plan`
                  : "Floor Plan"
              }
              className="h-12 w-full rounded-2xl border border-neutral-200 px-4 text-sm font-bold outline-none focus:border-neutral-500"
            />

          </label>


          <label className="flex-1">

            <span className="mb-2 block text-[9px] font-black uppercase tracking-[0.14em] text-neutral-400">
              Floor Plan Image
            </span>

            <input
              type="file"
              accept="image/*"
              onChange={
                (
                  event
                ) =>
                  setImage(
                    event.target
                      .files?.[0] ||
                    null
                  )
              }
              className="block h-12 w-full rounded-2xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-600"
            />

          </label>


          <button
            type="button"
            disabled={
              !templateName.trim() ||
              !image ||
              uploading
            }
            onClick={
              uploadTemplate
            }
            className="h-12 rounded-2xl bg-[#292824] px-6 text-sm font-black text-white disabled:opacity-35"
          >
            {uploading
              ? "Uploading..."
              : "Upload New Version"}
          </button>

        </div>


        <p className="mt-3 text-xs leading-5 text-neutral-500">
          Uploading never overwrites the old layout. A new version is created so historical Floor Mapping reports remain unchanged.
        </p>

      </section>


      {templates.length >
        0 && (
        <section className="mt-4 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

          <div className="flex items-center justify-between gap-3">

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
                Layout Versions
              </p>

              <h2 className="mt-1 text-lg font-black text-[#292824]">
                {outlet?.name}
              </h2>
            </div>

          </div>


          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">

            {templates.map(
              (
                template
              ) => (
                <button
                  key={
                    template.id
                  }
                  type="button"
                  onClick={() =>
                    load(
                      template.id
                    )
                  }
                  className={[
                    "min-w-[190px] rounded-2xl border p-4 text-left",
                    selectedTemplate
                      ?.id ===
                    template.id
                      ? "border-[#292824] bg-[#F6F4F1]"
                      : "border-neutral-200 bg-white",
                  ].join(
                    " "
                  )}
                >
                  <div className="flex items-center justify-between gap-2">

                    <span className="text-sm font-black text-[#292824]">
                      v{
                        template.version_number
                      }
                    </span>

                    {template.is_active && (
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black text-emerald-700">
                        ACTIVE
                      </span>
                    )}

                  </div>

                  <p className="mt-2 truncate text-xs font-bold text-neutral-600">
                    {template.name}
                  </p>

                </button>
              )
            )}

          </div>

        </section>
      )}


      {selectedTemplate && (
        <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">

          <section className="rounded-[28px] border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">
                  FOH Marker Editor
                </p>

                <h2 className="mt-1 text-xl font-black text-[#292824]">
                  {
                    selectedTemplate.name
                  }{" "}
                  · v{
                    selectedTemplate.version_number
                  }
                </h2>
              </div>


              {!selectedTemplate
                .is_active && (
                <button
                  type="button"
                  onClick={() =>
                    activateTemplate(
                      selectedTemplate.id
                    )
                  }
                  className="h-10 rounded-xl border border-emerald-200 bg-emerald-50 px-4 text-xs font-black text-emerald-700"
                >
                  Activate Template
                </button>
              )}

            </div>


            {loading ? (
              <div className="mt-4 flex min-h-[400px] items-center justify-center rounded-2xl bg-neutral-50 text-sm font-bold text-neutral-400">
                Loading floor plan...
              </div>
            ) : imageUrl ? (
              <div
                onClick={
                  mapClick
                }
                className="relative mt-4 cursor-crosshair overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100"
              >

                <img
                  src={
                    imageUrl
                  }
                  alt="Floor plan"
                  className="block h-auto w-full select-none"
                  draggable={
                    false
                  }
                />


                {zones.map(
                  (
                    zone
                  ) => (
                    <div
                      key={
                        zone.id
                      }
                      title={`${zone.zone_code} · ${zone.zone_name}`}
                      style={{
                        left:
                          `${Number(
                            zone.x_pct
                          )}%`,

                        top:
                          `${Number(
                            zone.y_pct
                          )}%`,
                      }}
                      className={[
                        "pointer-events-none absolute flex min-h-8 min-w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white px-2 text-[9px] font-black shadow-lg sm:text-[10px]",
                        markerClass(
                          zone.zone_type
                        ),
                      ].join(
                        " "
                      )}
                    >
                      {
                        zone.display_label ||
                        zone.zone_code
                      }
                    </div>
                  )
                )}


                {pendingPoint && (
                  <div
                    style={{
                      left:
                        `${pendingPoint.x}%`,

                      top:
                        `${pendingPoint.y}%`,
                    }}
                    className="pointer-events-none absolute h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-red-600 shadow-lg"
                  />
                )}

              </div>
            ) : null}


            <p className="mt-3 text-xs text-neutral-500">
              Click directly on the floor plan to place a new marker. Coordinates are stored as percentages for responsive desktop and mobile layouts.
            </p>

          </section>


          <aside className="space-y-4">

            <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">

              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                Add Marker
              </p>


              {!pendingPoint ? (
                <p className="mt-4 text-sm leading-6 text-neutral-500">
                  Click a position on the floor plan first.
                </p>
              ) : (
                <div className="mt-4 space-y-3">

                  <div className="grid grid-cols-2 gap-2">

                    <div className="rounded-xl bg-[#F6F4F1] p-3">
                      <p className="text-[8px] font-black uppercase text-neutral-400">
                        X
                      </p>

                      <p className="mt-1 text-sm font-black">
                        {
                          pendingPoint.x
                        }%
                      </p>
                    </div>


                    <div className="rounded-xl bg-[#F6F4F1] p-3">
                      <p className="text-[8px] font-black uppercase text-neutral-400">
                        Y
                      </p>

                      <p className="mt-1 text-sm font-black">
                        {
                          pendingPoint.y
                        }%
                      </p>
                    </div>

                  </div>


                  <input
                    value={
                      markerCode
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setMarkerCode(
                          event.target.value
                        )
                    }
                    placeholder="Code · R1 / VIP1"
                    className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-bold"
                  />


                  <input
                    value={
                      markerName
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setMarkerName(
                          event.target.value
                        )
                    }
                    placeholder="Name · Table R1"
                    className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-bold"
                  />


                  <select
                    value={
                      markerType
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setMarkerType(
                          event.target.value
                        )
                    }
                    className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-bold"
                  >
                    {ZONE_TYPES.map(
                      (
                        type
                      ) => (
                        <option
                          key={
                            type
                          }
                          value={
                            type
                          }
                        >
                          {type}
                        </option>
                      )
                    )}
                  </select>


                  <input
                    type="number"
                    min="0"
                    value={
                      capacity
                    }
                    onChange={
                      (
                        event
                      ) =>
                        setCapacity(
                          event.target.value
                        )
                    }
                    placeholder="Capacity · optional"
                    className="h-11 w-full rounded-xl border border-neutral-200 px-3 text-sm font-bold"
                  />


                  <div className="grid grid-cols-2 gap-2">

                    <button
                      type="button"
                      onClick={() =>
                        setPendingPoint(
                          null
                        )
                      }
                      className="h-11 rounded-xl border border-neutral-200 text-xs font-black"
                    >
                      Cancel
                    </button>


                    <button
                      type="button"
                      disabled={
                        !markerCode.trim() ||
                        !markerName.trim() ||
                        savingMarker
                      }
                      onClick={
                        saveMarker
                      }
                      className="h-11 rounded-xl bg-[#292824] text-xs font-black text-white disabled:opacity-35"
                    >
                      {savingMarker
                        ? "Saving..."
                        : "Add Marker"}
                    </button>

                  </div>

                </div>
              )}

            </section>


            <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">

              <div className="flex items-center justify-between gap-2">

                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                    Markers
                  </p>

                  <p className="mt-1 text-sm font-black text-[#292824]">
                    {
                      zones.length
                    } configured
                  </p>
                </div>

              </div>


              <div className="mt-4 max-h-[340px] space-y-2 overflow-y-auto">

                {zones.map(
                  (
                    zone
                  ) => (
                    <div
                      key={
                        zone.id
                      }
                      className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 p-3"
                    >

                      <div className="min-w-0">

                        <div className="flex items-center gap-2">

                          <span
                            className={[
                              "h-3 w-3 shrink-0 rounded-full",
                              markerClass(
                                zone.zone_type
                              ),
                            ].join(
                              " "
                            )}
                          />

                          <p className="truncate text-xs font-black text-[#292824]">
                            {
                              zone.zone_code
                            }
                            {" · "}
                            {
                              zone.zone_name
                            }
                          </p>

                        </div>

                        <p className="mt-1 text-[10px] font-bold text-neutral-400">
                          {
                            zone.zone_type
                          }
                          {" · "}
                          {Number(
                            zone.x_pct
                          ).toFixed(
                            1
                          )}
                          %
                          {" / "}
                          {Number(
                            zone.y_pct
                          ).toFixed(
                            1
                          )}
                          %
                        </p>

                      </div>


                      <button
                        type="button"
                        onClick={() =>
                          removeMarker(
                            zone.id
                          )
                        }
                        className="shrink-0 text-[10px] font-black text-red-700"
                      >
                        Remove
                      </button>

                    </div>
                  )
                )}


                {zones.length ===
                  0 && (
                  <p className="rounded-xl bg-neutral-50 p-4 text-xs font-bold leading-5 text-neutral-400">
                    No markers yet.
                  </p>
                )}

              </div>

            </section>


            <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm">

              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                BOH Position Template
              </p>

              <p className="mt-1 text-xs text-neutral-500">
                Kitchen uses list view.
              </p>


              <div className="mt-4 space-y-1">

                {bohPositions.map(
                  (
                    position
                  ) => (
                    <div
                      key={
                        position.id
                      }
                      className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2 last:border-0"
                    >

                      <span className="text-xs font-black text-[#292824]">
                        {
                          position.position_name
                        }
                      </span>

                      <span className="text-[10px] font-bold text-neutral-400">
                        {
                          position.default_station ||
                          "—"
                        }
                      </span>

                    </div>
                  )
                )}

              </div>

            </section>

          </aside>

        </div>
      )}


      {!selectedTemplate &&
       !loading && (
        <section className="mt-4 rounded-[28px] border border-dashed border-neutral-300 bg-white p-10 text-center">

          <p className="text-lg font-black text-[#292824]">
            No Floor Plan Yet
          </p>

          <p className="mt-2 text-sm text-neutral-500">
            Upload the first layout for this outlet.
          </p>

        </section>
      )}

    </main>
  );
}
