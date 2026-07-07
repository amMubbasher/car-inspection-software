import { connectToDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { Counter } from "@/models/Counter";
import { jobSchema } from "@/lib/validations/jobSchema";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { serializeJob, serializeJobs } from "@/lib/serializeJob";
export async function POST(req: Request) {
  try {
    await connectToDB();
    const body = await req.json();
    const parsed = jobSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten() },
        { status: 400 }
      );
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
      jobCount: counter.value,
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
    const session = await getServerSession({ req, ...authOptions });

    if (!session) {
      console.log(" No session found in /api/jobs");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();

    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const query: Record<string, unknown> = {};
    if (startDate || endDate) {
      const createdAt: Record<string, Date> = {};
      if (startDate) createdAt.$gte = new Date(startDate);
      if (endDate) createdAt.$lte = new Date(endDate);
      query.createdAt = createdAt;
    }

    const skip = (page - 1) * limit;
    const total = await Job.countDocuments(query);
    const jobs = await Job.find(query)
      .populate("assignedTo", "email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return NextResponse.json({
      jobs: serializeJobs(jobs),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: unknown) {
    console.error(" Failed to fetch jobs:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch jobs", details: message },
      { status: 500 }
    );
  }
}

