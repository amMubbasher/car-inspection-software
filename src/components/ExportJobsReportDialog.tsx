"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Columns3, Download, Loader2, Users, X } from "lucide-react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateRangeField } from "@/components/DateRangeField";
import { statusLabel } from "@/components/JobDetailsPanel";
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  normalizeExportColumns,
  UNASSIGNED_INSPECTOR,
  type ExportColumnKey,
} from "@/config/exportColumns";
import { NoTranslate } from "@/components/ui/NoTranslate";
import type { UserOption } from "@/lib/serializeUser";
import { localDayBound } from "@/lib/localDay";
import type { Job } from "@/types/job";
import { cn } from "@/lib/utils";

type ExportRow = Partial<Record<ExportColumnKey, string | number | null>>;

const COLUMNS_STORAGE_KEY = "jobs-export-columns";
const INSPECTORS_STORAGE_KEY = "jobs-export-inspectors";
/** Stored instead of a list when everyone is selected, so new inspectors are included. */
const ALL_INSPECTORS = "all";

type ChipOption = { value: string; label: string; hint?: string };

function userLabel(user: Pick<UserOption, "name" | "email">) {
  return user.name?.trim() || user.email;
}

function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function loadColumns(): ExportColumnKey[] {
  try {
    const stored = JSON.parse(localStorage.getItem(COLUMNS_STORAGE_KEY) ?? "null");
    if (Array.isArray(stored)) {
      const columns = normalizeExportColumns(stored);
      if (columns.length > 0) return columns;
    }
  } catch {
    // Storage unavailable or corrupted: fall back to the defaults.
  }
  return [...DEFAULT_EXPORT_COLUMNS];
}

function saveColumns(columns: ExportColumnKey[]) {
  try {
    localStorage.setItem(COLUMNS_STORAGE_KEY, JSON.stringify(columns));
  } catch {
    // Not persisting is acceptable; the export itself still works.
  }
}

function loadInspectors(available: string[]): string[] {
  try {
    const stored = JSON.parse(localStorage.getItem(INSPECTORS_STORAGE_KEY) ?? "null");
    if (Array.isArray(stored)) {
      const known = new Set(available);
      const saved = stored.filter((value): value is string => typeof value === "string" && known.has(value));
      if (saved.length > 0) return saved;
    }
  } catch {
    // Storage unavailable or corrupted: fall back to everyone.
  }
  return available;
}

function saveInspectors(selected: string[], total: number) {
  try {
    localStorage.setItem(
      INSPECTORS_STORAGE_KEY,
      JSON.stringify(selected.length === total ? ALL_INSPECTORS : selected)
    );
  } catch {
    // Not persisting is acceptable; the export itself still works.
  }
}

const labelOf = (key: ExportColumnKey) =>
  EXPORT_COLUMNS.find((column) => column.key === key)?.label ?? key;

