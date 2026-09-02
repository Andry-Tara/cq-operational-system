"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

type Permission = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  sort_order: number;
  is_active: boolean;
};

type Role = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  is_admin: boolean;
  is_active: boolean;
  user_count: number;
  permission_ids: string[];
};

type EditState = {
  id?: string;
  code: string;
  name: string;
  description: string;
  isAdmin: boolean;
  isActive: boolean;
  permissionIds: string[];
};

const EMPTY: EditState = {
  code: "",
  name: "",
  description: "",
  isAdmin: false,
  isActive: true,
  permissionIds: [],
};

export function PermissionsClient({
  roles,
  permissions,
}: {
  roles: Role[];
  permissions: Permission[];
}) {
  const router =
    useRouter();

  const [editing, setEditing] =
    useState<EditState | null>(
      null
    );

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const categories =
    useMemo(() => {
      const map =
        new Map<
          string,
          Permission[]
        >();

      for (
        const permission
        of permissions
      ) {
        const list =
          map.get(
            permission.category
          ) ?? [];

        list.push(permission);

        map.set(
          permission.category,
          list
        );
      }

      return Array.from(
        map.entries()
      );
    }, [permissions]);

  function addRole() {
    setError(null);

    setEditing({
      ...EMPTY,
    });
  }

  function editRole(
    role: Role
  ) {
    setError(null);

    setEditing({
      id: role.id,
      code: role.code,
      name: role.name,
      description:
        role.description ?? "",
      isAdmin:
        role.is_admin,
      isActive:
        role.is_active,
      permissionIds:
        role.permission_ids,
    });
  }

  function togglePermission(
    permissionId: string
  ) {
    if (!editing) return;

    setEditing({
      ...editing,

      permissionIds:
        editing.permissionIds.includes(
          permissionId
        )
          ? editing.permissionIds.filter(
              (id) =>
                id !==
                permissionId
            )
          : [
              ...editing.permissionIds,
              permissionId,
            ],
    });
  }

  async function saveRole() {
    if (!editing) return;

    if (
      !editing.name.trim() ||
      !editing.code.trim()
    ) {
      setError(
        "Role name and code are required."
      );

      return;
    }

    setSaving(true);
    setError(null);

    try {
      const url =
        editing.id
          ? `/api/admin/roles/${editing.id}`
          : "/api/admin/roles";

      const response =
        await fetch(
          url,
          {
            method:
              editing.id
                ? "PATCH"
                : "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                code:
                  editing.code,

                name:
                  editing.name,

                description:
                  editing.description,

                isAdmin:
                  editing.isAdmin,

                isActive:
                  editing.isActive,

                permissionIds:
                  editing.isAdmin
                    ? permissions.map(
                        (permission) =>
                          permission.id
                      )
                    : editing.permissionIds,
              }),
          }
        );

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to save role."
        );
      }

      setEditing(null);
      router.refresh();
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to save role."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mt-8 flex justify-end">
        <button
          type="button"
          onClick={addRole}
          className="rounded-2xl bg-red-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-800"
        >
          + Add Role
        </button>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">

        {roles.map(
          (role) => {
            const granted =
              role.is_admin
                ? permissions
                : permissions.filter(
                    (
                      permission
                    ) =>
                      role.permission_ids.includes(
                        permission.id
                      )
                  );

            return (
              <div
                key={role.id}
                className="rounded-[24px] border border-neutral-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-neutral-900">
                        {role.name}
                      </h2>

                      {role.is_admin && (
                        <span className="rounded-full bg-red-50 px-2.5 py-1 text-[9px] font-black uppercase text-red-700">
                          Full Access
                        </span>
                      )}

                      {!role.is_active && (
                        <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[9px] font-black uppercase text-neutral-500">
                          Disabled
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-neutral-400">
                      {role.code}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      editRole(role)
                    }
                    className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-600 transition hover:border-red-200 hover:text-red-700"
                  >
                    Manage
                  </button>
                </div>

                <p className="mt-4 text-sm leading-6 text-neutral-500">
                  {role.description ||
                    "No description."}
                </p>

                <div className="mt-5 flex items-center gap-3">
                  <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                    <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
                      Users
                    </p>

                    <p className="mt-1 text-lg font-bold text-neutral-900">
                      {
                        role.user_count
                      }
                    </p>
                  </div>

                  <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                    <p className="text-[9px] font-black uppercase tracking-wide text-neutral-400">
                      Permissions
                    </p>

                    <p className="mt-1 text-lg font-bold text-neutral-900">
                      {
                        granted.length
                      }
                      /
                      {
                        permissions.length
                      }
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {granted
                    .slice(0, 6)
                    .map(
                      (
                        permission
                      ) => (
                        <span
                          key={
                            permission.id
                          }
                          className="rounded-full bg-neutral-100 px-3 py-1.5 text-[10px] font-bold text-neutral-600"
                        >
                          {
                            permission.name
                          }
                        </span>
                      )
                    )}

                  {granted.length >
                    6 && (
                    <span className="rounded-full bg-red-50 px-3 py-1.5 text-[10px] font-bold text-red-700">
                      +
                      {granted.length -
                        6}{" "}
                      more
                    </span>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>


      {editing && (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-black/50 px-4 py-8">

          <div className="mx-auto w-full max-w-[700px] rounded-[28px] bg-white p-6 shadow-2xl md:p-8">

            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-700">
                  Permissions
                </p>

                <h2 className="mt-2 text-2xl font-bold text-neutral-950">
                  {editing.id
                    ? "Manage Role"
                    : "Add Role"}
                </h2>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setEditing(null)
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500"
              >
                ×
              </button>
            </div>


            <div className="mt-7 grid gap-4 sm:grid-cols-2">

              <Field
                label="Role Name"
                value={
                  editing.name
                }
                onChange={(
                  value
                ) =>
                  setEditing({
                    ...editing,
                    name: value,
                  })
                }
              />

              <Field
                label="Role Code"
                value={
                  editing.code
                }
                onChange={(
                  value
                ) =>
                  setEditing({
                    ...editing,

                    code:
                      value
                        .toUpperCase()
                        .replace(
                          /[^A-Z0-9_]/g,
                          "_"
                        ),
                  })
                }
              />

            </div>


            <div className="mt-4">
              <label className="mb-2 block text-[10px] font-black uppercase tracking-wide text-neutral-500">
                Description
              </label>

              <textarea
                rows={3}
                value={
                  editing.description
                }
                onChange={(
                  event
                ) =>
                  setEditing({
                    ...editing,

                    description:
                      event.target
                        .value,
                  })
                }
                className="w-full resize-none rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-sm text-neutral-900 outline-none focus:border-red-300"
              />
            </div>


            <label className="mt-4 flex items-center justify-between gap-5 rounded-2xl border border-neutral-200 px-4 py-4">

              <div>
                <p className="text-sm font-bold text-neutral-900">
                  System Administrator
                </p>

                <p className="mt-1 text-xs leading-5 text-neutral-400">
                  Administrator automatically receives every permission and full system access.
                </p>
              </div>

              <input
                type="checkbox"
                checked={
                  editing.isAdmin
                }
                onChange={(
                  event
                ) =>
                  setEditing({
                    ...editing,

                    isAdmin:
                      event.target
                        .checked,
                  })
                }
              />
            </label>


            <div className="mt-6">

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.12em] text-neutral-500">
                    Permissions
                  </p>

                  <p className="mt-1 text-xs text-neutral-400">
                    Users automatically inherit these permissions from this role.
                  </p>
                </div>

                {!editing.isAdmin && (
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        ...editing,

                        permissionIds:
                          editing
                            .permissionIds
                            .length ===
                          permissions.length
                            ? []
                            : permissions.map(
                                (
                                  permission
                                ) =>
                                  permission.id
                              ),
                      })
                    }
                    className="text-xs font-bold text-red-700"
                  >
                    {editing
                      .permissionIds
                      .length ===
                    permissions.length
                      ? "Clear All"
                      : "Select All"}
                  </button>
                )}
              </div>


              <div className="mt-4 space-y-5">

                {categories.map(
                  ([
                    category,
                    items,
                  ]) => (
                    <div
                      key={
                        category
                      }
                    >
                      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.12em] text-neutral-400">
                        {
                          category
                        }
                      </p>

                      <div className="grid gap-2 sm:grid-cols-2">

                        {items.map(
                          (
                            permission
                          ) => {
                            const checked =
                              editing.isAdmin ||
                              editing.permissionIds.includes(
                                permission.id
                              );

                            return (
                              <label
                                key={
                                  permission.id
                                }
                                className={
                                  checked
                                    ? "flex cursor-pointer items-start gap-3 rounded-2xl border border-red-200 bg-red-50/40 px-4 py-3.5"
                                    : "flex cursor-pointer items-start gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-3.5"
                                }
                              >
                                <input
                                  type="checkbox"
                                  disabled={
                                    editing.isAdmin
                                  }
                                  checked={
                                    checked
                                  }
                                  onChange={() =>
                                    togglePermission(
                                      permission.id
                                    )
                                  }
                                  className="mt-1"
                                />

                                <div>
                                  <p className="text-xs font-bold text-neutral-800">
                                    {
                                      permission.name
                                    }
                                  </p>

                                  <p className="mt-1 text-[11px] leading-5 text-neutral-400">
                                    {
                                      permission.description
                                    }
                                  </p>
                                </div>
                              </label>
                            );
                          }
                        )}

                      </div>
                    </div>
                  )
                )}

              </div>
            </div>


            <label className="mt-6 flex items-center justify-between gap-5 rounded-2xl border border-neutral-200 px-4 py-4">

              <div>
                <p className="text-sm font-bold text-neutral-900">
                  Role Active
                </p>

                <p className="mt-1 text-xs text-neutral-400">
                  Disabled roles cannot be assigned to new users.
                </p>
              </div>

              <input
                type="checkbox"
                checked={
                  editing.isActive
                }
                onChange={(
                  event
                ) =>
                  setEditing({
                    ...editing,

                    isActive:
                      event.target
                        .checked,
                  })
                }
              />
            </label>


            {error && (
              <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            )}


            <div className="mt-7 grid gap-3 sm:grid-cols-2">

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setEditing(null)
                }
                className="rounded-2xl border border-neutral-200 px-5 py-3.5 text-sm font-bold text-neutral-600"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={saving}
                onClick={
                  saveRole
                }
                className="rounded-2xl bg-red-700 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editing.id
                  ? "Save Role"
                  : "Create Role"}
              </button>

            </div>

          </div>
        </div>
      )}
    </>
  );
}


function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-black uppercase tracking-wide text-neutral-500">
        {label}
      </label>

      <input
        value={value}
        onChange={(
          event
        ) =>
          onChange(
            event.target.value
          )
        }
        className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-sm text-neutral-900 outline-none focus:border-red-300"
      />
    </div>
  );
}
