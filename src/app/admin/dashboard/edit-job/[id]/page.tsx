"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
// import { FiUpload } from "react-icons/fi";
import { SeverityToggle } from "@/components/SeverityToggle";
import { inspectionTabs as baseTabs } from "@/config/inspectionTabs";
import type { Job, Severity, InspectionType } from "@/types/job";

export default function EditJobPage() {
  const { id } = useParams();
  const router = useRouter();
  const { data: session } = useSession();
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
          price: job.price ?? 0,
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
      customerPhone: form.customerPhone ?? "",
      engineNumber: form.engineNumber,
      odometer: form.odometer,
      inspectionType: form.inspectionType,
      price: form.price ?? 0,
      inspectionTabs: form.inspectionTabs,
    };
    const res = await fetch(`/api/jobs/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      alert("Job updated successfully");
      router.push(
        session?.user?.role === "team" ? "/team/dashboard" : "/admin/dashboard"
      );
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
  const fieldClass =
    "notranslate w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white";

  if (loading || !form) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 text-sm text-gray-500 dark:bg-gray-950 dark:text-gray-400">
        Loading job...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 dark:bg-gray-950 md:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Job</h2>
      {/* Job Details */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Job Details</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Car Number</label>
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
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Name</label>
            <input
              type="text"
              placeholder="Customer Name"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              className={fieldClass}
              translate="no"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Customer Phone</label>
            <input
              type="tel"
              placeholder="Customer Phone Number"
              value={form.customerPhone || ""}
              onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
              className={fieldClass}
              translate="no"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Engine Number</label>
            <input
              type="text"
              placeholder="Engine Number"
              value={form.engineNumber || ""}
              onChange={(e) => setForm({ ...form, engineNumber: e.target.value })}
              className={fieldClass}
              translate="no"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Odometer</label>
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
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Price</label>
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
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Inspection Type</label>
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
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="mb-4 text-sm font-semibold text-gray-900 dark:text-white">Inspection Details</h3>
        <div className="mb-4 flex flex-wrap gap-2">
          {form.inspectionTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`rounded-full px-3 py-1.5 text-sm transition-colors ${
                activeTab === tab.key
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {form.inspectionTabs
          .filter((tab) => tab.key === activeTab)
          .map((tab) => (
            <div key={tab.key} className="space-y-3">
              {tab.subIssues.map((issue) => (
                <div
                  key={issue.key}
                  className="space-y-2 rounded-xl border border-gray-200 p-3 dark:border-gray-700"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                      {issue.label}
                    </h3>
                    <SeverityToggle
                      value={issue.severity}
                      onChange={(severity) =>
                        setForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                inspectionTabs: prev.inspectionTabs.map((t) =>
                                  t.key === tab.key
                                    ? {
                                        ...t,
                                        subIssues: t.subIssues.map((i) =>
                                          i.key === issue.key ? { ...i, severity } : i
                                        ),
                                      }
                                    : t
                                ),
                              }
                            : prev
                        )
                      }
                    />
                  </div>
                  <textarea
                    rows={2}
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
                    className={`${fieldClass} min-h-[72px] resize-y`}
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
        <button
          type="button"
          onClick={handleSubmit}
          className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
        >
          Save Changes
        </button>
      </div>
      </div>
    </div>
  );
}
