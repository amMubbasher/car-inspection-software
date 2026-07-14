"use client";

import { useEffect, useState } from "react";
import JobCard from "@/components/JobCard";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Filter,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Wrench,
} from "lucide-react";
import type { Job } from "@/types/job";
import { containerVariants, titleVariants } from "@/lib/animations";

function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

  const applyClientFilters = (
    jobList: Job[],
    query: string,
    status: string
  ) => {
    let result = jobList;

    if (query) {
      const lower = query.toLowerCase();
      result = result.filter(
        (job) =>
          job.carNumber.toLowerCase().includes(lower) ||
          job.customerName.toLowerCase().includes(lower)
      );
    }

    if (status) {
      if (status === "rejected") {
        result = result.filter((job) => job.rejectionNote?.length);
      } else if (status === "completed") {
        result = result.filter(
          (job) => job.status === "completed" || job.status === "accepted"
        );
      } else {
        result = result.filter((job) => job.status === status);
      }
    }

    return result;
  };

  const fetchJobs = async (currentPage = page) => {
    try {
      setIsRefreshing(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      });
      const res = await fetch(`/api/jobs?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to fetch jobs");
      }

      const fetchedJobs: Job[] = data.jobs ?? [];
      setJobs(fetchedJobs);
      setFiltered(applyClientFilters(fetchedJobs, searchQuery, statusFilter));
      setTotal(data.pagination?.total ?? fetchedJobs.length);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
      setJobs([]);
      setFiltered([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setIsRefreshing(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    fetchJobs(1);
    setPage(1);
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
            <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              All Jobs
            </h2>
            <p className="text-muted-foreground">
              Browse, filter, and manage your assigned tasks
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => fetchJobs(page)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </motion.button>
        </motion.div>

        <motion.div
          variants={titleVariants}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 pb-2 gap-4"
        >
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="pl-10 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="pl-10 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm"
            />
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by car or customer..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-10 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm"
            />
          </div>

          <Select
            value={statusFilter || "all"}
            onValueChange={(value) => handleStatus(value)}
          >
            <SelectTrigger className="bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <SelectValue placeholder="Filter by status" />
              </div>
            </SelectTrigger>
            <SelectContent className="backdrop-blur-sm bg-white/80 dark:bg-gray-900/80">
              <SelectItem value="all">All Jobs</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="accepted">Accepted</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {isInitialLoad ? (
          <motion.div
            variants={titleVariants}
            className="flex flex-col items-center justify-center py-12 gap-4"
          >
            <div className="w-24 h-24 bg-gradient-to-r from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 rounded-full flex items-center justify-center">
              <RefreshCw className="w-10 h-10 text-green-500 dark:text-green-400 animate-spin" />
            </div>
            <h3 className="text-xl font-semibold">Loading jobs...</h3>
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div
            variants={titleVariants}
            className="flex flex-col items-center justify-center py-12 gap-4 text-center"
          >
            <div className="w-24 h-24 bg-gradient-to-r from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 rounded-full flex items-center justify-center">
              <Wrench className="w-10 h-10 text-green-500 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold">No jobs found</h3>
            <p className="text-muted-foreground max-w-md">
              Try adjusting your search or filter to find what you are looking
              for
            </p>
          </motion.div>
        ) : (
          <>
            <motion.div
              variants={containerVariants}
              className="grid grid-cols-1 gap-4"
            >
              <AnimatePresence>
                {filtered.map((job) => (
                  <JobCard
                    key={job._id}
                    job={job}
                    refreshJobs={() => fetchJobs(page)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>

            {totalPages > 1 && (
              <motion.div
                variants={titleVariants}
                className="flex items-center justify-between border-t pt-4"
              >
                <p className="text-sm text-muted-foreground">
                  Showing {filtered.length} of {total} jobs
                </p>
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      const newPage = page - 1;
                      setPage(newPage);
                      fetchJobs(newPage);
                    }}
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
                    onClick={() => {
                      const newPage = page + 1;
                      setPage(newPage);
                      fetchJobs(newPage);
                    }}
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
    </div>
  );
}
