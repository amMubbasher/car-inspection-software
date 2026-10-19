import { connectToDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { NextResponse } from "next/server";
import { assertObjectId, requirePermission, routeError } from "@/lib/rbac/server";
import { jobScope } from "@/lib/rbac/jobs";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requirePermission("jobs.inspect");
    const scope = jobScope(user);
    const { id } = await params;
    assertObjectId(id, "Job");

    await connectToDB();

    // Atomic: only one inspector can claim a pending, unassigned job.
    const job = await Job.findOneAndUpdate(
      { _id: id, ...scope, status: "pending", assignedTo: null },
      { assignedTo: user._id, status: "in_progress" },
      { new: true }
    );
    if (!job) {
      return NextResponse.json({ error: "Job cannot be claimed" }, { status: 400 });
    }

    return NextResponse.json({ message: "Job claimed successfully" });
  } catch (error) {
    return routeError(error, "Failed to claim job");
  }
}
