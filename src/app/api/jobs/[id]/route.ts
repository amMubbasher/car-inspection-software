// app/api/jobs/[id]/route.ts
// @ts-nocheck
import { connectToDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
export async function GET(req, { params }) {
  try {
    await connectToDB();
    const job = await Job.findById(params.id).populate("assignedTo", "email");
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json(job);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}

export async function PATCH(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();
    const body = await req.json();
    const jobId = params.id;

    let updatePayload = {};

    // 1. Accept / Reject logic (same as before)
    if (body.status === "rejected") {
      updatePayload.status = "rejected";
      updatePayload.rejectionNote = body.rejectionNote || "";
    } else if (body.status === "accepted") {
      updatePayload.status = "accepted";
      updatePayload.rejectionNote = "";
    }
    // 2. Full job edit (carNumber, customerName, inspectionTabs, etc.)
    if (body.carNumber) updatePayload.carNumber = body.carNumber;
    if (body.customerName) updatePayload.customerName = body.customerName;
    if (body.engineNumber !== undefined) updatePayload.engineNumber = body.engineNumber;
    if (body.odometer !== undefined) updatePayload.odometer = body.odometer;
    if (body.inspectionType !== undefined) updatePayload.inspectionType = body.inspectionType;
    if (body.inspectionTabs) updatePayload.inspectionTabs = body.inspectionTabs;
    console.log(updatePayload);
    const updatedJob = await Job.findByIdAndUpdate(jobId, updatePayload, { new: true });

    if (!updatedJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(updatedJob);
  } catch (error) {
    console.error("PATCH error:", error);
    return NextResponse.json({ error: "Failed to update job" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();
    const jobId = params.id;

    const deletedJob = await Job.findByIdAndDelete(jobId);
    if (!deletedJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Job deleted successfully" });
  } catch (error) {
    console.error("DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete job" }, { status: 500 });
  }
}
