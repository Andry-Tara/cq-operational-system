"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Role = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  is_admin: boolean;
  is_active: boolean;
};

type Outlet = {
  id: string;
  code: string;
  name: string;
  timezone: string;
  is_active: boolean;
};

type UserRow = {
  id: string;
  employee_id?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  job_title?: string | null;
  is_active: boolean;
  role_id?: string | null;
  role_name?: string | null;
  role_code?: string | null;
  is_admin: boolean;
  outlet_ids: string[];
};

type FormState = {
  id?: string;
  fullName: string;
  email: string;
  temporaryPassword: string;
  jobTitle: string;
  phone: string;
  roleId: string;
  outletIds: string[];
  isActive: boolean;
};

const emptyForm: FormState = {
  fullName: "",
  email: "",
  temporaryPassword: "",
  jobTitle: "",
  phone: "",
  roleId: "",
  outletIds: [],
  isActive: true,
};

export function UsersClient({
  users,
  roles,
  outlets,
}: {
  users: UserRow[];
  roles: Role[];
  outlets: Outlet[];
}) {
  const router = useRouter();

  const [search, setSearch] =
    useState("");

  const [open, setOpen] =
    useState(false);

  const [form, setForm] =
    useState<FormState>(
      emptyForm
    );

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const activeRoles =
    roles.filter(
      (role) => role.is_active
    );

  const selectedRole =
    roles.find(
      (role) =>
        role.id === form.roleId
    );

  const filteredUsers =
    useMemo(() => {
      const q =
        search
          .trim()
          .toLowerCase();

      if (!q) return users;

      return users.filter(
        (user) =>
          user.full_name
            .toLowerCase()
            .includes(q) ||
          user.email
            .toLowerCase()
            .includes(q) ||
          (
            user.role_name ?? ""
          )
            .toLowerCase()
            .includes(q)
      );
    }, [users, search]);

  function newUser() {
    setForm(emptyForm);
    setError(null);
    setOpen(true);
  }

  function editUser(
    user: UserRow
  ) {
    setForm({
      id: user.id,
      fullName:
        user.full_name,
      email:
        user.email,
      temporaryPassword: "",
      jobTitle:
        user.job_title ?? "",
      phone:
        user.phone ?? "",
      roleId:
        user.role_id ?? "",
      outletIds:
        user.outlet_ids ?? [],
      isActive:
        user.is_active,
    });

    setError(null);
    setOpen(true);
  }

  function toggleOutlet(
    id: string
  ) {
    setForm((current) => ({
      ...current,
      outletIds:
        current.outletIds.includes(
          id
        )
          ? current.outletIds.filter(
              (item) =>
                item !== id
            )
          : [
              ...current.outletIds,
              id,
            ],
    }));
  }

  function selectAllOutlets() {
    setForm((current) => ({
      ...current,
      outletIds:
        current.outletIds.length ===
        outlets.length
          ? []
          : outlets.map(
              (outlet) =>
                outlet.id
            ),
    }));
  }

  async function saveUser(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setError(null);

    if (
      !form.fullName.trim() ||
      !form.email.trim() ||
      !form.roleId
    ) {
      setError(
        "Name, email and role are required."
      );
      return;
    }

    if (
      !form.id &&
      form.temporaryPassword.length <
        8
    ) {
      setError(
        "Temporary password must contain at least 8 characters."
      );
      return;
    }

    if (
      !selectedRole?.is_admin &&
      form.outletIds.length === 0
    ) {
      setError(
        "Select at least one outlet for this user."
      );
      return;
    }

    setSaving(true);

    try {
      const url =
        form.id
          ? `/api/admin/users/${form.id}`
          : "/api/admin/users";

      const response =
        await fetch(url, {
          method:
            form.id
              ? "PATCH"
              : "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body:
            JSON.stringify({
              fullName:
                form.fullName,
              email:
                form.email,
              temporaryPassword:
                form.temporaryPassword,
              jobTitle:
                form.jobTitle,
              phone:
                form.phone,
              roleId:
                form.roleId,
              outletIds:
                form.outletIds,
              isActive:
                form.isActive,
            }),
        });

      const result =
        await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error ||
            "Unable to save user."
        );
      }

      setOpen(false);
      router.refresh();
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to save user."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search users..."
            className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-900 outline-none focus:border-red-300 focus:ring-4 focus:ring-red-50"
          />
        </div>

        <button
          type="button"
          onClick={newUser}
          className="rounded-2xl bg-red-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-800"
        >
          + Add User
        </button>
      </div>

      <div className="mt-5 overflow-hidden rounded-[24px] border border-neutral-200 bg-white shadow-sm">
        <div className="hidden grid-cols-[1.6fr_1fr_1.1fr_100px] gap-4 border-b border-neutral-100 bg-neutral-50 px-6 py-3 text-[10px] font-black uppercase tracking-[0.1em] text-neutral-400 md:grid">
          <div>User</div>
          <div>Role</div>
          <div>Outlet Access</div>
          <div></div>
        </div>

        {filteredUsers.length ===
          0 && (
          <div className="p-10 text-center text-sm text-neutral-400">
            No users found.
          </div>
        )}

        {filteredUsers.map(
          (user) => {
            const outletNames =
              user.is_admin
                ? "All Outlets"
                : outlets
                    .filter(
                      (outlet) =>
                        user.outlet_ids.includes(
                          outlet.id
                        )
                    )
                    .map(
                      (outlet) =>
                        outlet.name
                    );

            return (
              <div
                key={user.id}
                className="grid gap-4 border-b border-neutral-100 px-5 py-5 last:border-b-0 md:grid-cols-[1.6fr_1fr_1.1fr_100px] md:items-center md:px-6"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-bold text-neutral-900">
                      {user.full_name}
                    </p>

                    <span
                      className={
                        user.is_active
                          ? "rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-black text-emerald-700"
                          : "rounded-full bg-neutral-100 px-2 py-1 text-[9px] font-black text-neutral-500"
                      }
                    >
                      {user.is_active
                        ? "ACTIVE"
                        : "DISABLED"}
                    </span>
                  </div>

                  <p className="mt-1 truncate text-xs text-neutral-400">
                    {user.email}
                  </p>

                  {user.job_title && (
                    <p className="mt-1 text-[11px] text-neutral-400">
                      {user.job_title}
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400 md:hidden">
                    Role
                  </p>

                  <p className="mt-1 text-sm font-semibold text-neutral-700 md:mt-0">
                    {user.role_name ||
                      "No role"}
                  </p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase text-neutral-400 md:hidden">
                    Outlet Access
                  </p>

                  <p className="mt-1 text-xs leading-5 text-neutral-500 md:mt-0">
                    {Array.isArray(
                      outletNames
                    )
                      ? outletNames.join(
                          ", "
                        ) ||
                        "No outlet"
                      : outletNames}
                  </p>
                </div>

                <div className="md:text-right">
                  <button
                    type="button"
                    onClick={() =>
                      editUser(user)
                    }
                    className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-bold text-neutral-600 transition hover:border-red-200 hover:text-red-700"
                  >
                    Edit
                  </button>
                </div>
              </div>
            );
          }
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/50 px-4 py-8">
          <div className="mx-auto w-full max-w-[620px] rounded-[28px] bg-white p-6 shadow-2xl md:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-700">
                  Administration
                </p>

                <h2 className="mt-2 text-2xl font-bold text-neutral-950">
                  {form.id
                    ? "Edit User"
                    : "Add User"}
                </h2>
              </div>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setOpen(false)
                }
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-100 text-neutral-500"
              >
                ×
              </button>
            </div>

            <form
              onSubmit={saveUser}
              className="mt-7 space-y-5"
            >
              <Field
                label="Full Name"
                value={form.fullName}
                disabled={saving}
                onChange={(value) =>
                  setForm(
                    (current) => ({
                      ...current,
                      fullName: value,
                    })
                  )
                }
              />

              <Field
                label="Email Address"
                type="email"
                value={form.email}
                disabled={saving}
                onChange={(value) =>
                  setForm(
                    (current) => ({
                      ...current,
                      email: value,
                    })
                  )
                }
              />

              <Field
                label={
                  form.id
                    ? "New Password (Optional)"
                    : "Temporary Password"
                }
                type="password"
                value={
                  form.temporaryPassword
                }
                disabled={saving}
                placeholder={
                  form.id
                    ? "Leave blank to keep current password"
                    : "Minimum 8 characters"
                }
                onChange={(value) =>
                  setForm(
                    (current) => ({
                      ...current,
                      temporaryPassword:
                        value,
                    })
                  )
                }
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Job Title"
                  value={
                    form.jobTitle
                  }
                  disabled={saving}
                  onChange={(value) =>
                    setForm(
                      (current) => ({
                        ...current,
                        jobTitle: value,
                      })
                    )
                  }
                />

                <Field
                  label="Phone"
                  value={form.phone}
                  disabled={saving}
                  onChange={(value) =>
                    setForm(
                      (current) => ({
                        ...current,
                        phone: value,
                      })
                    )
                  }
                />
              </div>

              <div>
                <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500">
                  Role
                </label>

                <select
                  required
                  value={form.roleId}
                  disabled={saving}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        roleId:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-sm font-semibold text-neutral-800 outline-none focus:border-red-300"
                >
                  <option value="">
                    Select role
                  </option>

                  {activeRoles.map(
                    (role) => (
                      <option
                        key={role.id}
                        value={role.id}
                      >
                        {role.name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500">
                      Outlet Access
                    </p>

                    {selectedRole?.is_admin && (
                      <p className="mt-1 text-xs text-red-700">
                        Administrator automatically has access to all outlets.
                      </p>
                    )}
                  </div>

                  {!selectedRole?.is_admin && (
                    <button
                      type="button"
                      onClick={
                        selectAllOutlets
                      }
                      className="text-xs font-bold text-red-700"
                    >
                      {form
                        .outletIds
                        .length ===
                      outlets.length
                        ? "Clear"
                        : "Select All"}
                    </button>
                  )}
                </div>

                {!selectedRole?.is_admin && (
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {outlets.map(
                      (outlet) => {
                        const checked =
                          form.outletIds.includes(
                            outlet.id
                          );

                        return (
                          <label
                            key={
                              outlet.id
                            }
                            className={
                              checked
                                ? "flex cursor-pointer items-center gap-3 rounded-xl border border-red-200 bg-white px-3 py-3"
                                : "flex cursor-pointer items-center gap-3 rounded-xl border border-neutral-200 bg-white px-3 py-3"
                            }
                          >
                            <input
                              type="checkbox"
                              checked={
                                checked
                              }
                              onChange={() =>
                                toggleOutlet(
                                  outlet.id
                                )
                              }
                            />

                            <span className="text-xs font-semibold text-neutral-700">
                              {
                                outlet.name
                              }
                            </span>
                          </label>
                        );
                      }
                    )}
                  </div>
                )}
              </div>

              {form.id && (
                <label className="flex items-center justify-between gap-5 rounded-2xl border border-neutral-200 px-4 py-4">
                  <div>
                    <p className="text-sm font-bold text-neutral-800">
                      User Active
                    </p>

                    <p className="mt-1 text-xs text-neutral-400">
                      Disabled users cannot access the system.
                    </p>
                  </div>

                  <input
                    type="checkbox"
                    checked={
                      form.isActive
                    }
                    disabled={saving}
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          isActive:
                            event.target
                              .checked,
                        })
                      )
                    }
                  />
                </label>
              )}

              {error && (
                <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  {error}
                </div>
              )}

              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    setOpen(false)
                  }
                  className="rounded-2xl border border-neutral-200 px-5 py-3.5 text-sm font-bold text-neutral-600"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-2xl bg-red-700 px-5 py-3.5 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : form.id
                    ? "Save Changes"
                    : "Create User"}
                </button>
              </div>
            </form>
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
  type = "text",
  disabled = false,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (
    value: string
  ) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-black uppercase tracking-[0.1em] text-neutral-500">
        {label}
      </label>

      <input
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(
            event.target.value
          )
        }
        className="w-full rounded-2xl border border-neutral-200 bg-neutral-50 px-4 py-3.5 text-sm font-medium text-neutral-900 outline-none placeholder:text-neutral-400 focus:border-red-300 focus:bg-white focus:ring-4 focus:ring-red-50"
      />
    </div>
  );
}
