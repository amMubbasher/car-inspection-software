"use client";

import { useEffect, useRef, useState } from "react";
import {
  Car,
  ChevronLeft,
  ChevronRight,
  Filter,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangeField } from "@/components/DateRangeField";
import { ExportJobsReportDialog } from "@/components/ExportJobsReportDialog";
import { UserAutocomplete } from "@/components/UserAutocomplete";
import JobDetailsPanel, {
  formatJobDate,
  JobStatusBadge,
} from "@/components/JobDetailsPanel";
import { NoTranslate } from "@/components/ui/NoTranslate";
import { localDayBound } from "@/lib/localDay";
import type { Job } from "@/types/job";
import type { UserOption } from "@/lib/serializeUser";
import { usePermissions } from "@/components/rbac/PermissionsProvider";

const PAGE_SIZE = 10;

function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function inspectorLabel(job: Job) {
  const assignee = job.assignedTo;
  return assignee && typeof assignee === "object"
    ? assignee.name?.trim() || assignee.email
    : "";
}

function pageList(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages: (number | "ellipsis")[] = [1];
  if (current > 3) pages.push("ellipsis");
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (current < total - 2) pages.push("ellipsis");
  pages.push(total);
  return pages;
}

export default function Dashboard() {
  const { can, loading: permissionsLoading } = usePermissions();
  const canFilterByUser = can("jobs.filter_by_user");
  const canExport = can("reports.export");
  const canViewAll = can("jobs.view_all");
  const canViewJobs = canViewAll || can("jobs.view_own");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const today = getLocalDateString();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [inspectorId, setInspectorId] = useState("");
  const [users, setUsers] = useState<UserOption[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const fetchRequestId = useRef(0);

  useEffect(() => {
    if (!canFilterByUser && !canExport) return;
    fetch("/api/users/options")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => setUsers(data.users ?? []))
      .catch(() => setUsers([]));
  }, [canFilterByUser, canExport]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchJobs = async (currentPage = page) => {
    const requestId = ++fetchRequestId.current;
    setIsRefreshing(true);
    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: String(PAGE_SIZE),
      ...(startDate && { startDate: localDayBound(startDate, "start") }),
      ...(endDate && { endDate: localDayBound(endDate, "end") }),
      ...(inspectorId && canFilterByUser && { assignedTo: inspectorId }),
      ...(debouncedSearch && { q: debouncedSearch }),
      ...(statusFilter && { status: statusFilter }),
    });
    try {
      const res = await fetch(`/api/jobs?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (requestId !== fetchRequestId.current) return;
      if (!res.ok || !Array.isArray(data.jobs)) return;

      const fetchedJobs: Job[] = data.jobs;
      setJobs(fetchedJobs);
      setTotal(data.pagination?.total ?? fetchedJobs.length);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
    } finally {
      if (requestId === fetchRequestId.current) {
        setIsRefreshing(false);
        setIsInitialLoad(false);
      }
    }
  };

  useEffect(() => {
    fetchJobs(1);
    setPage(1);
    // All filters run on the server so search and status cover every page, not just this one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, inspectorId, debouncedSearch, statusFilter]);

  const handleStatus = (status: string) => setStatusFilter(status === "all" ? "" : status);

  const selected = jobs.find((job) => job._id === selectedId) ?? null;
  const rangeStart = jobs.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * PAGE_SIZE + jobs.length;

  const goToPage = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    setPage(nextPage);
    fetchJobs(nextPage);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-950 md:p-6">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 lg:flex-row lg:items-start">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {canViewAll ? "All Jobs" : "My Jobs"}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {canViewAll
                  ? "Manage and monitor all service requests"
                  : "Jobs you created or are assigned to"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {canExport && (
              <button
                type="button"
                onClick={() => setExportOpen(true)}
                className="flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
              >
                Export Report
              </button>
              )}
              <button
                type="button"
                onClick={() => fetchJobs(page)}
                className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-2 border-b border-gray-100 p-3 dark:border-gray-800 sm:p-4 lg:flex-row lg:items-center lg:gap-3">
              <DateRangeField
                start={startDate}
                end={endDate}
                onChange={(nextStart, nextEnd) => {
                  setStartDate(nextStart);
                  setEndDate(nextEnd);
                }}
              />
              <div className="relative min-w-0 lg:flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search car, phone, inspector or chassis"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-white pl-10 text-sm dark:bg-gray-900"
                />
              </div>
              <Select value={statusFilter || "all"} onValueChange={handleStatus}>
                <SelectTrigger className="w-full bg-white text-sm dark:bg-gray-900 lg:w-[180px]">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-gray-400" />
                    <SelectValue placeholder="Filter by status" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Jobs</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
              {canFilterByUser && (
                <UserAutocomplete users={users} value={inspectorId} onChange={setInspectorId} />
              )}
            </div>

            {!permissionsLoading && !canViewJobs ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No access to jobs</h3>
                <p className="max-w-md text-sm text-gray-500">
                  Your account does not have permission to view jobs. Contact an administrator.
                </p>
              </div>
            ) : isInitialLoad ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
                <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
                <p className="font-medium">Loading jobs...</p>
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Search className="h-8 w-8 text-indigo-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No jobs found</h3>
                <p className="max-w-md text-sm text-gray-500">
                  Try adjusting your search or filter to find what you are looking for
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
                    {jobs.map((job) => {
                      const when = formatJobDate(job.createdAt);
                      const isSelected = job._id === selectedId;
                      return (
                        <li key={job._id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(job._id)}
                            className={`flex w-full items-start gap-3 px-4 py-3 text-left ${
                              isSelected ? "bg-indigo-50/80 dark:bg-indigo-500/10" : ""
                            }`}
                          >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                              <Car className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-start justify-between gap-2">
                                <NoTranslate as="span" className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                  {job.carNumber}
                                </NoTranslate>
                                <JobStatusBadge status={job.status} />
                              </span>
                              {job.customerPhone && (
                                <NoTranslate as="span" className="mt-0.5 block truncate text-xs text-gray-400">
                                  {job.customerPhone}
                                </NoTranslate>
                              )}
                              <NoTranslate as="span" className="mt-1 block truncate text-sm text-gray-600 dark:text-gray-300">
                                {inspectorLabel(job) || "Unassigned"}
                              </NoTranslate>
                              <span className="mt-0.5 block truncate text-xs text-gray-400">
                                {job.inspectionType || "-"}
                                {when.date ? ` · ${when.date}` : ""}
                                {when.time ? ` ${when.time}` : ""}
                              </span>
                            </span>
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-gray-300" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="hidden overflow-x-auto lg:block">
                  <table className="w-full min-w-[760px] text-left">
                    <thead>
                      <tr className="border-b border-gray-100 text-xs font-medium uppercase tracking-wide text-gray-400 dark:border-gray-800">
                        <th className="px-4 py-3 font-medium">Car Number</th>
                        <th className="px-4 py-3 font-medium">Inspector</th>
                        <th className="px-4 py-3 font-medium">Inspection Type</th>
                        <th className="px-4 py-3 font-medium">Date & Time</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="w-10 px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job) => {
                        const when = formatJobDate(job.createdAt);
                        const isSelected = job._id === selectedId;
                        return (
                          <tr
                            key={job._id}
                            onClick={() => setSelectedId(job._id)}
                            className={`cursor-pointer border-b border-gray-50 transition-colors last:border-0 dark:border-gray-800/60 ${
                              isSelected
                                ? "bg-indigo-50/80 dark:bg-indigo-500/10"
                                : "hover:bg-gray-50 dark:hover:bg-gray-800/40"
                            }`}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                  <Car className="h-4 w-4" />
                                </span>
                                <div className="min-w-0">
                                  <NoTranslate as="p" className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                    {job.carNumber}
                                  </NoTranslate>
                                  {job.customerPhone && (
                                    <NoTranslate as="p" className="truncate text-xs text-gray-400">
                                      {job.customerPhone}
                                    </NoTranslate>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                  <User className="h-4 w-4" />
                                </span>
                                {inspectorLabel(job) ? (
                                  <NoTranslate as="p" className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                    {inspectorLabel(job)}
                                  </NoTranslate>
                                ) : (
                                  <p className="text-sm text-gray-400">Unassigned</p>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                              {job.inspectionType || "-"}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-gray-700 dark:text-gray-200">{when.date}</p>
                              <p className="text-xs text-gray-400">{when.time}</p>
                            </td>
                            <td className="px-4 py-3">
                              <JobStatusBadge status={job.status} />
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
                    Showing {rangeStart} to {rangeEnd} of {total} jobs
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
          <JobDetailsPanel
            key={selected._id}
            job={selected}
            onClose={() => setSelectedId(null)}
            refreshJobs={() => fetchJobs(page)}
          />
        )}
      </div>

      {canExport && (
        <ExportJobsReportDialog
          open={exportOpen}
          onOpenChange={setExportOpen}
          users={users}
        />
      )}
    </div>
  );
}
