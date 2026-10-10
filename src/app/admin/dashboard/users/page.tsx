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
import type { SafeUser } from "@/lib/serializeUser";
import {
  createUserSchema,
  updateUserSchema,
} from "@/lib/validations/userSchema";

type UserForm = {
  name: string;
  email: string;
  password: string;
  role: "admin" | "team";
};

const emptyForm: UserForm = {
  name: "",
  email: "",
  password: "",
  role: "team",
};

const PAGE_SIZE = 10;

function roleLabel(role: SafeUser["role"]) {
  return role === "admin" ? "Administrator" : "Team Member";
}

function roleClass(role: SafeUser["role"]) {
  return role === "admin"
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

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<SafeUser | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

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

  const openAddDialog = () => {
    setFormMode("add");
    setEditingUser(null);
    setForm(emptyForm);
    setFormError("");
    setFormOpen(true);
  };

  const openEditDialog = (user: SafeUser) => {
    setFormMode("edit");
    setEditingUser(user);
    setForm({
      name: user.name ?? "",
      email: user.email,
      password: "",
      role: user.role,
    });
    setFormError("");
    setFormOpen(true);
  };

  const openDeleteDialog = (user: SafeUser) => {
    setDeletingUser(user);
    setDeleteError("");
    setDeleteOpen(true);
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    setIsSubmitting(true);

    try {
      if (formMode === "add") {
        const parsed = createUserSchema.safeParse(form);
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
        const parsed = updateUserSchema.safeParse({
          name: form.name,
          email: form.email,
          role: form.role,
          password: form.password || undefined,
        });
        if (!parsed.success) {
          setFormError(parsed.error.issues[0]?.message ?? "Validation failed");
          return;
        }

        const payload: Record<string, string> = {
          name: parsed.data.name ?? form.name.trim(),
          email: parsed.data.email,
          role: parsed.data.role,
        };
        if (parsed.data.password) payload.password = parsed.data.password;

        const res = await fetch(`/api/users/${editingUser._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.details || "Failed to update user");
        }
        setAlert({ type: "success", message: "User updated successfully" });
        setFormOpen(false);
        fetchUsers(page);
      }
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    setDeleteError("");
    setIsDeleting(true);

    try {
      const res = await fetch(`/api/users/${deletingUser._id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.details || "Failed to delete user");
      }
      setAlert({ type: "success", message: "User deleted successfully" });
      setDeleteOpen(false);
      if (selectedId === deletingUser._id) setSelectedId(null);
      const nextPage = users.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      fetchUsers(nextPage);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsDeleting(false);
    }
  };

  const selected = users.find((user) => user._id === selectedId) ?? null;
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
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Users</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Create, edit, and manage team accounts
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fetchUsers(page)}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={openAddDialog}
                className="flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
              >
                <UserPlus className="h-4 w-4" />
                Add User
              </button>
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
                <div className="relative overflow-x-auto">
                  {isRefreshing && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/70 dark:bg-gray-900/70">
                      <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
                    </div>
                  )}
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
                            onClick={() => setSelectedId(user._id)}
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

        {selected && (
          <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:w-[380px]">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-5 dark:border-gray-800">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                  <User className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <NoTranslate as="p" className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                      {selected.name || "—"}
                    </NoTranslate>
                    <RoleBadge role={selected.role} />
                  </div>
                  <NoTranslate as="p" className="mt-1 truncate text-xs text-gray-400">
                    {selected.email}
                  </NoTranslate>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                aria-label="Close user details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              <section>
                <h3 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">User Details</h3>
                <DetailRow icon={<User className="h-4 w-4" />} label="Name" value={selected.name || "—"} />
                <DetailRow icon={<Mail className="h-4 w-4" />} label="Email" value={selected.email} />
                <DetailRow icon={<Shield className="h-4 w-4" />} label="Role" value={roleLabel(selected.role)} />
              </section>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openEditDialog(selected)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-green-500"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => openDeleteDialog(selected)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-red-500 px-3 py-2.5 text-sm font-medium text-white hover:bg-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="rounded-2xl border-gray-200 p-0 dark:border-gray-800 sm:max-w-md">
          <DialogHeader className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <DialogTitle className="text-lg">
              {formMode === "add" ? "Add User" : "Edit User"}
            </DialogTitle>
            <DialogDescription>
              {formMode === "add"
                ? "Create a new team or admin account."
                : "Update user details. Leave password blank to keep the current one."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4 px-5 py-4">
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <User className="h-4 w-4 text-gray-400" />
                Name
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                placeholder="user@example.com"
                className="notranslate"
                translate="no"
                required
              />
            </div>
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
                minLength={formMode === "add" ? 6 : undefined}
              />
              {form.password.length > 0 && form.password.length < 6 && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  Password must be at least 6 characters
                </p>
              )}
            </div>
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Shield className="h-4 w-4 text-gray-400" />
                Role
              </label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as "admin" | "team" })
                }
                className="w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
              >
                <option value="team">Team Member</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

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
                {isSubmitting
                  ? "Saving..."
                  : formMode === "add"
                    ? "Create User"
                    : "Save Changes"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="rounded-2xl border-gray-200 dark:border-gray-800 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <strong>{deletingUser?.name || deletingUser?.email}</strong>? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          {deleteError && (
            <p className="text-sm text-red-600 dark:text-red-400">{deleteError}</p>
          )}

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