function formatCell(key: ExportColumnKey, value: string | number | null | undefined) {
  if (value === null || value === undefined) return "";
  if (key === "createdAt" && typeof value === "string") {
    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  if (key === "status" && typeof value === "string" && value) {
    return statusLabel(value as Job["status"]);
  }
  return value;
}

function downloadExcel(columns: ExportColumnKey[], rows: ExportRow[], start: string, end: string) {
  const header = columns.map(labelOf);
  const body = rows.map((row) => columns.map((key) => formatCell(key, row[key])));
  const data: (string | number)[][] = [header, ...body];
  if (columns.includes("price")) {
    const total = rows.reduce((sum, row) => sum + (Number(row.price) || 0), 0);
    data.push(columns.map((key, index) => (key === "price" ? total : index === 0 ? "Total" : "")));
  }

  const worksheet = XLSX.utils.aoa_to_sheet(data);
  worksheet["!cols"] = columns.map((_, index) => ({
    wch: Math.min(40, Math.max(10, ...data.map((line) => String(line[index] ?? "").length + 2))),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Jobs");
  XLSX.writeFile(workbook, `jobs-${start}_to_${end}.xlsx`);
}

export function ExportJobsReportDialog({
  open,
  onOpenChange,
  users,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  users: UserOption[];
}) {
  const inspectorOptions = useMemo<ChipOption[]>(
    () => [
      ...[...users]
        .sort((a, b) =>
          userLabel(a).localeCompare(userLabel(b), undefined, { sensitivity: "base" })
        )
        .map((user) => ({
          value: user._id,
          label: userLabel(user),
          hint: user.name?.trim() ? user.email : undefined,
        })),
      { value: UNASSIGNED_INSPECTOR, label: "Unassigned" },
    ],
    [users]
  );
  const today = getLocalDateString();
  const wasOpen = useRef(false);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [columns, setColumns] = useState<ExportColumnKey[]>([...DEFAULT_EXPORT_COLUMNS]);
  const [inspectors, setInspectors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState("");

  useEffect(() => {
    if (open && !wasOpen.current) {
      const currentDay = getLocalDateString();
      setStartDate(currentDay);
      setEndDate(currentDay);
      setColumns(loadColumns());
      setError("");
      setResult("");
    }
    wasOpen.current = open;
  }, [open]);

  // Re-resolved whenever the user list loads, so saved ids of deleted users drop out
  // and "all" keeps including inspectors added since.
  useEffect(() => {
    if (open) setInspectors(loadInspectors(inspectorOptions.map((option) => option.value)));
  }, [open, inspectorOptions]);

  const updateColumns = (next: ExportColumnKey[]) => {
    const normalized = normalizeExportColumns(next);
    setColumns(normalized);
    saveColumns(normalized);
    setResult("");
  };

  const updateInspectors = (next: string[]) => {
    setInspectors(next);
    saveInspectors(next, inspectorOptions.length);
    setResult("");
  };

  const exportJobs = async () => {
    if (columns.length === 0) {
      setError("Select at least one column.");
      return;
    }
    if (inspectors.length === 0) {
      setError("Select at least one inspector.");
      return;
    }
    setIsLoading(true);
    setError("");
    setResult("");
    try {
      const params = new URLSearchParams({
        startDate: localDayBound(startDate, "start"),
        endDate: localDayBound(endDate, "end"),
        columns: columns.join(","),
      });
      // Leaving the filter out when everyone is selected also keeps unassigned jobs.
      if (inspectors.length < inspectorOptions.length) {
        params.set("inspectors", inspectors.join(","));
      }
      const res = await fetch(`/api/jobs/export?${params}`, { cache: "no-store" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(data?.rows)) {
        setError(data?.error || "Failed to export jobs.");
        return;
      }
      if (data.rows.length === 0) {
        setError("No jobs found in this date range.");
        return;
      }
      downloadExcel(columns, data.rows, startDate, endDate);
      setResult(
        data.truncated
          ? `Exported the first ${data.rows.length} jobs. Narrow the date range to get the rest.`
          : `Exported ${data.rows.length} job${data.rows.length === 1 ? "" : "s"}.`
      );
    } catch {
      setError("Failed to export jobs.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-gray-200 p-0 dark:border-gray-800 sm:max-w-2xl">
        <DialogHeader className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <DialogTitle>Export Jobs</DialogTitle>
          <DialogDescription>
            Download an Excel file of every job in the date range, with the columns you choose.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-5 py-4">
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Date range</p>
            <DateRangeField
              embedded
              start={startDate}
              end={endDate}
              onChange={(nextStart, nextEnd) => {
                setStartDate(nextStart);
                setEndDate(nextEnd);
                setResult("");
              }}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Inspectors</p>
            <ChipMultiSelect
              icon={<Users className="mt-1 h-4 w-4 shrink-0 text-gray-400" />}
              options={inspectorOptions}
              selected={inspectors}
              onChange={updateInspectors}
              placeholder="Select inspectors"
              allLabel="All inspectors"
              noun="inspectors"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Columns</p>
            <ChipMultiSelect
              icon={<Columns3 className="mt-1 h-4 w-4 shrink-0 text-gray-400" />}
              options={EXPORT_COLUMNS.map((column) => ({ value: column.key, label: column.label }))}
              selected={columns}
              onChange={(next) => updateColumns(next as ExportColumnKey[])}
              onReset={() => updateColumns([...DEFAULT_EXPORT_COLUMNS])}
              placeholder="Select columns"
              noun="columns"
            />
            <p className="text-xs text-gray-400">
              Your inspector and column choices are remembered on this device.
            </p>
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}
          {result && (
            <p className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-300">
              <Check className="h-4 w-4" />
              {result}
            </p>
          )}

          <button
            type="button"
            onClick={exportJobs}
            disabled={isLoading || columns.length === 0 || inspectors.length === 0}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {isLoading ? "Exporting..." : "Download Excel"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Dropdown of checkboxes; the selection is shown as removable chips. */
function ChipMultiSelect({
  icon,
  options,
  selected,
  onChange,
  onReset,
  placeholder,
  allLabel,
  noun,
}: {
  icon: ReactNode;
  options: ChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  onReset?: () => void;
  placeholder: string;
  /** When set, a full selection shows as this single chip instead of one per option. */
  allLabel?: string;
  noun: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const selectedSet = new Set(selected);
  const allSelected = options.length > 0 && options.every((option) => selectedSet.has(option.value));

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Keep option order stable no matter the click order.
  const emit = (next: Set<string>) =>
    onChange(options.filter((option) => next.has(option.value)).map((option) => option.value));

  const toggle = (value: string) => {
    const next = new Set(selectedSet);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    emit(next);
  };

  const chips = allLabel && allSelected
    ? [{ value: "__all", label: allLabel }]
    : options.filter((option) => selectedSet.has(option.value));

  return (
    <div ref={menuRef}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
        className="flex min-h-9 w-full cursor-pointer items-start gap-2 rounded-md border border-input bg-white px-3 py-1.5 text-left text-sm text-gray-900 dark:bg-gray-900 dark:text-white"
      >
        {icon}
        <span className="flex max-h-24 min-w-0 flex-1 flex-wrap gap-1.5 overflow-y-auto">
          {chips.length === 0 ? (
            <span className="py-0.5 text-gray-400">{placeholder}</span>
          ) : (
            chips.map((chip) => (
              <span
                key={chip.value}
                className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
              >
                <NoTranslate as="span">{chip.label}</NoTranslate>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    if (chip.value === "__all") onChange([]);
                    else toggle(chip.value);
                  }}
                  className="rounded-full hover:text-indigo-900 dark:hover:text-white"
                  aria-label={`Remove ${chip.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))
          )}
        </span>
        <ChevronDown
          className={cn("mt-1 h-4 w-4 shrink-0 text-gray-400 transition-transform", open && "rotate-180")}
        />
      </div>

      {open && (
        <div className="mt-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-xs text-gray-500">
              {selected.length} of {options.length} {noun} selected
            </p>
            <div className="flex items-center gap-3">
              {onReset && (
                <button
                  type="button"
                  onClick={onReset}
                  className="text-xs font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Reset
                </button>
              )}
              <button
                type="button"
                onClick={() => emit(new Set(allSelected ? [] : options.map((option) => option.value)))}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
              >
                {allSelected ? "Clear all" : "Select all"}
              </button>
            </div>
          </div>
          <div className="grid max-h-64 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2">
            {options.length === 0 ? (
              <p className="px-2 py-3 text-sm text-gray-500">Nothing to select</p>
            ) : (
              options.map((option) => {
                const checked = selectedSet.has(option.value);
                return (
                  <label
                    key={option.value}
                    className={cn(
                      "flex min-w-0 cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800",
                      checked && "bg-indigo-50/70 dark:bg-indigo-500/10"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(option.value)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 accent-indigo-600"
                    />
                    <span className="min-w-0">
                      <NoTranslate as="span" className="block truncate text-gray-900 dark:text-white">
                        {option.label}
                      </NoTranslate>
                      {option.hint && (
                        <NoTranslate as="span" className="block truncate text-[11px] text-gray-500">
                          {option.hint}
                        </NoTranslate>
                      )}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
