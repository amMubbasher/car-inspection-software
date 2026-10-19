"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  Pencil,
  Trash2,
  Users,
  X,
  User,
  Mail,
  Lock,
  Shield,
  KeyRound,
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
import type { SafeRole, SafeUser } from "@/lib/serializeUser";
import {
  createUserSchema,
  PASSWORD_MIN_LENGTH,
  updateUserSchema,
} from "@/lib/validations/userSchema";
import { usePermissions } from "@/components/rbac/PermissionsProvider";
import { PermissionPicker } from "@/components/rbac/PermissionPicker";
import type { Permission } from "@/lib/rbac/permissions";

type UserForm = {
  name: string;
  email: string;
  password: string;
  roleId: string;
};

const emptyForm: UserForm = {
  name: "",
  email: "",
  password: "",
  roleId: "",
};

const PAGE_SIZE = 10;

function roleLabel(role: SafeUser["role"]) {
  return role?.name ?? "No role";
}

function roleClass(role: SafeUser["role"]) {
  if (!role) return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
  if (role.key === "super-admin") {
    return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400";
  }
  return role.key === "admin"
    ? "bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400"
    : "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400";
}

function RoleBadge({ role }: { role: SafeUser["role"] }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${roleClass(role)}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {roleLabel(role)}
    </span>
  );
}

function pageList(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let pageNumber = start; pageNumber <= end; pageNumber += 1) pages.push(pageNumber);
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="text-gray-400 dark:text-gray-500">{icon}</span>
      <span className="flex-1 text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <NoTranslate className="text-right text-sm font-medium text-gray-900 dark:text-white">
        {value}
      </NoTranslate>
    </div>
  );
}

