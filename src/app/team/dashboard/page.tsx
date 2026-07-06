"use client";
import { useEffect, useState } from "react";
import JobCard from "@/components/JobCard";
import { motion, AnimatePresence } from "framer-motion";
import { RefreshCw, Wrench } from "lucide-react";
import { containerVariants, titleVariants } from "@/lib/animations";
export default function TeamDashboard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchJobs = async () => {
    try {
      setIsRefreshing(true);
      setLoading(true);
      const res = await fetch("/api/jobs");
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || "Failed to fetch jobs");
      }

      if (Array.isArray(data)) {
        setJobs(data);
      } else if (Array.isArray(data.jobs)) {
        setJobs(data.jobs);
      } else {
        setJobs([]);
      }
    } catch (error) {
      console.error("Failed to fetch jobs:", error);
      setJobs([]);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <motion.div
        initial="hidden"
        animate="show"
        variants={containerVariants}
        className="space-y-6"
      >
        {/* Header */}
        <motion.div
          variants={titleVariants}
          className="flex pb-3 flex-col md:flex-row justify-between gap-4"
        >
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-blue-600 bg-clip-text text-transparent">
              Available & Assigned Jobs
            </h2>
            <p className="text-muted-foreground">
              Your current workload and available tasks
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchJobs}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </motion.button>
        </motion.div>

        {/* Content */}
        {loading ? (
          <motion.div
            variants={titleVariants}
            className="flex flex-col items-center justify-center py-12 gap-4"
          >
            <div className="w-24 h-24 bg-gradient-to-r from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 rounded-full flex items-center justify-center">
              <RefreshCw className="w-10 h-10 text-green-500 dark:text-green-400 animate-spin" />
            </div>
            <h3 className="text-xl font-semibold">Loading jobs...</h3>
          </motion.div>
        ) : jobs.length === 0 ? (
          <motion.div
            variants={titleVariants}
            className="flex flex-col items-center justify-center py-12 gap-4 text-center"
          >
            <div className="w-24 h-24 bg-gradient-to-r from-green-100 to-blue-100 dark:from-green-900/30 dark:to-blue-900/30 rounded-full flex items-center justify-center">
              <Wrench className="w-10 h-10 text-green-500 dark:text-green-400" />
            </div>
            <h3 className="text-xl font-semibold">No jobs available</h3>
            <p className="text-muted-foreground max-w-md">
              {jobs.length === 0
                ? "No jobs found or access denied"
                : "All caught up! No tasks assigned"}
            </p>
          </motion.div>
        ) : (
          <motion.div
            variants={containerVariants}
            className="grid grid-cols-1 gap-4"
          >
            <AnimatePresence>
              {jobs.map((job: unknown) => (
                // @ts-ignore
                <JobCard key={job._id} job={job} refreshJobs={fetchJobs} />
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
