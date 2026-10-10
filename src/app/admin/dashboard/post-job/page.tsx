"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
// import { FiUpload } from "react-icons/fi";
import { inspectionTabs } from "@/config/inspectionTabs";
import type { Job, Severity, InspectionType } from "@/types/job";
// import Image from "next/image";

export default function PostJobPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const prevInspectionTypeRef = useRef<InspectionType | undefined>(undefined);
  const [form, setForm] = useState<Partial<Job>>({
    _id: "",
    carNumber: "",
    customerPhone: "",
    engineNumber: "",
    odometer: undefined,
    status: "pending",
    price: 0,
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
    if (!form.inspectionType) {
      alert("Please select an inspection type");
      return;
    }
    
    setIsSubmitting(true);
    setSubmitError("");
    
    try {
      const payload = {
        carNumber: form.carNumber,
        customerPhone: form.customerPhone,
        engineNumber: form.engineNumber,
        odometer: form.odometer,
        inspectionType: form.inspectionType,
        price: form.price ?? 0,
        inspectionTabs: form.inspectionTabs,
        status: "pending",
      };
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        router.push(
          session?.user?.role === "team" ? "/team/dashboard" : "/admin/dashboard"
        );
        return;
      }
      const details =
        data?.details && typeof data.details === "string" ? data.details : "";
      setSubmitError(details || data?.error || "Failed to submit job. Please try again.");
      setIsSubmitting(false);
    } catch (error) {
      console.error("Error submitting job:", error);
      setSubmitError("An error occurred while submitting the job.");
      setIsSubmitting(false);
    }
  };

  const fieldClass =
    "notranslate w-full rounded-md border border-gray-300 bg-white p-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white";

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-950 md:p-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Post Job</h2>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">
            Job Details
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Car Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                placeholder="Car Number"
                value={form.carNumber}
                onChange={(e) => setForm({ ...form, carNumber: e.target.value })}
                className={fieldClass}
                translate="no"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Customer Phone
              </label>
              <input
                type="tel"
                placeholder="Customer Phone Number"
                value={form.customerPhone}
                onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                className={fieldClass}
                translate="no"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Chassis Number
              </label>
              <input
                type="text"
                placeholder="Chassis Number"
                value={form.engineNumber}
                onChange={(e) => setForm({ ...form, engineNumber: e.target.value })}
                className={fieldClass}
                translate="no"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Odometer
              </label>
              <input
                type="number"
                placeholder="Odometer Reading"
                value={form.odometer || ""}
                onChange={(e) => setForm({ ...form, odometer: e.target.value ? Number(e.target.value) : undefined })}
                className={fieldClass}
                translate="no"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Price
              </label>
              <input
                type="number"
                min={0}
                step={1}
                placeholder="0"
                value={form.price ?? 0}
                onChange={(e) =>
                  setForm({
                    ...form,
                    price: Math.max(0, Number(e.target.value) || 0),
                  })
                }
                className={fieldClass}
                translate="no"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Inspection Type <span className="text-red-500">*</span>
              </label>
              <select
                value={form.inspectionType || ""}
                onChange={(e) => setForm({ ...form, inspectionType: e.target.value as InspectionType })}
                className={fieldClass}
              >
                <option value="">Select Inspection Type</option>
                <option value="Chassis inspection">Chassis inspection</option>
                <option value="Paint inspection">Paint inspection</option>
                <option value="Paint and chassis inspection">Paint and chassis inspection</option>
                <option value="OBD inspection">OBD inspection</option>
                <option value="360 inspection">360 inspection</option>
                <option value="Comprehensive Inspection">Comprehensive Inspection</option>
              </select>
            </div>
          </div>
          {submitError && (
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              {submitError}
            </p>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="mt-5 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? "Submitting..." : "Submit Job"}
          </button>
        </div>
      </div>
    </div>
  );
}
