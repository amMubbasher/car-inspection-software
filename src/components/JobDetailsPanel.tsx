"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import {
  Car,
  Check,
  ClipboardList,
  DollarSign,
  Download,
  Gauge,
  Hash,
  Pencil,
  Phone,
  Sparkles,
  Trash2,
  User,
  UserPlus,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NoTranslate } from "@/components/ui/NoTranslate";
import { SeverityToggle } from "@/components/SeverityToggle";
import { inspectionTabs as baseTabs } from "@/config/inspectionTabs";
import { getSelectedLocale } from "@/lib/countryToLocale";
import type { InspectionTab, InspectionType, Job } from "@/types/job";

function jobPdfUrl(jobId: string, receipt = false): string {
  const params = new URLSearchParams();
  params.set("locale", getSelectedLocale());
  if (receipt) params.set("receipt", "1");
  return `/api/pdf/${jobId}?${params.toString()}`;
}

const statusStyles: Record<Job["status"], string> = {
  pending: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400",
  in_progress: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400",
  completed: "bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
  accepted: "bg-purple-100 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400",
  rejected: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400",
};

export function statusLabel(status: Job["status"]) {
  if (status === "in_progress") return "In Progress";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function JobStatusBadge({ status }: { status: Job["status"] }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${statusStyles[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabel(status)}
    </span>
  );
}

export function formatJobDate(dateString?: string) {
  if (!dateString) return { date: "-", time: "" };
  const date = new Date(dateString);
  return {
    date: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

type FormState = {
  carNumber: string;
  customerName: string;
  customerPhone: string;
  engineNumber: string;
  inspectionType: InspectionType | "";
  odometer: number;
  price: number;
  inspectionTabs: InspectionTab[];
};

function tabsForType(inspectionType: string, existing: InspectionTab[]): InspectionTab[] {
  const relevant = inspectionType
    ? baseTabs.filter((tab) => tab.classification.includes(inspectionType))
    : baseTabs;

  return relevant.map((tab) => {
    const existingTab = existing.find((item) => item.key === tab.key);
    return {
      key: tab.key,
      label: tab.label,
      subIssues: tab.subIssues.map((issue) => {
        const existingIssue = existingTab?.subIssues.find((item) => item.key === issue.key);
        return {
          key: issue.key,
          label: issue.label,
          severity: existingIssue?.severity || "ok",
          comment: existingIssue?.comment || "",
        };
      }),
    };
  });
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="text-gray-400 dark:text-gray-500">{icon}</span>
      <span className="flex-1 text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <NoTranslate className="text-right text-sm font-medium text-gray-900 dark:text-white">
        {value}
      </NoTranslate>
    </div>
  );
}

export default function JobDetailsPanel({
  job,
  onClose,
  refreshJobs,
}: {
  job: Job;
  onClose: () => void;
  refreshJobs: () => void;
}) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const isTeam = session?.user?.role === "team";
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState("");
  const prevInspectionTypeRef = useRef<InspectionType | "">("");
  const [formData, setFormData] = useState<FormState>({
    carNumber: job.carNumber || "",
    customerName: job.customerName || "",
    customerPhone: job.customerPhone || "",
    engineNumber: job.engineNumber || "",
    inspectionType: job.inspectionType || "",
    odometer: job.odometer || 0,
    price: job.price ?? 0,
    inspectionTabs: [],
  });

  const createdAt = formatJobDate(job.createdAt);
  const assignedLabel =
    job.assignedTo && typeof job.assignedTo === "object"
      ? job.assignedTo.name?.trim() || job.assignedTo.email
      : "";
  const createdByLabel = job.createdBy?.name || job.createdBy?.email || "-";

  const openStartInspection = () => {
    const mergedTabs = tabsForType(job.inspectionType || "", job.inspectionTabs || []);
    setFormData({
      carNumber: job.carNumber || "",
      customerName: job.customerName || "",
      customerPhone: job.customerPhone || "",
      engineNumber: job.engineNumber || "",
      inspectionType: job.inspectionType || "",
      odometer: job.odometer || 0,
      price: job.price ?? 0,
      inspectionTabs: mergedTabs,
    });
    setActiveTab(mergedTabs[0]?.key || "");
    prevInspectionTypeRef.current = job.inspectionType || "";
    setIsDialogOpen(true);
  };

  useEffect(() => {
    if (!isDialogOpen || !formData.inspectionType) return;
    if (prevInspectionTypeRef.current === formData.inspectionType) return;

    const updatedTabs = tabsForType(formData.inspectionType, formData.inspectionTabs);
    setFormData((prev) => ({ ...prev, inspectionTabs: updatedTabs }));
    setActiveTab(updatedTabs[0]?.key || "");
    prevInspectionTypeRef.current = formData.inspectionType;
  }, [formData.inspectionType, isDialogOpen]);

  const handleUpdateAndStart = async () => {
    if (!formData.carNumber || !formData.customerName || !formData.inspectionType) {
      alert("Please fill in all required fields (Car Number, Customer Name, and Inspection Type)");
      return;
    }

    setIsSubmitting(true);
    try {
      const updateRes = await fetch(`/api/jobs/${job._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          carNumber: formData.carNumber,
          customerName: formData.customerName,
          customerPhone: formData.customerPhone,
          engineNumber: formData.engineNumber,
          inspectionType: formData.inspectionType,
          odometer: formData.odometer,
          price: formData.price ?? 0,
          inspectionTabs: formData.inspectionTabs,
        }),
      });

      if (!updateRes.ok) {
        alert("Error updating job");
        setIsSubmitting(false);
        return;
      }

      const claimRes = await fetch(`/api/jobs/${job._id}/claim`, { method: "PATCH" });
      if (claimRes.ok) {
        setIsDialogOpen(false);
        refreshJobs();
      } else {
        alert("Error claiming job");
      }
    } catch (error) {
      console.error("Error starting inspection:", error);
      alert("An error occurred");
    }
    setIsSubmitting(false);
  };

  const handleComplete = async () => {
    const res = await fetch(`/api/jobs/${job._id}/complete`, { method: "PATCH" });
    if (res.ok) refreshJobs();
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this job?")) return;
    const res = await fetch(`/api/jobs/${job._id}`, { method: "DELETE" });
    if (res.ok) {
      alert("Job deleted successfully");
      onClose();
      refreshJobs();
    } else {
      const data = await res.json();
      alert("Error: " + (data?.error || "Something went wrong"));
    }
  };

  const handleEdit = () => {
    window.location.href = `/admin/dashboard/edit-job/${job._id}`;
  };

  return (
    <>
      <aside className="flex w-full shrink-0 flex-col rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 lg:w-[380px]">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 p-5 dark:border-gray-800">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <Car className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <NoTranslate as="p" className="truncate text-lg font-semibold text-gray-900 dark:text-white">
                  {job.carNumber}
                </NoTranslate>
                <JobStatusBadge status={job.status} />
              </div>
              <p className="mt-1 text-xs text-gray-400">
                {createdAt.date}
                {createdAt.time ? `, ${createdAt.time}` : ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Close job details"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <section>
            <div className="mb-1 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Job Details</h3>
              {(isAdmin || isTeam) && (
                <button
                  type="button"
                  onClick={handleEdit}
                  className="rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
                  aria-label="Edit job"
                >
                  <Pencil className="h-4 w-4" />
                </button>
              )}
            </div>
            <DetailRow icon={<Car className="h-4 w-4" />} label="Car Number" value={job.carNumber || "-"} />
            <DetailRow icon={<Phone className="h-4 w-4" />} label="Customer Phone" value={job.customerPhone || "-"} />
            <DetailRow icon={<Hash className="h-4 w-4" />} label="Chassis Number" value={job.engineNumber || "-"} />
            <DetailRow
              icon={<Gauge className="h-4 w-4" />}
              label="Odometer"
              value={job.odometer != null ? String(job.odometer) : "-"}
            />
            <DetailRow icon={<DollarSign className="h-4 w-4" />} label="Price" value={String(job.price ?? 0)} />
            <DetailRow
              icon={<Sparkles className="h-4 w-4" />}
              label="Inspection Type"
              value={job.inspectionType || "-"}
            />
          </section>

          <section className="rounded-xl border border-gray-100 p-4 dark:border-gray-800">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
              <ClipboardList className="h-4 w-4 text-indigo-500" />
              Assignment & Tracking
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs text-gray-400">
                  <User className="h-3.5 w-3.5" />
                  Assigned To
                </p>
                <NoTranslate as="p" className="mt-1 truncate text-sm font-medium text-gray-900 dark:text-white">
                  {assignedLabel || "-"}
                </NoTranslate>
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-xs text-gray-400">
                  <UserPlus className="h-3.5 w-3.5" />
                  Inspector Name
                </p>
                <NoTranslate as="p" className="mt-1 truncate text-sm font-medium text-gray-900 dark:text-white">
                  {createdByLabel}
                </NoTranslate>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-2 gap-2">
            {job.status !== "pending" && (
              <>
                <button
                  type="button"
                  onClick={() => window.open(jobPdfUrl(job._id), "_blank")}
                  className="flex items-center justify-center gap-2 rounded-xl bg-gray-800 px-3 py-2.5 text-sm font-medium text-white hover:bg-gray-700"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => window.open(jobPdfUrl(job._id, true), "_blank")}
                  className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
                >
                  <Download className="h-4 w-4" />
                  Download Receipt
                </button>
              </>
            )}
            {(isAdmin || isTeam) && (
              <button
                type="button"
                onClick={handleEdit}
                className="flex items-center justify-center gap-2 rounded-xl bg-green-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-green-500"
              >
                <Pencil className="h-4 w-4" />
                Edit
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center justify-center gap-2 rounded-xl bg-red-500 px-3 py-2.5 text-sm font-medium text-white hover:bg-red-400"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
            {(isAdmin || isTeam) && job.status === "pending" && (
              <button
                type="button"
                onClick={openStartInspection}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-indigo-500"
              >
                <Sparkles className="h-4 w-4" />
                Start Inspection
              </button>
            )}
            {(isAdmin || isTeam) && job.status === "in_progress" && (
              <button
                type="button"
                onClick={handleComplete}
                className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-green-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-green-500"
              >
                <Check className="h-4 w-4" />
                Complete
              </button>
            )}
          </div>
        </div>
      </aside>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl border-gray-200 p-0 dark:border-gray-800 sm:max-w-4xl">
          <DialogHeader className="border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <DialogTitle>Edit Job Details & Start Inspection</DialogTitle>
            <DialogDescription>
              Update the job details and inspection items, then click &quot;Update & Start&quot; to begin.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 px-5 py-4">
            <div className="space-y-4 rounded-xl border border-gray-200 p-4 dark:border-gray-700">
              <h3 className="text-sm font-semibold">Basic Information</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="panel-carNumber">Car Number *</Label>
                  <Input
                    id="panel-carNumber"
                    className="notranslate"
                    translate="no"
                    value={formData.carNumber}
                    onChange={(e) => setFormData({ ...formData, carNumber: e.target.value })}
                    placeholder="Enter car number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="panel-customerName">Customer Name *</Label>
                  <Input
                    id="panel-customerName"
                    className="notranslate"
                    translate="no"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    placeholder="Enter customer name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="panel-customerPhone">Customer Phone</Label>
                  <Input
                    id="panel-customerPhone"
                    type="tel"
                    className="notranslate"
                    translate="no"
                    value={formData.customerPhone}
                    onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                    placeholder="Enter customer phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="panel-engineNumber">Engine Number</Label>
                  <Input
                    id="panel-engineNumber"
                    className="notranslate"
                    translate="no"
                    value={formData.engineNumber}
                    onChange={(e) => setFormData({ ...formData, engineNumber: e.target.value })}
                    placeholder="Enter engine number"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="panel-odometer">Current Odo</Label>
                  <Input
                    id="panel-odometer"
                    className="notranslate"
                    translate="no"
                    value={formData.odometer}
                    onChange={(e) => setFormData({ ...formData, odometer: Number(e.target.value) })}
                    placeholder="Enter current odo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="panel-price">Price</Label>
                  <Input
                    id="panel-price"
                    type="number"
                    min={0}
                    step={1}
                    className="notranslate"
                    translate="no"
                    value={formData.price ?? 0}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        price: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="panel-inspectionType">Inspection Type *</Label>
                  <select
                    id="panel-inspectionType"
                    value={formData.inspectionType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        inspectionType: e.target.value as InspectionType,
                      })
                    }
                    className="w-full rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
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

            {formData.inspectionType ? (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Inspection Details</h3>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 dark:border-indigo-900/40 dark:bg-indigo-500/10">
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    <span className="font-semibold">Inspection Type:</span> {formData.inspectionType}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.inspectionTabs.map((tab) => (
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
                <div className="max-h-[400px] space-y-3 overflow-y-auto pr-2">
                  {formData.inspectionTabs
                    .filter((tab) => tab.key === activeTab)
                    .map((tab) => (
                      <div key={tab.key} className="space-y-3">
                        {tab.subIssues.map((issue) => (
                          <div
                            key={issue.key}
                            className="space-y-2 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-900"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h4 className="text-sm font-medium">{issue.label}</h4>
                              <SeverityToggle
                                value={issue.severity}
                                onChange={(severity) =>
                                  setFormData((prev) => ({
                                    ...prev,
                                    inspectionTabs: prev.inspectionTabs.map((item) =>
                                      item.key === tab.key
                                        ? {
                                            ...item,
                                            subIssues: item.subIssues.map((sub) =>
                                              sub.key === issue.key ? { ...sub, severity } : sub
                                            ),
                                          }
                                        : item
                                    ),
                                  }))
                                }
                              />
                            </div>
                            <textarea
                              rows={2}
                              placeholder="Comment"
                              value={issue.comment || ""}
                              onChange={(e) =>
                                setFormData((prev) => ({
                                  ...prev,
                                  inspectionTabs: prev.inspectionTabs.map((item) =>
                                    item.key === tab.key
                                      ? {
                                          ...item,
                                          subIssues: item.subIssues.map((sub) =>
                                            sub.key === issue.key
                                              ? { ...sub, comment: e.target.value }
                                              : sub
                                          ),
                                        }
                                      : item
                                  ),
                                }))
                              }
                              className="min-h-[60px] w-full resize-y rounded-md border border-gray-300 bg-white p-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center dark:border-gray-600 dark:bg-gray-800">
                <p className="text-gray-600 dark:text-gray-400">
                  Please select an inspection type above to view and edit inspection details.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="grid grid-cols-2 gap-2 border-t border-gray-100 px-5 py-4 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setIsDialogOpen(false)}
              className="rounded-xl bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpdateAndStart}
              disabled={isSubmitting}
              className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              {isSubmitting ? "Updating & Starting..." : "Update & Start"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
