import { connectToDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { User } from "@/models/User";
import { Counter } from "@/models/Counter";
import { jobSchema } from "@/lib/validations/jobSchema";
import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { can, requirePermission, requireUser, routeError } from "@/lib/rbac/server";
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
    const { status: _status, ...data } = parsed.data;
    const jobData = {
      ...data,
      status: "pending",
      customerName: inspectorName,
      jobCount: counter.value,
      createdBy: user._id,
      price: Math.max(0, Number(data.price) || 0),
    };
    
    const newJob = await Job.create(jobData);
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
    const createdBy = searchParams.get("createdBy");

    const query: Record<string, unknown> = { ...scope };
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      const start = parseFilterDate(startDate, false);
      let end = parseFilterDate(endDate, true);
      if (start && end && end.getTime() <= start.getTime()) {
        end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
      }
      if (start) createdAt.$gte = start;
      if (end) createdAt.$lte = end;
      if (Object.keys(createdAt).length > 0) query.createdAt = createdAt;
    }
    if (createdBy && isValidObjectId(createdBy) && can(user, "jobs.filter_by_user")) {
      query.createdBy = createdBy;
    }

    const skip = (page - 1) * limit;
    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
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
