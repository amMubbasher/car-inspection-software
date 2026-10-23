"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Pencil, Percent, Plus, RefreshCw, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createVatSchema, updateVatSchema } from "@/lib/validations/vatSchema";
import type { SafeVat } from "@/lib/vat";

type VatForm = { name: string; registrationNumber: string; percentage: string; isActive: boolean };

const emptyForm: VatForm = { name: "", registrationNumber: "", percentage: "5", isActive: true };

export default function VatPage() {
  const { can } = usePermissions();
  const canManage = can("vat.manage");

  const [vats, setVats] = useState<SafeVat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SafeVat | null>(null);
  const [form, setForm] = useState<VatForm>(emptyForm);
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchVats = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/vat", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch VAT records");
      setVats(data.vats ?? []);
    } catch (err) {
      setAlert({ type: "error", message: err instanceof Error ? err.message : "Failed to fetch VAT records" });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVats();
  }, [fetchVats]);

  const openAdd = () => {
    setEditing(null);
    setForm({ ...emptyForm, isActive: vats.length === 0 });
    setFormError("");
    setFormOpen(true);
  };

  const openEdit = (vat: SafeVat) => {
    setEditing(vat);
    setForm({
      name: vat.name,
      registrationNumber: vat.registrationNumber,
      percentage: String(vat.percentage),
      isActive: vat.isActive,
    });
    setFormError("");
    setFormOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError("");
    const input = { ...form, percentage: form.percentage.trim() === "" ? undefined : form.percentage };
    const parsed = editing ? updateVatSchema.safeParse(input) : createVatSchema.safeParse(input);
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Validation failed");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(editing ? `/api/vat/${editing._id}` : "/api/vat", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save VAT record");
      setAlert({ type: "success", message: editing ? "VAT record updated" : "VAT record added" });
      setFormOpen(false);
      fetchVats();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSubmitting(false);
    }
  };

  const runAction = async (vat: SafeVat, request: RequestInit, success: string) => {
    setBusyId(vat._id);
    try {
      const res = await fetch(`/api/vat/${vat._id}`, request);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Something went wrong");
      setAlert({ type: "success", message: success });
      fetchVats();
    } catch (err) {
      setAlert({ type: "error", message: err instanceof Error ? err.message : "Something went wrong" });
    } finally {
      setBusyId(null);
    }
  };

  const setActive = (vat: SafeVat, isActive: boolean) =>
    runAction(
      vat,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      },
      isActive ? `${vat.name} is now the active VAT` : "VAT deactivated. New jobs will have no VAT."
    );

  const handleDelete = (vat: SafeVat) => {
    if (!confirm(`Delete VAT record "${vat.name}"? Existing receipts are not affected.`)) return;
    runAction(vat, { method: "DELETE" }, "VAT record deleted");
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-950 md:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">VAT</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              The active VAT is saved on each new job and shown on its receipt. Job prices include VAT.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={fetchVats}
              className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            {canManage && (
              <button
                type="button"
                onClick={openAdd}
                className="flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
              >
                <Plus className="h-4 w-4" />
                Add VAT
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
              <p className="font-medium">Loading VAT records...</p>
            </div>
          ) : vats.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Percent className="h-8 w-8 text-indigo-500" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No VAT records</h3>
              <p className="max-w-md text-sm text-gray-500">
                Receipts show no VAT until a VAT record is added and set as active.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {vats.map((vat) => (
                <li key={vat._id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-sm font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                    {Number(vat.percentage.toFixed(2))}%
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <NoTranslate as="p" className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                        {vat.name}
                      </NoTranslate>
                      {vat.isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-500/15 dark:text-green-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      )}
                    </div>
                    <NoTranslate as="p" className="mt-0.5 truncate text-xs text-gray-500">
                      TRN {vat.registrationNumber}
                    </NoTranslate>
                  </div>
                  {canManage && (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        disabled={busyId === vat._id}
                        onClick={() => setActive(vat, !vat.isActive)}
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        {vat.isActive ? "Deactivate" : "Set active"}
                      </button>
                      <button
                        type="button"
                        onClick={() => openEdit(vat)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
                        aria-label={`Edit ${vat.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={busyId === vat._id}
                        onClick={() => handleDelete(vat)}
                        className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-900/20"
                        aria-label={`Delete ${vat.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="rounded-2xl sm:max-w-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit VAT" : "Add VAT"}</DialogTitle>
              <DialogDescription>
                Changes apply to jobs created from now on. Existing jobs keep the VAT they were created with.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="vat-name">Name</Label>
              <Input
                id="vat-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Registered business name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat-trn">VAT registration number</Label>
              <Input
                id="vat-trn"
                value={form.registrationNumber}
                onChange={(e) => setForm({ ...form, registrationNumber: e.target.value })}
                placeholder="e.g. 100123456700003"
                translate="no"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat-percentage">VAT percentage</Label>
              <div className="relative">
                <Input
                  id="vat-percentage"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  value={form.percentage}
                  onChange={(e) => setForm({ ...form, percentage: e.target.value })}
                  className="pr-8"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">%</span>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4 rounded border-gray-300"
              />
              Active (used for new jobs)
            </label>
            {formError && <p className="text-sm text-red-600">{formError}</p>}
            <DialogFooter>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
