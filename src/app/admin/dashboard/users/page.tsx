"use client";

import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
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
import type { SafeUser } from "@/lib/serializeUser";
import {
  createUserSchema,
  updateUserSchema,
} from "@/lib/validations/userSchema";
import { containerVariants, titleVariants } from "@/lib/animations";

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

export default function UsersPage() {
  const [users, setUsers] = useState<SafeUser[]>([]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
          limit: "10",
          ...(debouncedSearch && { search: debouncedSearch }),
        });
        const res = await fetch(`/api/users?${params}`);
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

  const handleFormSubmit = async (e: React.FormEvent) => {
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
      const nextPage = users.length === 1 && page > 1 ? page - 1 : page;
      setPage(nextPage);
      fetchUsers(nextPage);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <motion.div
        initial="hidden"
        animate="show"
        variants={containerVariants}
        className="space-y-6"
      >
        <motion.div
          variants={titleVariants}
          className="flex flex-col md:flex-row justify-between gap-4"
        >
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              User Management
            </h2>
            <p className="text-muted-foreground">
              Create, edit, and manage team accounts
            </p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => fetchUsers(page)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={openAddDialog}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add User
            </motion.button>
          </div>
        </motion.div>

        {alert && (
          <motion.div
            variants={titleVariants}
            className={`flex items-start justify-between gap-3 p-4 rounded-lg border-l-4 ${
              alert.type === "error"
                ? "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-300"
                : "bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-300"
            }`}
          >
            <p className="flex-1">{alert.message}</p>
            <button
              type="button"
              onClick={() => setAlert(null)}
              className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100 transition-opacity"
              aria-label="Dismiss alert"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}

        <motion.div variants={titleVariants} className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm"
          />
        </motion.div>

        {isLoading ? (
          <motion.div
            variants={titleVariants}
            className="flex flex-col items-center justify-center py-12 gap-4"
          >
            <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
            <h3 className="text-xl font-semibold">Loading users...</h3>
          </motion.div>
        ) : users.length === 0 ? (
          <motion.div
            variants={titleVariants}
            className="flex flex-col items-center justify-center py-12 gap-4 text-center"
          >
            <Users className="w-10 h-10 text-muted-foreground" />
            <h3 className="text-xl font-semibold">No users found</h3>
            <p className="text-muted-foreground max-w-md">
              Try adjusting your search or add a new user
            </p>
          </motion.div>
        ) : (
          <>
            <motion.div
              variants={titleVariants}
              className="overflow-x-auto rounded-lg border bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm"
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left p-4 font-medium">Name</th>
                    <th className="text-left p-4 font-medium">Email</th>
                    <th className="text-left p-4 font-medium">Role</th>
                    <th className="text-right p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user._id}
                      className="border-b last:border-0 hover:bg-gray-50/50 dark:hover:bg-gray-800/30"
                    >
                      <td className="p-4 font-medium">{user.name || "—"}</td>
                      <td className="p-4 text-muted-foreground">{user.email}</td>
                      <td className="p-4">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.role === "admin"
                              ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                              : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                          }`}
                        >
                          {user.role === "admin" ? "Administrator" : "Team Member"}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => openEditDialog(user)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          <button
                            onClick={() => openDeleteDialog(user)}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>

            {totalPages > 1 && (
              <motion.div
                variants={titleVariants}
                className="flex items-center justify-between border-t pt-4"
              >
                <p className="text-sm text-muted-foreground">
                  Showing {users.length} of {total} users
                </p>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Previous
                  </motion.button>
                  <span className="text-sm px-4">
                    Page {page} of {totalPages}
                  </span>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex items-center gap-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </>
        )}
      </motion.div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {formMode === "add" ? "Add User" : "Edit User"}
            </DialogTitle>
            <DialogDescription>
              {formMode === "add"
                ? "Create a new team or admin account."
                : "Update user details. Leave password blank to keep the current one."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleFormSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="user@example.com"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
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
              <label className="text-sm font-medium">Role</label>
              <select
                value={form.role}
                onChange={(e) =>
                  setForm({ ...form, role: e.target.value as "admin" | "team" })
                }
                className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="team">Team Member</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            {formError && (
              <p className="text-sm text-red-600 dark:text-red-400">{formError}</p>
            )}

            <DialogFooter>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 transition-colors"
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
        <DialogContent className="sm:max-w-md">
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

          <DialogFooter>
            <button
              type="button"
              onClick={() => setDeleteOpen(false)}
              className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 transition-colors"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
