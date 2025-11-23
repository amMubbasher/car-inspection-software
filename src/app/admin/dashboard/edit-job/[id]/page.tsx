"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
// import { FiUpload } from "react-icons/fi";
import { inspectionTabs as baseTabs } from "@/config/inspectionTabs";
import type { Job, Severity, InspectionType } from "@/types/job";

export default function EditJobPage() {
  const { id } = useParams();
  const router = useRouter();
  const [form, setForm] = useState<Job | null>(null);
  const [activeTab, setActiveTab] = useState("");
  const [loading, setLoading] = useState(true);
  const prevInspectionTypeRef = useRef<InspectionType | undefined>(undefined);

  // Fetch existing job
  useEffect(() => {
    const fetchJob = async () => {
      const res = await fetch(`/api/jobs/${id}`);
      if (res.ok) {
        const job = await res.json();
        
        // Filter baseTabs based on the job's inspection type
        const relevantTabs = job.inspectionType 
          ? baseTabs.filter((tab) => tab.classification.includes(job.inspectionType))
          : baseTabs;
        
        // Merge with inspectionTabs so missing fields are added
        const mergedTabs = relevantTabs.map((tab) => {
          const existingTab = job.inspectionTabs.find(
            (t: any) => t.key === tab.key
          );
          return {
            ...tab,
            subIssues: tab.subIssues.map((issue) => {
              const existingIssue = existingTab?.subIssues.find(
                (i: any) => i.key === issue.key
              );
              return {
                ...issue,
                severity: existingIssue?.severity || "ok",
                comment: existingIssue?.comment || "",
                // images: existingIssue?.images || [],
              };
            }),
          };
        });

        setForm({
          ...job,
          inspectionTabs: mergedTabs,
        });
        
        // Set initial active tab
        const firstTab = relevantTabs[0];
        if (firstTab) {
          setActiveTab(firstTab.key);
        }
        
        // Set initial inspection type ref
        prevInspectionTypeRef.current = job.inspectionType;
      }
      setLoading(false);
    };
    fetchJob();
  }, [id]);

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
  //     setForm((prev) =>
  //       prev
  //         ? {
  //             ...prev,
  //             inspectionTabs: prev.inspectionTabs.map((tab) =>
  //               tab.key === tabKey
  //                 ? {
  //                     ...tab,
  //                     subIssues: tab.subIssues.map((issue) =>
  //                       issue.key === issueKey
  //                         ? { ...issue, images: [...issue.images, ...uploadedUrls] }
  //                         : issue
  //                     ),
  //                   }
  //                 : tab
  //             ),
  //           }
  //         : prev
  //     );
  //   } catch (error) {
  //     console.error("Image upload failed", error);
  //   }
  // };

  const handleSubmit = async () => {
    if (!form) return;
    const payload = {
      carNumber: form.carNumber,
      customerName: form.customerName,
      engineNumber: form.engineNumber,
      odometer: form.odometer,
      inspectionType: form.inspectionType,
      inspectionTabs: form.inspectionTabs,
    };
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      alert("Job updated successfully");
      router.push("/admin/dashboard");
    } else {
      alert("Error updating job");
    }
  };
  // Update inspection tabs and active tab when inspection type changes
  useEffect(() => {
    if (form?.inspectionType && prevInspectionTypeRef.current !== form.inspectionType) {
      // Filter tabs based on the new inspection type
      const relevantTabs = baseTabs.filter((tab) => 
        tab.classification.includes(form.inspectionType || "")
      );
      
      // Update form with only relevant tabs, preserving existing data where possible
      const updatedTabs = relevantTabs.map((tab) => {
        const existingTab = form.inspectionTabs.find((t) => t.key === tab.key);
        return existingTab || {
          ...tab,
          subIssues: tab.subIssues.map((issue) => ({
            ...issue,
            severity: "ok" as Severity,
            comment: "",
          })),
        };
      });
      
      setForm((prev) => prev ? {
        ...prev,
        inspectionTabs: updatedTabs,
      } : prev);
      
      // Set active tab to the first relevant tab
      const firstTab = relevantTabs[0];
      if (firstTab) {
        setActiveTab(firstTab.key);
      }
      
      // Update the ref to the current inspection type
      prevInspectionTypeRef.current = form.inspectionType;
    }
  }, [form?.inspectionType]);
  if (loading || !form) return <p className="p-6">Loading job...</p>;

  return (
    <div className="p-6 space-y-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Job Details */}
      <div className="bg-white dark:bg-gray-800 rounded shadow p-4 space-y-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Edit Job
        </h2>
        <input
          type="text"
          placeholder="Car Number"
          value={form.carNumber}
          onChange={(e) => setForm({ ...form, carNumber: e.target.value })}
          className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <input
          type="text"
          placeholder="Customer Name"
          value={form.customerName}
          onChange={(e) => setForm({ ...form, customerName: e.target.value })}
          className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <input
          type="text"
          placeholder="Engine Number"
          value={form.engineNumber || ""}
          onChange={(e) => setForm({ ...form, engineNumber: e.target.value })}
          className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <input
          type="number"
          placeholder="Odometer Reading"
          value={form.odometer || ""}
          onChange={(e) => setForm({ ...form, odometer: e.target.value ? Number(e.target.value) : undefined })}
          className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />
        <div>
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

      {/* Tabs */}
      <div className="flex flex-wrap space-x-2 mb-4">
        {form.inspectionTabs.map((tab) => (
          <button
            key={tab.key}
            className={`px-4 py-2 my-2 rounded transition-colors ${
              activeTab === tab.key
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white"
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {form.inspectionTabs
        .filter((tab) => tab.key === activeTab)
        .map((tab) => (
          <div key={tab.key} className="space-y-4">
            {tab.subIssues.map((issue) => (
              <div
                key={issue.key}
                className="p-4 bg-white dark:bg-gray-800 rounded shadow"
              >
                <h3 className="font-bold mb-2 text-gray-900 dark:text-white">
                  {issue.label}
                </h3>

                <select
                  value={issue.severity}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            inspectionTabs: prev.inspectionTabs.map((t) =>
                              t.key === tab.key
                                ? {
                                    ...t,
                                    subIssues: t.subIssues.map((i) =>
                                      i.key === issue.key
                                        ? {
                                            ...i,
                                            severity: e.target
                                              .value as Severity,
                                          }
                                        : i
                                    ),
                                  }
                                : t
                            ),
                          }
                        : prev
                    )
                  }
                  className="mb-2 border border-gray-300 dark:border-gray-600 p-2 rounded w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="minor">Minor</option>
                  <option value="major">Major</option>
                  <option value="ok">OK</option>
                </select>

                <textarea
                  placeholder="Comment"
                  value={issue.comment}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            inspectionTabs: prev.inspectionTabs.map((t) =>
                              t.key === tab.key
                                ? {
                                    ...t,
                                    subIssues: t.subIssues.map((i) =>
                                      i.key === issue.key
                                        ? { ...i, comment: e.target.value }
                                        : i
                                    ),
                                  }
                                : t
                            ),
                          }
                        : prev
                    )
                  }
                  className="w-full border border-gray-300 dark:border-gray-600 p-2 rounded mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                {/* 
                <label className="flex items-center space-x-2 cursor-pointer text-gray-900 dark:text-white">
                  <FiUpload />
                  <span>Upload Images</span>
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) =>
                      handleFileChange(tab.key, issue.key, e.target.files)
                    }
                  />
                </label> */}

                {/* {issue.images.length > 0 && (
                  <div className="flex space-x-2 mt-2">
                    {issue.images.map((src, idx) => (
                      <div
                        key={idx}
                        className="relative w-20 h-20 rounded border border-gray-300 dark:border-gray-600 overflow-hidden"
                      >
                        <Image
                          src={src}
                          alt={`Issue image ${idx + 1}`}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>
                    ))}
                  </div>
                )} */}
              </div>
            ))}
          </div>
        ))}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        className="mt-6 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-700 dark:hover:bg-indigo-800 text-white px-4 py-2 rounded transition-colors"
      >
        Save Changes
      </button>
    </div>
  );
}
