"use client";

import Link from "next/link";

import {
  useEffect,
  useMemo,
  useState,
} from "react";


type Outlet = {
  id:
    string;

  code:
    string;

  name:
    string;
};


type Position = {
  id:
    string;

  outlet_id:
    string |
    null;

  name:
    string;

  category:
    string;

  area:
    string;

  sort_order:
    number;

  is_active:
    boolean;
};


type LoginUser = {
  id:
    string;

  fullName:
    string;

  employeeId:
    string |
    null;

  jobTitle:
    string |
    null;

  email:
    string |
    null;

  linkedStaffId:
    string |
    null;
};


type StaffRow = {
  staffId:
    string;

  appUserId:
    string |
    null;

  employeeCode:
    string |
    null;

  fullName:
    string;

  positionId:
    string;

  positionName:
    string;

  category:
    string;

  area:
    string;

  effectiveFrom:
    string;

  effectiveTo:
    string |
    null;
};


const CATEGORIES = [
  "MOD",
  "LEADER",
  "SERVER",
  "RUNNER",
  "CHECKER",
  "CASHIER",
  "HOST",
  "GRO",
  "TA_HK",
  "FLOOR",
  "OTHER",
];


const AREAS = [
  "FOH",
  "BOH",
  "BOTH",
];


export default function TeamStructureClient({
  outlets,
  initialOutletId,
  isOrgAdmin,
}: {
  outlets:
    Outlet[];

  initialOutletId:
    string;

  isOrgAdmin:
    boolean;
}) {
  const [
    outletId,
    setOutletId,
  ] =
    useState(
      initialOutletId
    );


  const [
    tab,
    setTab,
  ] =
    useState<
      "STAFF" |
      "POSITIONS"
    >(
      "STAFF"
    );


  const [
    positions,
    setPositions,
  ] =
    useState<
      Position[]
    >(
      []
    );


  const [
    staff,
    setStaff,
  ] =
    useState<
      StaffRow[]
    >(
      []
    );


  const [
    loginUsers,
    setLoginUsers,
  ] =
    useState<
      LoginUser[]
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
    saving,
    setSaving,
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
    message,
    setMessage,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    staffName,
    setStaffName,
  ] =
    useState(
      ""
    );


  const [
    employeeCode,
    setEmployeeCode,
  ] =
    useState(
      ""
    );


  const [
    staffAppUserId,
    setStaffAppUserId,
  ] =
    useState(
      ""
    );


  const [
    staffPositionId,
    setStaffPositionId,
  ] =
    useState(
      ""
    );


  const [
    positionName,
    setPositionName,
  ] =
    useState(
      ""
    );


  const [
    positionCategory,
    setPositionCategory,
  ] =
    useState(
      "SERVER"
    );


  const [
    positionArea,
    setPositionArea,
  ] =
    useState(
      "FOH"
    );


  const [
    globalPosition,
    setGlobalPosition,
  ] =
    useState(
      false
    );


  const [
    editingId,
    setEditingId,
  ] =
    useState<
      string |
      null
    >(
      null
    );


  const [
    editingName,
    setEditingName,
  ] =
    useState(
      ""
    );


  const [
    editingPosition,
    setEditingPosition,
  ] =
    useState(
      ""
    );


  const [
    editingAppUserId,
    setEditingAppUserId,
  ] =
    useState(
      ""
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


  async function load() {
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
      const response =
        await fetch(
          `/api/team-structure?outlet_id=${encodeURIComponent(
            outletId
          )}`,
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
          "Unable to load Team Structure."
        );
      }


      setPositions(
        payload.positions ||
        []
      );


      setStaff(
        payload.staff ||
        []
      );


      setLoginUsers(
        payload.loginUsers ||
        []
      );


      setStaffPositionId(
        (
          current
        ) =>
          current ||
          payload.positions
            ?.[0]?.id ||
          ""
      );

    } catch (
      loadError: any
    ) {
      setError(
        loadError
          ?.message ||
        "Unable to load Team Structure."
      );

    } finally {
      setLoading(
        false
      );
    }
  }


  useEffect(
    () => {
      void load();
    },
    [
      outletId,
    ]
  );


  async function post(
    body: any
  ) {
    setSaving(
      true
    );

    setError(
      null
    );

    setMessage(
      null
    );


    try {
      const response =
        await fetch(
          "/api/team-structure",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                ...body,

                outletId,
              }),
          }
        );


      const payload =
        await response.json();


      if (!response.ok) {
        throw new Error(
          payload?.error ||
          "Unable to save Team Structure."
        );
      }


      await load();


      return true;

    } catch (
      postError: any
    ) {
      setError(
        postError
          ?.message ||
        "Unable to save Team Structure."
      );

      return false;

    } finally {
      setSaving(
        false
      );
    }
  }


  async function addStaff() {
    if (
      !staffName.trim() ||
      !staffPositionId
    ) {
      return;
    }


    const ok =
      await post({
        action:
          "CREATE_STAFF",

        fullName:
          staffName,

        employeeCode,

        appUserId:
          staffAppUserId,

        positionId:
          staffPositionId,
      });


    if (ok) {
      setStaffName(
        ""
      );

      setEmployeeCode(
        ""
      );

      setStaffAppUserId(
        ""
      );

      setMessage(
        "Staff added to the outlet."
      );
    }
  }


  async function addPosition() {
    if (
      !positionName.trim()
    ) {
      return;
    }


    const ok =
      await post({
        action:
          "CREATE_POSITION",

        name:
          positionName,

        category:
          positionCategory,

        area:
          positionArea,

        scope:
          globalPosition
            ? "GLOBAL"
            : "OUTLET",
      });


    if (ok) {
      setPositionName(
        ""
      );

      setMessage(
        "Position added."
      );
    }
  }


  async function saveStaff(
    row:
      StaffRow
  ) {
    if (
      !editingName.trim() ||
      !editingPosition
    ) {
      return;
    }


    const ok =
      await post({
        action:
          "UPDATE_STAFF",

        staffId:
          row.staffId,

        fullName:
          editingName,

        appUserId:
          editingAppUserId,

        positionId:
          editingPosition,
      });


    if (ok) {
      setEditingId(
        null
      );

      setMessage(
        "Staff assignment updated."
      );
    }
  }


  async function deactivateStaff(
    row:
      StaffRow
  ) {
    if (
      !window.confirm(
        `Deactivate ${row.fullName}? Historical assignments will be kept.`
      )
    ) {
      return;
    }


    const ok =
      await post({
        action:
          "DEACTIVATE_STAFF",

        staffId:
          row.staffId,
      });


    if (ok) {
      setMessage(
        "Staff deactivated. History is preserved."
      );
    }
  }


  return (
    <main className="mx-auto max-w-[1350px] px-4 py-5 sm:px-6 md:py-8">

      <section className="rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-red-700">
              Outlet Management
            </p>

            <h1 className="mt-1 text-3xl font-black tracking-tight text-[#292824]">
              Team Structure
            </h1>

            <p className="mt-2 text-sm leading-6 text-neutral-500">
              Maintain staff, operational positions and current outlet assignments.
            </p>

          </div>


          <div className="flex flex-wrap items-end gap-2">

            {isOrgAdmin &&
             outlets.length >
              1 && (
              <label>

                <span className="mb-1.5 block text-[9px] font-black uppercase tracking-[0.12em] text-neutral-400">
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
                  className="h-11 min-w-[220px] rounded-xl border border-neutral-200 bg-white px-3 text-sm font-black text-[#292824]"
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
            )}


            <Link
              href="/protected/floor-mapping"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 text-xs font-black text-[#292824]"
            >
              Floor Mapping
            </Link>

          </div>

        </div>


        <div className="mt-5 grid grid-cols-2 gap-2">

          <button
            type="button"
            onClick={() =>
              setTab(
                "STAFF"
              )
            }
            className={[
              "h-11 rounded-2xl border text-xs font-black",
              tab ===
              "STAFF"
                ? "border-[#292824] bg-[#292824] text-white"
                : "border-neutral-200 bg-white text-neutral-600",
            ].join(
              " "
            )}
          >
            Staff Directory
          </button>


          <button
            type="button"
            onClick={() =>
              setTab(
                "POSITIONS"
              )
            }
            className={[
              "h-11 rounded-2xl border text-xs font-black",
              tab ===
              "POSITIONS"
                ? "border-[#292824] bg-[#292824] text-white"
                : "border-neutral-200 bg-white text-neutral-600",
            ].join(
              " "
            )}
          >
            Positions
          </button>

        </div>

      </section>


      {message && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          {message}
        </div>
      )}


      {error && (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}


      {tab ===
        "STAFF" && (
        <>
          <section className="mt-4 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

            <div className="flex items-start justify-between gap-3">

              <div>

                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                  Add Staff
                </p>

                <h2 className="mt-1 text-xl font-black text-[#292824]">
                  {outlet?.name}
                </h2>

              </div>


              <span className="rounded-full bg-[#F6F4F1] px-3 py-2 text-[10px] font-black text-neutral-600">
                {staff.length} active
              </span>

            </div>


            <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px_minmax(0,1fr)_auto]">

              <select
                value={
                  staffAppUserId
                }
                onChange={
                  (
                    event
                  ) => {
                    const value =
                      event.target.value;


                    setStaffAppUserId(
                      value
                    );


                    const loginUser =
                      loginUsers.find(
                        (
                          item
                        ) =>
                          item.id ===
                          value
                      );


                    if (loginUser) {
                      setStaffName(
                        loginUser.fullName
                      );


                      if (
                        loginUser.employeeId
                      ) {
                        setEmployeeCode(
                          loginUser.employeeId
                        );
                      }
                    }
                  }
                }
                className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold text-[#292824]"
              >
                <option value="">
                  Login Account · Optional
                </option>

                {loginUsers.map(
                  (
                    user
                  ) => (
                    <option
                      key={
                        user.id
                      }
                      value={
                        user.id
                      }
                      disabled={
                        Boolean(
                          user.linkedStaffId
                        )
                      }
                    >
                      {user.fullName}
                      {
                        user.email
                          ? ` · ${user.email}`
                          : ""
                      }
                      {
                        user.linkedStaffId
                          ? " · LINKED"
                          : ""
                      }
                    </option>
                  )
                )}
              </select>


              <input
                value={
                  staffName
                }
                onChange={
                  (
                    event
                  ) =>
                    setStaffName(
                      event.target.value
                    )
                }
                placeholder="Staff name · Lulu"
                className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold text-[#292824]"
              />


              <input
                value={
                  employeeCode
                }
                onChange={
                  (
                    event
                  ) =>
                    setEmployeeCode(
                      event.target.value
                    )
                }
                placeholder="Employee ID · optional"
                className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold text-[#292824]"
              />


              <select
                value={
                  staffPositionId
                }
                onChange={
                  (
                    event
                  ) =>
                    setStaffPositionId(
                      event.target.value
                    )
                }
                className="h-12 rounded-2xl border border-neutral-200 bg-white px-4 text-sm font-bold text-[#292824]"
              >
                {positions.map(
                  (
                    position
                  ) => (
                    <option
                      key={
                        position.id
                      }
                      value={
                        position.id
                      }
                    >
                      {position.name}
                      {" · "}
                      {position.area}
                    </option>
                  )
                )}
              </select>


              <button
                type="button"
                disabled={
                  !staffName.trim() ||
                  !staffPositionId ||
                  saving
                }
                onClick={
                  addStaff
                }
                className="h-12 rounded-2xl bg-[#292824] px-6 text-sm font-black text-white disabled:opacity-35"
              >
                Add Staff
              </button>

            </div>

          </section>


          <section className="mt-4 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
              Current Team
            </p>


            <div className="mt-4 space-y-2">

              {staff.map(
                (
                  row
                ) => {
                  const editing =
                    editingId ===
                    row.staffId;


                  return (
                    <div
                      key={
                        row.staffId
                      }
                      className="rounded-2xl border border-neutral-200 p-4"
                    >

                      {editing ? (
                        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">

                          <input
                            value={
                              editingName
                            }
                            onChange={
                              (
                                event
                              ) =>
                                setEditingName(
                                  event.target.value
                                )
                            }
                            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm font-bold"
                          />


                          <select
                            value={
                              editingAppUserId
                            }
                            onChange={
                              (
                                event
                              ) =>
                                setEditingAppUserId(
                                  event.target.value
                                )
                            }
                            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm font-bold"
                          >
                            <option value="">
                              No Login Link
                            </option>

                            {loginUsers.map(
                              (
                                user
                              ) => (
                                <option
                                  key={
                                    user.id
                                  }
                                  value={
                                    user.id
                                  }
                                  disabled={
                                    Boolean(
                                      user.linkedStaffId &&
                                      user.linkedStaffId !==
                                        row.staffId
                                    )
                                  }
                                >
                                  {user.fullName}
                                  {
                                    user.email
                                      ? ` · ${user.email}`
                                      : ""
                                  }
                                  {
                                    user.linkedStaffId &&
                                    user.linkedStaffId !==
                                      row.staffId
                                      ? " · LINKED"
                                      : ""
                                  }
                                </option>
                              )
                            )}
                          </select>


                          <select
                            value={
                              editingPosition
                            }
                            onChange={
                              (
                                event
                              ) =>
                                setEditingPosition(
                                  event.target.value
                                )
                            }
                            className="h-11 rounded-xl border border-neutral-200 px-3 text-sm font-bold"
                          >
                            {!positions.some(
                              (
                                position
                              ) =>
                                position.id ===
                                row.positionId
                            ) && (
                              <option
                                value={
                                  row.positionId
                                }
                              >
                                {row.positionName}
                                {" · LEGACY"}
                              </option>
                            )}

                            {positions.map(
                              (
                                position
                              ) => (
                                <option
                                  key={
                                    position.id
                                  }
                                  value={
                                    position.id
                                  }
                                >
                                  {position.name}
                                </option>
                              )
                            )}
                          </select>


                          <div className="flex gap-2">

                            <button
                              type="button"
                              onClick={() =>
                                setEditingId(
                                  null
                                )
                              }
                              className="h-11 rounded-xl border border-neutral-200 px-4 text-xs font-black"
                            >
                              Cancel
                            </button>

                            <button
                              type="button"
                              disabled={
                                saving
                              }
                              onClick={() =>
                                saveStaff(
                                  row
                                )
                              }
                              className="h-11 rounded-xl bg-[#292824] px-4 text-xs font-black text-white"
                            >
                              Save
                            </button>

                          </div>

                        </div>
                      ) : (
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                          <div className="min-w-0">

                            <div className="flex flex-wrap items-center gap-2">

                              <p className="text-sm font-black text-[#292824]">
                                {row.fullName}
                              </p>

                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[8px] font-black text-emerald-700">
                                ACTIVE
                              </span>

                            </div>

                            <p className="mt-1 text-xs font-bold text-neutral-500">
                              {row.positionName}
                              {" · "}
                              {row.area}
                              {" · "}
                              {row.category}
                            </p>

                            {row.employeeCode && (
                              <p className="mt-1 text-[10px] font-bold text-neutral-400">
                                Employee ID · {
                                  row.employeeCode
                                }
                              </p>
                            )}


                            {row.appUserId && (
                              <p className="mt-1 text-[10px] font-black text-emerald-700">
                                LOGIN ACCOUNT LINKED
                              </p>
                            )}

                          </div>


                          <div className="flex gap-2">

                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(
                                  row.staffId
                                );

                                setEditingName(
                                  row.fullName
                                );

                                setEditingPosition(
                                  row.positionId
                                );

                                setEditingAppUserId(
                                  row.appUserId ||
                                  ""
                                );
                              }}
                              className="h-10 rounded-xl border border-neutral-200 px-4 text-xs font-black text-[#292824]"
                            >
                              Edit
                            </button>


                            <button
                              type="button"
                              onClick={() =>
                                deactivateStaff(
                                  row
                                )
                              }
                              className="h-10 rounded-xl border border-red-100 bg-red-50 px-4 text-xs font-black text-red-700"
                            >
                              Deactivate
                            </button>

                          </div>

                        </div>
                      )}

                    </div>
                  );
                }
              )}


              {!loading &&
               staff.length ===
                0 && (
                <div className="rounded-2xl bg-neutral-50 p-8 text-center">

                  <p className="text-sm font-black text-neutral-500">
                    No active staff yet.
                  </p>

                  <p className="mt-1 text-xs text-neutral-400">
                    Add the first team member above.
                  </p>

                </div>
              )}

            </div>

          </section>
        </>
      )}


      {tab ===
        "POSITIONS" && (
        <>
          <section className="mt-4 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

            <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
              Add Position
            </p>


            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_190px_150px_auto]">

              <input
                value={
                  positionName
                }
                onChange={
                  (
                    event
                  ) =>
                    setPositionName(
                      event.target.value
                    )
                }
                placeholder="Position · Server 2 / GRO 2 / Bar"
                className="h-12 rounded-2xl border border-neutral-200 px-4 text-sm font-bold"
              />


              <select
                value={
                  positionCategory
                }
                onChange={
                  (
                    event
                  ) =>
                    setPositionCategory(
                      event.target.value
                    )
                }
                className="h-12 rounded-2xl border border-neutral-200 px-4 text-sm font-bold"
              >
                {CATEGORIES.map(
                  (
                    category
                  ) => (
                    <option
                      key={
                        category
                      }
                      value={
                        category
                      }
                    >
                      {category}
                    </option>
                  )
                )}
              </select>


              <select
                value={
                  positionArea
                }
                onChange={
                  (
                    event
                  ) =>
                    setPositionArea(
                      event.target.value
                    )
                }
                className="h-12 rounded-2xl border border-neutral-200 px-4 text-sm font-bold"
              >
                {AREAS.map(
                  (
                    area
                  ) => (
                    <option
                      key={
                        area
                      }
                      value={
                        area
                      }
                    >
                      {area}
                    </option>
                  )
                )}
              </select>


              <button
                type="button"
                disabled={
                  !positionName.trim() ||
                  saving
                }
                onClick={
                  addPosition
                }
                className="h-12 rounded-2xl bg-[#292824] px-6 text-sm font-black text-white disabled:opacity-35"
              >
                Add Position
              </button>

            </div>


            {isOrgAdmin && (
              <label className="mt-4 flex items-center gap-3 text-xs font-bold text-neutral-600">

                <input
                  type="checkbox"
                  checked={
                    globalPosition
                  }
                  onChange={
                    (
                      event
                    ) =>
                      setGlobalPosition(
                        event.target.checked
                      )
                  }
                  className="h-4 w-4"
                />

                Make this position available to every outlet

              </label>
            )}


            <p className="mt-3 text-xs leading-5 text-neutral-500">
              Category is only used by the system for grouping and Floor Mapping colors. The visible label remains the Position name.
            </p>

          </section>


          <section className="mt-4 rounded-[28px] border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">

            <div className="flex items-center justify-between gap-3">

              <div>

                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400">
                  Position Library
                </p>

                <h2 className="mt-1 text-xl font-black text-[#292824]">
                  {outlet?.name}
                </h2>

              </div>


              <span className="rounded-full bg-[#F6F4F1] px-3 py-2 text-[10px] font-black">
                {positions.length} positions
              </span>

            </div>


            <div className="mt-4 grid gap-2 md:grid-cols-2">

              {positions.map(
                (
                  position
                ) => (
                  <div
                    key={
                      position.id
                    }
                    className="flex items-center justify-between gap-3 rounded-2xl border border-neutral-200 p-4"
                  >

                    <div>

                      <p className="text-sm font-black text-[#292824]">
                        {position.name}
                      </p>

                      <p className="mt-1 text-[10px] font-bold text-neutral-400">
                        {position.area}
                        {" · "}
                        {position.category}
                        {" · "}
                        {
                          position.outlet_id
                            ? "OUTLET"
                            : "GLOBAL"
                        }
                      </p>

                    </div>


                    <span
                      className={[
                        "h-3 w-3 rounded-full",
                        position.outlet_id
                          ? "bg-[#D8D355]"
                          : "bg-emerald-500",
                      ].join(
                        " "
                      )}
                    />

                  </div>
                )
              )}

            </div>

          </section>
        </>
      )}

    </main>
  );
}
