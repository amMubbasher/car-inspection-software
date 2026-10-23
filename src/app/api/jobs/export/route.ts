import { carNameOf } from "@/lib/serializeJob";
import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { requirePermission, routeError } from "@/lib/rbac/server";
import { jobScope } from "@/lib/rbac/jobs";
import { connectToDB } from "@/lib/db";
import { Job } from "@/models/Job";
import {
  EXPORT_MAX_ROWS,
  normalizeExportColumns,
  UNASSIGNED_INSPECTOR,
  type ExportColumnKey,
} from "@/config/exportColumns";
import { paymentMethodLabel } from "@/config/paymentMethods";

export const dynamic = "force-dynamic";

type Person = { name?: string; email?: string } | null | undefined;

type ExportJob = {
  jobCount?: number;
  createdAt?: Date;
  carName?: string;
  customerName?: string;
  customerPhone?: string;
  engineNumber?: string;
  odometer?: number;
  inspectionType?: string;
  status?: string;
  price?: number;
  paymentMethod?: string | null;
  assignedTo?: Person;
  createdBy?: Person;
};

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cell(job: ExportJob, key: ExportColumnKey): string | number | null {
  switch (key) {
    case "jobNumber": return job.jobCount ?? null;
    case "createdAt": return job.createdAt ? job.createdAt.toISOString() : null;
    case "carName": return carNameOf(job);
    case "customerName": return job.customerName ?? "";
    case "customerPhone": return job.customerPhone ?? "";
    case "chassisNumber": return job.engineNumber ? job.engineNumber.toUpperCase() : "";
    case "odometer": return job.odometer ?? null;
    case "inspectionType": return job.inspectionType ?? "";
    case "status": return job.status ?? "";
    case "price": return Math.max(0, Number(job.price) || 0);
    case "paymentMethod": return paymentMethodLabel(job.paymentMethod);
    case "inspectorName": return job.assignedTo?.name?.trim() ?? "";
    case "inspectorEmail": return job.assignedTo?.email ?? "";
    case "createdByName": return job.createdBy?.name?.trim() ?? "";
    case "createdByEmail": return job.createdBy?.email ?? "";
  }
}

export async function GET(req: Request) {
  try {
    const user = await requirePermission("reports.export");
    const scope = jobScope(user);

    const { searchParams } = new URL(req.url);
    const columns = normalizeExportColumns((searchParams.get("columns") ?? "").split(","));
    if (columns.length === 0) {
      return NextResponse.json({ error: "Select at least one column" }, { status: 400 });
    }
    const start = parseDate(searchParams.get("startDate"));
    const end = parseDate(searchParams.get("endDate"));
    if (!start || !end || end < start) {
      return NextResponse.json({ error: "Select a valid date range" }, { status: 400 });
    }

    const conditions: Record<string, unknown>[] = [scope, { createdAt: { $gte: start, $lte: end } }];
    // Omitted means every inspector, including unassigned jobs.
    const inspectorsParam = searchParams.get("inspectors");
    if (inspectorsParam !== null) {
      const values = inspectorsParam.split(",").map((value) => value.trim()).slice(0, 1000);
      const ids = values.filter((value) => isValidObjectId(value));
      const inspectorFilter: Record<string, unknown>[] = [];
      if (ids.length > 0) inspectorFilter.push({ assignedTo: { $in: ids } });
      if (values.includes(UNASSIGNED_INSPECTOR)) inspectorFilter.push({ assignedTo: null });
      if (inspectorFilter.length === 0) {
        return NextResponse.json({ error: "Select at least one inspector" }, { status: 400 });
      }
      conditions.push({ $or: inspectorFilter });
    }

    await connectToDB();
    const query = { $and: conditions };
    const needsInspector = columns.some((key) => key.startsWith("inspector"));
    const needsCreator = columns.some((key) => key.startsWith("createdBy"));

    let cursor = Job.find(query)
      .select("-inspectionTabs")
      .sort({ createdAt: 1 })
      .limit(EXPORT_MAX_ROWS + 1);
    if (needsInspector) cursor = cursor.populate("assignedTo", "name email");
    if (needsCreator) cursor = cursor.populate("createdBy", "name email");
    const jobs = (await cursor.lean()) as ExportJob[];

    const truncated = jobs.length > EXPORT_MAX_ROWS;
    const rows = jobs
      .slice(0, EXPORT_MAX_ROWS)
      .map((job) => Object.fromEntries(columns.map((key) => [key, cell(job, key)])));

    return NextResponse.json(
      { columns, rows, truncated },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return routeError(error, "Failed to export jobs");
  }
}
