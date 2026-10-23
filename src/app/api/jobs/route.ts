import { connectToDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { User } from "@/models/User";
import { Counter } from "@/models/Counter";
import { Vat } from "@/models/Vat";
import { toVatSnapshot } from "@/lib/vat";
import { jobSchema, PAYMENT_METHOD_REQUIRED } from "@/lib/validations/jobSchema";
import { needsPaymentMethod } from "@/config/paymentMethods";
import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import {
  audit,
  AuthError,
  can,
  requirePermission,
  requireUser,
  routeError,
} from "@/lib/rbac/server";
import { jobScope } from "@/lib/rbac/jobs";
import { serializeJob, serializeJobs } from "@/lib/serializeJob";

export const dynamic = "force-dynamic";

function parseFilterDate(value: string | null, endOfDay: boolean) {
  if (!value) return null;
  const date = value.includes("T")
    ? new Date(value)
    : new Date(endOfDay ? `${value}T23:59:59.999` : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Matches car name, chassis, customer phone (ignoring spaces/dashes) or inspector name/email. */
async function searchClause(raw: string) {
  const term = raw.trim().slice(0, 100);
  if (!term) return null;
  const regex = new RegExp(escapeRegex(term), "i");
  const or: Record<string, unknown>[] = [
    { carName: regex },
    { carNumber: regex }, // jobs not yet migrated by scripts/migrate-car-name.ts
    { engineNumber: regex },
    { customerPhone: regex },
  ];
  const digits = term.replace(/\D/g, "");
  if (digits.length >= 3) {
    or.push({ customerPhone: new RegExp(digits.split("").join("[^0-9]*")) });
  }
  const inspectors = await User.find({ $or: [{ name: regex }, { email: regex }] })
    .select("_id")
    .limit(200)
    .lean();
  if (inspectors.length > 0) {
    or.push({ assignedTo: { $in: inspectors.map((inspector) => inspector._id) } });
  }
  return { $or: or };
}

const STATUS_FILTERS: Record<string, Record<string, unknown>> = {
  pending: { status: "pending" },
  in_progress: { status: "in_progress" },
  completed: { status: { $in: ["completed", "accepted"] } },
  accepted: { status: "accepted" },
  rejected: { rejectionNote: { $exists: true, $nin: [null, ""] } },
};

export async function POST(req: Request) {
  try {
    const user = await requirePermission("jobs.create");

    await connectToDB();
    const body = await req.json().catch(() => null);
    const parsed = jobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    if (parsed.data.paymentReceived && !can(user, "jobs.mark_payment")) {
      throw new AuthError(403, "You do not have permission to mark payments as received");
    }
    
    const creator = await User.findById(user._id).select("name email");
    if (!creator) {
      return NextResponse.json({ error: "Job creation failed" }, { status: 500 });
    }
    const inspectorName = creator.name?.trim() || creator.email;

    // Get and increment the job counter atomically
    // @ts-ignore
    const counter = await Counter.findOneAndUpdate(
      { name: "jobCount" },
      { $inc: { value: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // Status is never client-controlled on creation.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { status: _status, paymentReceived, ...data } = parsed.data;
    const price = Math.max(0, Number(data.price) || 0);
    if (needsPaymentMethod(price) && !data.paymentMethod) {
      return NextResponse.json({ error: PAYMENT_METHOD_REQUIRED }, { status: 400 });
    }
    const activeVat = await Vat.findOne({ isActive: true }).lean();
    const jobData = {
      ...data,
      vat: toVatSnapshot(activeVat),
      status: "pending",
      customerName: inspectorName,
      jobCount: counter.value,
      createdBy: user._id,
      price,
      paymentMethod: data.paymentMethod ?? null,
      ...(paymentReceived && {
        paymentReceivedBy: user._id,
        paymentReceivedAt: new Date(),
      }),
    };
    
    const newJob = await Job.create(jobData);
    if (paymentReceived) {
      await audit(user, {
        action: "job.payment_received",
        targetType: "job",
        targetId: newJob._id,
        after: { paymentReceivedBy: user._id },
      });
    }
    return NextResponse.json(serializeJob(newJob), { status: 201 });
  } catch (error) {
    return routeError(error, "Job creation failed");
  }
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const scope = jobScope(user);

    await connectToDB();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "10", 10) || 10));
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const assignedTo = searchParams.get("assignedTo");
    const status = searchParams.get("status") ?? "";

    // Each condition is its own $and entry so the scope's $or can't be overridden.
    const conditions: Record<string, unknown>[] = [scope];
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      const start = parseFilterDate(startDate, false);
      let end = parseFilterDate(endDate, true);
      if (start && end && end.getTime() <= start.getTime()) {
        end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
      }
      if (start) createdAt.$gte = start;
      if (end) createdAt.$lte = end;
      if (Object.keys(createdAt).length > 0) conditions.push({ createdAt });
    }
    if (assignedTo && isValidObjectId(assignedTo) && can(user, "jobs.filter_by_user")) {
      conditions.push({ assignedTo });
    }
    if (STATUS_FILTERS[status]) conditions.push(STATUS_FILTERS[status]);
    const search = await searchClause(searchParams.get("q") ?? "");
    if (search) conditions.push(search);
    const query = { $and: conditions };

    const skip = (page - 1) * limit;
    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("paymentReceivedBy", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return NextResponse.json(
      {
        jobs: serializeJobs(jobs),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error: unknown) {
    return routeError(error, "Failed to fetch jobs");
  }
}
