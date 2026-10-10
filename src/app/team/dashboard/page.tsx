"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calendar,
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
import JobDetailsPanel, {
  formatJobDate,
  JobStatusBadge,
} from "@/components/JobDetailsPanel";
import { NoTranslate } from "@/components/ui/NoTranslate";
import { localDayBound } from "@/lib/localDay";
import type { Job } from "@/types/job";

const PAGE_SIZE = 10;

function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function applyClientFilters(jobList: Job[], query: string, status: string) {
  let result = jobList;

  if (query) {
    const q = query.toLowerCase();
    result = result.filter(
      (job) =>
        job.carNumber.toLowerCase().includes(q) ||
        job.customerName.toLowerCase().includes(q) ||
        (job.customerPhone ?? "").toLowerCase().includes(q) ||
        (job.engineNumber ?? "").toLowerCase().includes(q)
    );
  }

  if (status === "rejected") {
    result = result.filter((job) => (job.rejectionNote?.length ?? 0) > 0);
  } else if (status === "completed") {
    result = result.filter(
      (job) => job.status === "completed" || job.status === "accepted"
    );
  } else if (status) {
    result = result.filter((job) => job.status === status);
  }

  return result;
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

export default function TeamDashboard() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [filtered, setFiltered] = useState<Job[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const today = getLocalDateString();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fetchRequestId = useRef(0);

  const fetchJobs = async (currentPage = page, query = searchQuery, status = statusFilter) => {
    const requestId = ++fetchRequestId.current;
    setIsRefreshing(true);
    const params = new URLSearchParams({
      page: currentPage.toString(),
      limit: String(PAGE_SIZE),
      ...(startDate && { startDate: localDayBound(startDate, "start") }),
      ...(endDate && { endDate: localDayBound(endDate, "end") }),
    });
    try {
      const res = await fetch(`/api/jobs?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (requestId !== fetchRequestId.current) return;
      if (!res.ok || !Array.isArray(data.jobs)) return;

      const fetchedJobs: Job[] = data.jobs;
      setJobs(fetchedJobs);
      setFiltered(applyClientFilters(fetchedJobs, query, status));
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
    // Dates are server filters. Search and status are reapplied inside fetchJobs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setFiltered(applyClientFilters(jobs, query, statusFilter));
  };

  const handleStatus = (status: string) => {
    const value = status === "all" ? "" : status;
    setStatusFilter(value);
    setFiltered(applyClientFilters(jobs, searchQuery, value));
  };

  const selected = jobs.find((job) => job._id === selectedId) ?? null;
  const rangeStart = filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = (page - 1) * PAGE_SIZE + filtered.length;

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
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">All Jobs</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage and monitor all service requests
              </p>
            </div>
            <button
              type="button"
              onClick={() => fetchJobs(page)}
              className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex flex-col gap-3 border-b border-gray-100 p-4 dark:border-gray-800 lg:flex-row lg:items-center">
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-white pl-10 dark:bg-gray-900 lg:w-[150px]"
                />
              </div>
              <span className="hidden text-gray-300 lg:inline">-</span>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-white pl-10 dark:bg-gray-900 lg:w-[150px]"
                />
              </div>
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Search by car number, inspector or chassis number..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="bg-white pl-10 dark:bg-gray-900"
                />
              </div>
              <Select value={statusFilter || "all"} onValueChange={handleStatus}>
                <SelectTrigger className="w-full bg-white dark:bg-gray-900 lg:w-[180px]">
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
            </div>

            {isInitialLoad ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-gray-500">
                <RefreshCw className="h-8 w-8 animate-spin text-indigo-500" />
                <p className="font-medium">Loading jobs...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Search className="h-8 w-8 text-indigo-500" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No jobs found</h3>
                <p className="max-w-md text-sm text-gray-500">
                  Try adjusting your search or filter to find what you are looking for
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
                      {filtered.map((job) => {
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
                                <NoTranslate as="p" className="truncate text-sm font-medium text-gray-900 dark:text-white">
                                  {job.customerName}
                                </NoTranslate>
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
    </div>
  );
}