export default function UsersPage() {
  const { can, me, isSuperAdmin, reload: reloadMe } = usePermissions();
  const canCreate = can("users.create");
  const canEditProfile = can("users.edit");
  const canAssignRoles = can("users.assign_roles");
  const canManagePermissions = can("users.manage_permissions");
  const canDelete = can("users.delete");
  const myPermissions = new Set(me?.permissions ?? []);
  const canGrant = (permission: Permission) => isSuperAdmin || myPermissions.has(permission);

  const [roles, setRoles] = useState<SafeRole[]>([]);
  const [permissionDraft, setPermissionDraft] = useState<Permission[] | null>(null);
  const [isSavingPermissions, setIsSavingPermissions] = useState(false);
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [detailTab, setDetailTab] = useState<"profile" | "permissions">("profile");
  const [detailNotice, setDetailNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const fetchUsers = useCallback(
    async (currentPage = page) => {
      setIsRefreshing(true);
      try {
        const params = new URLSearchParams({
          page: currentPage.toString(),
          limit: String(PAGE_SIZE),
          ...(debouncedSearch && { search: debouncedSearch }),
        });
        const res = await fetch(`/api/users?${params}`, { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.details || "Failed to fetch users");
        }
        setUsers(data.users ?? []);
        setTotal(data.pagination?.total ?? 0);
        setTotalPages(data.pagination?.totalPages ?? 1);
      } catch (err) {
        setUsers([]);
        setTotal(0);
        setTotalPages(1);
        setAlert({
          type: "error",
          message: err instanceof Error ? err.message : "Failed to fetch users",
        });
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [debouncedSearch, page]
  );

  useEffect(() => {
    fetchUsers(page);
  }, [page, debouncedSearch, fetchUsers]);

  const canListRoles = can("roles.view") || canAssignRoles;
  useEffect(() => {
    if (!canListRoles) return;
    fetch("/api/roles", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { roles: [] }))
      .then((data) => setRoles(data.roles ?? []))
      .catch(() => setRoles([]));
  }, [canListRoles]);


  const openAddDialog = () => {
    setFormMode("add");
    setEditingUser(null);
    const defaultRole = roles.find((role) => role.key === "member" && role.assignable);
    setForm({ ...emptyForm, roleId: defaultRole?._id ?? "" });
    setFormError("");
    setFormOpen(true);
  };

  const openUser = (user: SafeUser) => {
    setSelectedId(user._id);
    setDetailTab("profile");
    setDetailNotice(null);
    setConfirmDelete(false);
    setPermissionDraft(null);
    setFormMode("edit");
    setEditingUser(user);
    setForm({
      name: user.name ?? "",
      email: user.email,
      password: "",
      roleId: user.role?._id ?? "",
    });
    setFormError("");
  };

  const closeUser = () => {
    setSelectedId(null);
    setEditingUser(null);
    setPermissionDraft(null);
    setConfirmDelete(false);
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      if (formMode === "add") {
        const parsed = createUserSchema.safeParse({
          name: form.name,
          email: form.email,
          password: form.password,
          ...(canAssignRoles && form.roleId ? { roleId: form.roleId } : {}),
        });
        if (!parsed.success) {
          setFormError(parsed.error.issues[0]?.message ?? "Validation failed");
          return;
        }

        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed.data),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.details || "Failed to create user");
        }
        setAlert({ type: "success", message: "User created successfully" });
        setFormOpen(false);
        setPage(1);
        fetchUsers(1);
      } else if (editingUser) {
        const roleChanged = form.roleId !== (editingUser.role?._id ?? "");
        const parsed = updateUserSchema.safeParse({
          ...(canEditProfile ? { name: form.name, email: form.email } : {}),
          ...(canEditProfile && form.password ? { password: form.password } : {}),
          ...(canAssignRoles && roleChanged && form.roleId ? { roleId: form.roleId } : {}),
        });
        if (!parsed.success) {
          setFormError(parsed.error.issues[0]?.message ?? "Validation failed");
          return;
        }

        const payload = parsed.data;
        const res = await fetch(`/api/users/${editingUser._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.details || "Failed to update user");
        }
        setDetailNotice({ type: "success", message: "Profile updated" });
        setEditingUser(data);
        setForm((prev) => ({ ...prev, password: "" }));
        fetchUsers(page);
        if (editingUser._id === me?.user._id) reloadMe();
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/users/${selected._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.details || "Failed to delete user");
      }
      setAlert({ type: "success", message: "User deleted successfully" });
      closeUser();
      const nextPage = users.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      fetchUsers(nextPage);
    } catch (err) {
      setDetailNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Something went wrong",
      });
      setConfirmDelete(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSavePermissions = async () => {
    if (!selected || !permissionDraft) return;
    setIsSavingPermissions(true);
    try {
      const res = await fetch(`/api/users/${selected._id}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: permissionDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update permissions");
      setDetailNotice({ type: "success", message: "Permissions updated" });
      setPermissionDraft(null);
      fetchUsers(page);
    } catch (err) {
      setDetailNotice({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to update permissions",
      });
    } finally {
      setIsSavingPermissions(false);
    }
  };

  const selected = users.find((user) => user._id === selectedId) ?? null;
  const isSelf = (user: SafeUser) => user._id === me?.user._id;
  const selectedRole = selected?.role ? roles.find((role) => role._id === selected.role?._id) : undefined;
  const canEditPermissionsOf = (user: SafeUser) =>
    canManagePermissions && Boolean(user.manageable) && !isSelf(user) && !user.isSuperAdmin;
  const editingRoleChanged =
    formMode === "edit" && !!editingUser && form.roleId !== (editingUser.role?._id ?? "");
  const canEditUser = (user: SafeUser) =>
    Boolean(user.manageable) && (canEditProfile || (canAssignRoles && !isSelf(user)));

  const userFields = (
    <>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <User className="h-4 w-4 text-gray-400" />
          Name
        </label>
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          disabled={formMode === "edit" && !canEditProfile}
          placeholder="John Doe"
          className="notranslate"
          translate="no"
          required
        />
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Mail className="h-4 w-4 text-gray-400" />
          Email
        </label>
        <Input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          disabled={formMode === "edit" && !canEditProfile}
          placeholder="user@example.com"
          className="notranslate"
          translate="no"
          required
        />
      </div>
      {(formMode === "add" || canEditProfile) && (
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Lock className="h-4 w-4 text-gray-400" />
          {formMode === "add" ? "Password" : "New Password"}
        </label>
        <Input
          type="password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder={formMode === "add" ? "••••••••" : "Leave blank to keep current"}
          required={formMode === "add"}
          minLength={formMode === "add" ? PASSWORD_MIN_LENGTH : undefined}
        />
        {form.password.length > 0 && form.password.length < PASSWORD_MIN_LENGTH && (
          <p className="text-xs text-red-600 dark:text-red-400">
            Password must be at least {PASSWORD_MIN_LENGTH} characters
          </p>
        )}
        {formMode === "edit" && form.password.length > 0 && (
          <p className="text-xs text-gray-500">The user will be signed out of all devices.</p>
        )}
      </div>
      )}
      {canAssignRoles && (
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
          <Shield className="h-4 w-4 text-gray-400" />
          Role
        </label>
        <select
          value={form.roleId}
          onChange={(e) => setForm({ ...form, roleId: e.target.value })}
          disabled={formMode === "edit" && !!editingUser && isSelf(editingUser)}
          className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 disabled:opacity-60 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        >
          {form.roleId === "" && <option value="">Select a role</option>}
          {roles.map((role) => (
            <option
              key={role._id}
              value={role._id}
              disabled={!role.assignable && role._id !== form.roleId}
            >
              {role.name}
              {!role.assignable ? " (not assignable)" : ""}
            </option>
          ))}
        </select>
        {formMode === "edit" && editingUser && isSelf(editingUser) && (
          <p className="text-xs text-gray-500">You cannot change your own role.</p>
        )}
        {editingRoleChanged && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            This will replace the user&apos;s permissions with the new role&apos;s defaults.
          </p>
        )}
      </div>
      )}
    </>
  );

  const rangeStart = users.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * PAGE_SIZE + users.length;

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page || isRefreshing) return;
    setPage(nextPage);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-950 md:p-6">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Create, edit, and manage team accounts
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => fetchUsers(page)}
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
                <UserPlus className="h-4 w-4" />
                Add User
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
            <div className="border-b border-gray-100 p-4 dark:border-gray-800">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by name or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-white pl-10 dark:bg-gray-900"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
                <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
                <p className="font-medium">Loading users...</p>
              </div>
            ) : users.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Users className="h-8 w-8 text-indigo-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No users found</h3>
                <p className="max-w-md text-sm text-gray-500">
                  Try adjusting your search or add a new user
                </p>
              </div>
            ) : (
              <>
                <div className="relative">
                  {isRefreshing && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-gray-900/70">
                      <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
                    </div>
                  )}
                  <ul className="divide-y divide-gray-100 dark:divide-gray-800 lg:hidden">
                    {users.map((user) => {
                      const isSelected = user._id === selectedId;
                      return (
                        <li key={user._id}>
                          <button
                            type="button"
                            onClick={() => openUser(user)}
                            className={`flex w-full items-center gap-3 px-4 py-3 text-left ${
                              isSelected ? "bg-indigo-50/80 dark:bg-indigo-500/10" : ""
                            }`}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                              <User className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <NoTranslate as="span" className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                  {user.name || "—"}
                                </NoTranslate>
                                <RoleBadge role={user.role} />
                              </span>
                              <NoTranslate as="span" className="mt-0.5 block truncate text-xs text-gray-400">
                                {user.email}
                              </NoTranslate>
                            </span>
                            <ChevronRight className="h-4 w-4 shrink-0 text-gray-300" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[640px] text-left">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-gray-800">
                        <th className="px-4 py-3 font-medium">Name</th>
                        <th className="px-4 py-3 font-medium">Email</th>
                        <th className="px-4 py-3 font-medium">Role</th>
                        <th className="w-10 px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((user) => {
                        const isSelected = user._id === selectedId;
                        return (
                          <tr
                            key={user._id}
                            onClick={() => openUser(user)}
                            className={`cursor-pointer border-b border-gray-50 transition-colors last:border-0 dark:border-gray-800/60 ${
                              isSelected
                                ? "bg-indigo-50/80 dark:bg-indigo-500/10"
                                : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                  <User className="h-4 w-4" />
                                </span>
                                <NoTranslate as="p" className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                  {user.name || "—"}
                                </NoTranslate>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <NoTranslate as="p" className="truncate text-sm text-gray-600 dark:text-gray-300">
                                {user.email}
                              </NoTranslate>
                            </td>
                            <td className="px-4 py-3">
                              <RoleBadge role={user.role} />
                            </td>
                            <td className="px-4 py-3 text-gray-300">
                              <ChevronRight className="h-4 w-4" />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>

                <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 sm:flex-row dark:border-gray-800">
                  <p className="text-sm text-gray-500">
                    Showing {rangeStart} to {rangeEnd} of {total} users
                  </p>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => goToPage(page - 1)}
                        disabled={page === 1 || isRefreshing}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      {pageList(page, totalPages).map((item, index) =>
                        item === "ellipsis" ? (
                          <span key={`ellipsis-${index}`} className="px-1 text-sm text-gray-400">
                            ...
                          </span>
                        ) : (
                          <button
                            key={item}
                            type="button"
                            onClick={() => goToPage(item)}
                            disabled={isRefreshing}
                            className={`h-8 min-w-8 rounded-lg px-2 text-sm disabled:opacity-40 ${
                              item === page
                                ? "bg-indigo-600 text-white"
                                : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                            }`}
                          >
                            {item}
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => goToPage(page + 1)}
                        disabled={page === totalPages || isRefreshing}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-40 dark:hover:bg-gray-800"
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="rounded-2xl border-gray-200 p-0 dark:border-gray-800 sm:max-w-md">
          <DialogHeader className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <DialogTitle className="text-lg">Add User</DialogTitle>
            <DialogDescription>
              Create a new account. The role&apos;s permissions are copied to the user.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4 px-5 py-4">
            {userFields}

            {formError && (
              <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
            )}

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
                {isSubmitting ? "Saving..." : "Create User"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selected} onOpenChange={(open) => !open && closeUser()}>
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden rounded-2xl border-gray-200 p-0 dark:border-gray-800 sm:max-w-2xl">
          {selected && (
            <>
              {/* Fixed header: always shows who is being edited */}
              <div className="shrink-0 border-b border-gray-100 dark:border-gray-800">
                <DialogHeader className="flex-row items-start gap-3 space-y-0 px-5 pb-3 pt-5 pr-12 text-left">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white">
                    {(selected.name || selected.email).charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <DialogTitle className="truncate text-lg">
                        <NoTranslate as="span">{selected.name || "—"}</NoTranslate>
                      </DialogTitle>
                      <RoleBadge role={selected.role} />
                      {isSelf(selected) && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          You
                        </span>
                      )}
                    </div>
                    <DialogDescription className="notranslate mt-0.5 truncate text-xs text-gray-400" translate="no">
                      {selected.email}
                    </DialogDescription>
                  </div>
                </DialogHeader>
                <div className="flex gap-1 px-5" role="tablist">
                  {(["profile", "permissions"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={detailTab === tab}
                      onClick={() => {
                        setDetailTab(tab);
                        setDetailNotice(null);
                      }}
                      className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                        detailTab === tab
                          ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                          : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
                      }`}
                    >
                      {tab === "profile" ? <User className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
                      {tab === "profile" ? "Profile" : "Permissions"}
                      {tab === "permissions" && permissionDraft && (
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="Unsaved changes" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {detailNotice && (
                <div
                  className={`mx-5 mt-4 flex shrink-0 items-start justify-between gap-3 rounded-xl border px-3 py-2 text-sm ${
                    detailNotice.type === "error"
                      ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-300"
                      : "border-green-200 bg-green-50 text-green-700 dark:border-green-900/40 dark:bg-green-900/20 dark:text-green-300"
                  }`}
                >
                  <p className="flex-1">{detailNotice.message}</p>
                  <button
                    type="button"
                    onClick={() => setDetailNotice(null)}
                    className="shrink-0 rounded-md p-0.5 opacity-70 hover:opacity-100"
                    aria-label="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              {/* Scrollable body */}
              {detailTab === "profile" ? (
                <form onSubmit={handleFormSubmit} className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                    {canEditUser(selected) ? (
                      userFields
                    ) : (
                      <section>
                        <DetailRow icon={<User className="h-4 w-4" />} label="Name" value={selected.name || "—"} />
                        <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={selected.email} />
                        <DetailRow icon={<Shield className="h-4 w-4" />} label="Role" value={roleLabel(selected.role)} />
                        <p className="mt-2 text-xs text-gray-500">
                          You don&apos;t have permission to edit this user.
                        </p>
                      </section>
                    )}
                    {formError && (
                      <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
                    {canDelete && selected.manageable && !isSelf(selected) ? (
                      confirmDelete ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm text-red-600 dark:text-red-400">Delete this user?</span>
                          <button
                            type="button"
                            onClick={handleDelete}
                            disabled={isDeleting}
                            className="rounded-xl bg-red-500 px-3 py-2 text-sm font-medium text-white hover:bg-red-400 disabled:opacity-50"
                          >
                            {isDeleting ? "Deleting..." : "Yes, delete"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDelete(false)}
                            className="rounded-xl px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(true)}
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete user
                        </button>
                      )
                    ) : (
                      <span />
                    )}
                    {canEditUser(selected) && (
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50"
                      >
                        <Pencil className="h-4 w-4" />
                        {isSubmitting ? "Saving..." : "Save Changes"}
                      </button>
                    )}
                  </div>
                </form>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
                    {selected.isSuperAdmin ? (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
                        Super admins always have every permission.
                      </p>
                    ) : (
                      <>
                        {isSelf(selected) ? (
                          <p className="mb-3 text-xs text-gray-500">You cannot change your own permissions.</p>
                        ) : !canEditPermissionsOf(selected) ? (
                          <p className="mb-3 text-xs text-gray-500">You don&apos;t have permission to change these.</p>
                        ) : (
                          <p className="mb-3 text-xs text-gray-500">
                            These belong to this user only. Changing them doesn&apos;t affect the role or other users.
                          </p>
                        )}
                        <PermissionPicker
                          value={permissionDraft ?? selected.permissions}
                          onChange={setPermissionDraft}
                          readOnly={!canEditPermissionsOf(selected)}
                          canToggle={canGrant}
                          roleDefaults={selectedRole?.permissions}
                        />
                      </>
                    )}
                  </div>
                  {canEditPermissionsOf(selected) && (
                    <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 px-5 py-3 dark:border-gray-800">
                      <button
                        type="button"
                        onClick={() => setPermissionDraft(null)}
                        disabled={!permissionDraft}
                        className="rounded-xl px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={handleSavePermissions}
                        disabled={!permissionDraft || isSavingPermissions}
                        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        {isSavingPermissions ? "Saving..." : "Save Permissions"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
