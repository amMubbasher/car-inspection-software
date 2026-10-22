import { connectToDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { z } from "zod";
import { assertObjectId, audit, AuthError, can, requireUser, routeError } from "@/lib/rbac/server";
import { jobScope } from "@/lib/rbac/jobs";
import { serializeJob } from "@/lib/serializeJob";

const bodySchema = z.strictObject({ received: z.boolean() });

/** Marks a job's payment as received by the current user, or undoes it. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    assertObjectId(id, "Job");

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }
    const { received } = parsed.data;
    // Marking and undoing are separate permissions.
    if (!can(user, received ? "jobs.mark_payment" : "jobs.undo_payment")) {
      throw new AuthError(403, "You do not have permission to do this");
    }
    const scope = jobScope(user);

    await connectToDB();

    // Atomic: the filter only matches when the job is in the opposite state,
    // so two people clicking at once can't overwrite each other.
    const job = await Job.findOneAndUpdate(
      received
        ? { _id: id, ...scope, paymentReceivedBy: null }
        : { _id: id, ...scope, paymentReceivedBy: { $ne: null } },
      received
        ? { paymentReceivedBy: user._id, paymentReceivedAt: new Date() }
        : { paymentReceivedBy: null, paymentReceivedAt: null },
      { new: false }
    );

    if (!job) {
      const exists = await Job.exists({ _id: id, ...scope });
      if (!exists) return NextResponse.json({ error: "Job not found" }, { status: 404 });
      return NextResponse.json(
        {
          error: received
            ? "Payment is already marked as received"
            : "Payment is not marked as received",
        },
        { status: 409 }
      );
    }

    await audit(user, {
      action: received ? "job.payment_received" : "job.payment_unmarked",
      targetType: "job",
      targetId: new Types.ObjectId(id),
      before: { paymentReceivedBy: job.paymentReceivedBy, paymentReceivedAt: job.paymentReceivedAt },
      after: received ? { paymentReceivedBy: user._id } : { paymentReceivedBy: null },
    });

    const updated = await Job.findById(id)
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .populate("paymentReceivedBy", "name email");
    return NextResponse.json(serializeJob(updated));
  } catch (error) {
    return routeError(error, "Failed to update payment");
  }
}
