"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ChevronRight,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { NoTranslate } from "@/components/ui/NoTranslate";
import { usePermissions } from "@/components/rbac/PermissionsProvider";
import { PermissionPicker } from "@/components/rbac/PermissionPicker";
import { ALL_PERMISSIONS, type Permission } from "@/lib/rbac/permissions";
import type { SafeRole } from "@/lib/serializeUser";
import { createRoleSchema, updateRoleSchema } from "@/lib/validations/roleSchema";

type RoleForm = { name: string; description: string; permissions: Permission[] };

const emptyForm: RoleForm = { name: "", description: "", permissions: [] };

function RoleTag({ role }: { role: SafeRole }) {
  if (role.isSuperAdmin) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
        <Lock className="h-3 w-3" />
        Protected
      </span>
    );
  }
  if (role.isSystem) {
    return (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
        System
      </span>
    );
  }
  return null;
}

export default function RolesPage() {
  const { can, me, isSuperAdmin } = usePermissions();
  const canCreate = can("roles.create");
  const myPermissions = new Set(me?.permissions ?? []);
  const canGrant = (permission: Permission) => isSuperAdmin || myPermissions.has(permission);

  const [roles, setRoles] = useState<SafeRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<SafeRole | null>(null);
  const [form, setForm] = useState<RoleForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingRole, setDeletingRole] = useState<SafeRole | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchRoles = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/roles", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch roles");
      setRoles(data.roles ?? []);
    } catch (err) {
      setRoles([]);
      setAlert({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to fetch roles",
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const openAddDialog = () => {
    setEditingRole(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  };

  const openEditDialog = (role: SafeRole) => {
    setEditingRole(role);
    setForm({ name: role.name, description: role.description, permissions: role.permissions });
    setFormError("");
    setFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");

    const parsed = editingRole
      ? updateRoleSchema.safeParse(form)
      : createRoleSchema.safeParse(form);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(editingRole ? `/api/roles/${editingRole._id}` : "/api/roles", {
        method: editingRole ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save role");
      setAlert({
        type: "success",
        message: editingRole
          ? "Role updated. Users who already have this role keep their current permissions."
          : "Role created successfully",
      });
      setFormOpen(false);
      if (!editingRole && data._id) setSelectedId(data._id);
      fetchRoles();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingRole) return;
    setDeleteError("");
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/roles/${deletingRole._id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete role");
      setAlert({ type: "success", message: "Role deleted successfully" });
      setDeleteOpen(false);
      if (selectedId === deletingRole._id) setSelectedId(null);
      fetchRoles();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsDeleting(false);
    }
  };

  const selected = roles.find((role) => role._id === selectedId) ?? null;
  const permissionCount = (role: SafeRole) =>
    role.isSuperAdmin ? ALL_PERMISSIONS.length : role.permissions.length;

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-950 md:p-6">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Roles</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Permission templates. Assigning a role copies its permissions to the user.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={fetchRoles}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
              {canCreate && (
                <button
                  type="button"
                  onClick={openAddDialog}
                  className="flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
                >
                  <Plus className="h-4 w-4" />
                  Add Role
                </button>
              )}
            </div>
          </div>

          {alert && (
            <div
              className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                alert.type === "error"
                  ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"
                  : "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300"
              }`}
            >
              <p className="flex-1">{alert.message}</p>
              <button
                type="button"
                onClick={() => setAlert(null)}
                className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100"
                aria-label="Dismiss alert"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
                <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
                <p className="font-medium">Loading roles...</p>
              </div>
            ) : roles.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <ShieldCheck className="h-8 w-8 text-indigo-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No roles found</h3>
                <p className="max-w-md text-sm text-gray-500">
                  Run the RBAC seed script to create the default roles.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {roles.map((role) => {
                  const isSelected = role._id === selectedId;
                  return (
                    <li key={role._id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(role._id)}
                        className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
                          isSelected
                            ? "bg-indigo-50/80 dark:bg-indigo-500/10"
                            : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                        }`}
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                          <ShieldCheck className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2">
                            <NoTranslate as="span" className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                              {role.name}
                            </NoTranslate>
                            <RoleTag role={role} />
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-gray-400">
                            {role.description || "No description"}
                          </span>
                        </span>
                        <span className="hidden shrink-0 items-center gap-4 text-xs text-gray-500 sm:flex">
                          <span className="flex items-center gap-1">
                            <Users className="h-3.5 w-3.5" />
                            {role.userCount}
                          </span>
                          <span className="flex items-center gap-1">
                            <KeyRound className="h-3.5 w-3.5" />
                            {permissionCount(role)}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {selected && (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 bg-black/50 lg:hidden"
              aria-label="Close role details"
              onClick={() => setSelectedId(null)}
            />
            <aside className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-white dark:bg-gray-900 lg:static lg:inset-auto lg:z-auto lg:w-[420px] lg:shrink-0 lg:rounded-2xl lg:border lg:border-gray-200 lg:shadow-sm lg:dark:border-gray-800">
              <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-gray-100 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <NoTranslate as="p" className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                      {selected.name}
                    </NoTranslate>
                    <RoleTag role={selected} />
                  </div>
                  <p className="mt-1 text-xs text-gray-400">
                    {selected.userCount} user{selected.userCount === 1 ? "" : "s"} ·{" "}
                    {permissionCount(selected)} permissions
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                  aria-label="Close role details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5 p-5">
                {selected.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">{selected.description}</p>
                )}

                {(selected.editable || selected.deletable) && (
                  <div className="grid grid-cols-2 gap-2">
                    {selected.editable && (
                      <button
                        type="button"
                        onClick={() => openEditDialog(selected)}
                        className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-green-500"
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                    )}
                    {selected.deletable && (
                      <button
                        type="button"
                        onClick={() => {
                          setDeletingRole(selected);
                          setDeleteError("");
                          setDeleteOpen(true);
                        }}
                        className="flex items-center justify-center gap-2 rounded-xl bg-red-500 px-3 py-2.5 text-sm font-medium text-white hover:bg-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    )}
                  </div>
                )}
                {!selected.isSystem && selected.userCount > 0 && can("roles.delete") && (
                  <p className="text-xs text-gray-500">
                    Reassign this role&apos;s users before deleting it.
                  </p>
                )}

                <section>
                  <h3 className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">Permissions</h3>
                  {selected.isSuperAdmin ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                      Super admins always have every permission. This role cannot be changed.
                    </p>
                  ) : (
                    <PermissionPicker value={selected.permissions} readOnly />
                  )}
                </section>
              </div>
            </aside>
          </>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-gray-200 p-0 dark:border-gray-800 sm:max-w-2xl">
          <DialogHeader className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <DialogTitle className="text-lg">{editingRole ? "Edit Role" : "Add Role"}</DialogTitle>
            <DialogDescription>
              {editingRole
                ? "Changes apply to users assigned this role from now on. Existing users keep their permissions."
                : "Choose the permissions this role gives to users it is assigned to."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Senior Inspector"
                maxLength={50}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What this role is for"
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Permissions</p>
              <PermissionPicker
                value={form.permissions}
                onChange={(permissions) => setForm({ ...form, permissions })}
                canToggle={canGrant}
              />
            </div>

            {formError && <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>}

            <DialogFooter className="grid grid-cols-2 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : editingRole ? "Save Changes" : "Create Role"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl border-gray-200 dark:border-gray-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Role</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{deletingRole?.name}</strong>? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>}
          <DialogFooter className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-400 disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
