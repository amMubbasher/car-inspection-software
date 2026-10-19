"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, Loader2, Users } from "lucide-react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateRangeField } from "@/components/DateRangeField";
import { NoTranslate } from "@/components/ui/NoTranslate";
import { localDayBound } from "@/lib/localDay";
import type { UserOption } from "@/lib/serializeUser";
import { cn } from "@/lib/utils";

type ReportRow = {
  userId: string;
  name: string;
  email: string;
  jobCount: number;
  totalPrice: number;
};

function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function userLabel(user: Pick<UserOption, "name" | "email">) {
  return user.name?.trim() || user.email;
}

function downloadExcel(
  rows: ReportRow[],
  totals: { jobCount: number; totalPrice: number },
  start: string,
  end: string
) {
  const data = [
    ["Inspector", "Email", "Jobs Created", "Total Price"],
    ...rows.map((row) => [
      row.name || row.email,
      row.email,
      row.jobCount,
      row.totalPrice,
    ]),
    ["Total", "", totals.jobCount, totals.totalPrice],
  ];
  const worksheet = XLSX.utils.aoa_to_sheet(data);
  worksheet["!cols"] = [
    { wch: 24 },
    { wch: 32 },
    { wch: 14 },
    { wch: 14 },
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Jobs Report");
  XLSX.writeFile(workbook, `jobs-report-${start}_to_${end}.xlsx`);
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
  const today = getLocalDateString();
  const wasOpen = useRef(false);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [totals, setTotals] = useState({ jobCount: 0, totalPrice: 0 });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasGenerated, setHasGenerated] = useState(false);
  const [usersOpen, setUsersOpen] = useState(false);
  const usersMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !wasOpen.current) {
      const currentDay = getLocalDateString();
      setStartDate(currentDay);
      setEndDate(currentDay);
      setSelectedIds(users.map((user) => user._id));
      setRows([]);
      setTotals({ jobCount: 0, totalPrice: 0 });
      setError("");
      setHasGenerated(false);
      setUsersOpen(false);
    }
    wasOpen.current = open;
  }, [open, users]);

  useEffect(() => {
    if (!open || selectedIds.length > 0 || users.length === 0) return;
    setSelectedIds(users.map((user) => user._id));
  }, [open, users, selectedIds.length]);

  useEffect(() => {
    if (!usersOpen) return;
    const onPointer = (event: MouseEvent) => {
      if (!usersMenuRef.current?.contains(event.target as Node)) {
        setUsersOpen(false);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setUsersOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [usersOpen]);

  const allSelected = users.length > 0 && selectedIds.length === users.length;

  const sortedUsers = useMemo(
    () =>
      [...users].sort((a, b) =>
        userLabel(a).localeCompare(userLabel(b), undefined, { sensitivity: "base" })
      ),
    [users]
  );

  const toggleUser = (userId: string) => {
    setSelectedIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const generateReport = async () => {
    if (selectedIds.length === 0) {
      setError("Select at least one inspector.");
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        startDate: localDayBound(startDate, "start"),
        endDate: localDayBound(endDate, "end"),
        userIds: selectedIds.join(","),
      });
      const res = await fetch(`/api/jobs/report?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !Array.isArray(data.rows)) {
        setError(data.error || "Failed to generate report.");
        return;
      }
      setRows(data.rows);
      setTotals(data.totals || { jobCount: 0, totalPrice: 0 });
      setHasGenerated(true);
    } catch {
      setError("Failed to generate report.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-gray-200 p-0 dark:border-gray-800 sm:max-w-3xl">
        <DialogHeader className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <DialogTitle>Export Report</DialogTitle>
          <DialogDescription>
            Jobs created by each selected inspector, with job count and total price for the date range.
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
                setHasGenerated(false);
              }}
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Inspectors</p>
            <div className="relative" ref={usersMenuRef}>
              <button
                type="button"
                aria-expanded={usersOpen}
                onClick={() => setUsersOpen((value) => !value)}
                className="flex h-9 w-full items-center gap-2 rounded-md border border-input bg-white px-3 text-left text-sm text-gray-900 dark:bg-gray-900 dark:text-white"
              >
                <Users className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="min-w-0 flex-1 truncate">
                  Selected {selectedIds.length}/{users.length} inspectors
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-gray-400 transition-transform",
                    usersOpen && "rotate-180"
                  )}
                />
              </button>

              {usersOpen && (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-900">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <p className="text-xs text-gray-500">
                      {selectedIds.length} of {users.length} selected
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedIds(allSelected ? [] : users.map((user) => user._id))
                      }
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-500"
                    >
                      {allSelected ? "Clear all" : "Select all"}
                    </button>
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {sortedUsers.length === 0 ? (
                      <p className="px-2 py-3 text-sm text-gray-500">No inspectors available</p>
                    ) : (
                      <div className="grid grid-cols-2 gap-1.5">
                        {sortedUsers.map((user) => {
                          const checked = selectedIds.includes(user._id);
                          return (
                            <label
                              key={user._id}
                              className={cn(
                                "flex min-w-0 cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800",
                                checked && "bg-indigo-50/70 dark:bg-indigo-500/10"
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleUser(user._id)}
                                className="mt-0.5 h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                              />
                              <span className="min-w-0">
                                <NoTranslate
                                  as="span"
                                  className="block truncate text-xs font-medium text-gray-900 dark:text-white"
                                >
                                  {userLabel(user)}
                                </NoTranslate>
                                {user.name?.trim() && (
                                  <NoTranslate
                                    as="span"
                                    className="block truncate text-[11px] text-gray-500"
                                  >
                                    {user.email}
                                  </NoTranslate>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={generateReport}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              {isLoading ? "Generating..." : "Generate report"}
            </button>
            {hasGenerated && (
              <button
                type="button"
                onClick={() => downloadExcel(rows, totals, startDate, endDate)}
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <Download className="h-4 w-4" />
                Download Excel
              </button>
            )}
          </div>

          {hasGenerated && (
            <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                    <tr>
                      <th className="px-4 py-3">Inspector</th>
                      <th className="px-4 py-3">Jobs created</th>
                      <th className="px-4 py-3 text-right">Total price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {rows.map((row) => (
                      <tr key={row.userId}>
                        <td className="px-4 py-3">
                          <NoTranslate as="span" className="block font-medium text-gray-900 dark:text-white">
                            {row.name || row.email}
                          </NoTranslate>
                          {row.name && (
                            <NoTranslate as="span" className="block text-xs text-gray-500">
                              {row.email}
                            </NoTranslate>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-700 dark:text-gray-200">{row.jobCount}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                          {row.totalPrice}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 font-semibold dark:bg-gray-800">
                    <tr>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">Total</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">{totals.jobCount}</td>
                      <td className="px-4 py-3 text-right text-gray-900 dark:text-white">
                        {totals.totalPrice}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
