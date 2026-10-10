import { connectToDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { User } from "@/models/User";
import { Counter } from "@/models/Counter";
import { jobSchema } from "@/lib/validations/jobSchema";
import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
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
    const session = await getServerSession(authOptions);
    if (!session || !["admin", "team"].includes(session.user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();
    const body = await req.json();
    const parsed = jobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    
    const creator = await User.findById(session.user._id).select("name email");
    if (!creator) {
      return NextResponse.json({ error: "Job creation failed", details: "Creator not found" }, { status: 500 });
    }
    const inspectorName = creator.name?.trim() || creator.email;
    if (!inspectorName) {
      return NextResponse.json({ error: "Job creation failed", details: "Creator has no name or email" }, { status: 500 });
    }

    // Get and increment the job counter atomically
    // @ts-ignore
    const counter = await Counter.findOneAndUpdate(
      { name: "jobCount" },
      { $inc: { value: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const jobData = {
      ...parsed.data,
      customerName: inspectorName,
      jobCount: counter.value,
      createdBy: session.user._id,
      price: Math.max(0, Number(parsed.data.price) || 0),
    };
    
    //@ts-ignore
    const newJob = await Job.create(jobData);
    return NextResponse.json(serializeJob(newJob), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: "Job creation failed", details: error instanceof Error ? error.message : error },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !["admin", "team"].includes(session.user.role)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    await connectToDB();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const createdBy = searchParams.get("createdBy");

    const query: Record<string, unknown> = {};
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      const start = parseFilterDate(startDate, false);
      const end = parseFilterDate(endDate, true);
      if (start) createdAt.$gte = start;
      if (end) createdAt.$lte = end;
      if (Object.keys(createdAt).length > 0) query.createdAt = createdAt;
    }
    if (createdBy && isValidObjectId(createdBy)) {
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
    console.error(" Failed to fetch jobs:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch jobs", details: message },
      { status: 500 }
    );
  }
}

