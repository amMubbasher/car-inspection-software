"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
// import { FiUpload } from "react-icons/fi";
import { inspectionTabs } from "@/config/inspectionTabs";
import type { Job, Severity, InspectionType } from "@/types/job";
// import Image from "next/image";

export default function PostJobPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prevInspectionTypeRef = useRef<InspectionType | undefined>(undefined);
  const [form, setForm] = useState<Partial<Job>>({
    _id: "",
    carNumber: "",
    customerName: "",
    engineNumber: "",
    odometer: undefined,
    status: "pending",
    inspectionTabs: [],
  });

  // const uploadToCloudinary = async (file: File) => {
  //   const url = `https://api.cloudinary.com/v1_1/${process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}/image/upload`;
  //   const formData = new FormData();
  //   formData.append("file", file);
  //   formData.append(
  //     "upload_preset",
  //     process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || ""
  //   );

  //   const res = await fetch(url, { method: "POST", body: formData });
  //   if (!res.ok) throw new Error("Cloudinary upload failed");
  //   const data = await res.json();
  //   return data.secure_url as string;
  // };

  // const handleFileChange = async (
  //   tabKey: string,
  //   issueKey: string,
  //   files: FileList | null
  // ) => {
  //   if (!files) return;
  //   try {
  //     const uploadedUrls = await Promise.all(
  //       Array.from(files).map((file) => uploadToCloudinary(file))
  //     );
  //     setForm((prev) => ({
  //       ...prev,
  //       inspectionTabs: prev.inspectionTabs.map((tab) =>
  //         tab.key === tabKey
  //           ? {
  //               ...tab,
  //               subIssues: tab.subIssues.map((issue) =>
  //                 issue.key === issueKey
  //                   ? { ...issue, images: [...issue.images, ...uploadedUrls] }
  //                   : issue
  //               ),
  //             }
  //           : tab
  //       ),
  //     }));
  //   } catch (error) {
  //     console.error("Image upload failed", error);
  //   }
  // };

  // Update inspection tabs when inspection type changes
  useEffect(() => {
    if (form.inspectionType && prevInspectionTypeRef.current !== form.inspectionType) {
      // Filter tabs based on the selected inspection type
      const relevantTabs = inspectionTabs.filter((tab) => 
        tab.classification.includes(form.inspectionType || "")
      );
      
      // Create new tabs with default values
      const newTabs = relevantTabs.map((tab) => ({
        ...tab,
        subIssues: tab.subIssues.map((issue) => ({
          ...issue,
          severity: "ok" as Severity,
          comment: "",
        })),
      }));
      
      setForm((prev) => ({
        ...prev,
        inspectionTabs: newTabs,
      }));
      
      // Set active tab to the first relevant tab
      const firstTab = relevantTabs[0];
      if (firstTab) {
        setActiveTab(firstTab.key);
      }
      
      // Update the ref
      prevInspectionTypeRef.current = form.inspectionType;
    }
  }, [form.inspectionType]);

  const handleSubmit = async () => {
    // Validate required fields
    if (!form.carNumber) {
      alert("Please enter a car number");
      return;
    }
    if (!form.customerName) {
      alert("Please enter an inspector name");
      return;
    }
    if (!form.inspectionType) {
      alert("Please select an inspection type");
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const payload = {
        carNumber: form.carNumber,
        customerName: form.customerName,
        engineNumber: form.engineNumber,
        odometer: form.odometer,
        inspectionType: form.inspectionType,
        inspectionTabs: form.inspectionTabs,
        status: "pending",
      };
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        router.push("/admin/dashboard");
      } else {
        alert("Failed to submit job. Please try again.");
        setIsSubmitting(false);
      }
    } catch (error) {
      console.error("Error submitting job:", error);
      alert("An error occurred while submitting the job.");
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Job Details */}
      <div className="bg-white dark:bg-gray-800 rounded shadow p-4 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Job Details
        </h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Car Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Car Number"
            value={form.carNumber}
            onChange={(e) => setForm({ ...form, carNumber: e.target.value })}
            className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Inspector Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            placeholder="Inspector Name"
            value={form.customerName}
            onChange={(e) => setForm({ ...form, customerName: e.target.value })}
            className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Chassis Number
          </label>
          <input
            type="text"
            placeholder="Chassis Number"
            value={form.engineNumber}
            onChange={(e) => setForm({ ...form, engineNumber: e.target.value })}
            className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Odometer
          </label>
          <input
            type="number"
            placeholder="Odometer Reading"
            value={form.odometer || ""}
            onChange={(e) => setForm({ ...form, odometer: e.target.value ? Number(e.target.value) : undefined })}
            className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Inspection Type <span className="text-red-500">*</span>
          </label>
          <select
            value={form.inspectionType || ""}
            onChange={(e) => setForm({ ...form, inspectionType: e.target.value as InspectionType })}
            className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select Inspection Type</option>
            <option value="Chassis inspection">Chassis inspection</option>
            <option value="Paint inspection">Paint inspection</option>
            <option value="Paint and chassis inspection">Paint and chassis inspection</option>
            <option value="OBD inspection">OBD inspection</option>
            <option value="360 inspection">360 inspection</option>
            <option value="Auction Comprehensive Inspection">Auction Comprehensive Inspection</option>
          </select>
        </div>
      </div>
      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="mt-6 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-800 text-white px-4 py-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
      >
        {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
        {isSubmitting ? "Submitting..." : "Submit Job"}
      </button>
    </div>
  );
}
