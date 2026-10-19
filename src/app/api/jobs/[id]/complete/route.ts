import { connectToDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { NextResponse } from "next/server";
import { assertObjectId, requirePermission, routeError } from "@/lib/rbac/server";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("jobs.inspect");
    const { id } = await params;
    assertObjectId(id, "Job");

    await connectToDB();

    // Only the assigned inspector can complete their in-progress job.
    const job = await Job.findOneAndUpdate(
      { _id: id, assignedTo: user._id, status: "in_progress" },
      { status: "completed" },
      { new: true }
    );
    if (!job) {
      return NextResponse.json(
        { error: "You can't mark this job complete" },
        { status: 400 }
      );
    }

    return NextResponse.json({ message: "Job marked as completed" });
  } catch (error) {
    return routeError(error, "Failed to complete job");
  }
}
