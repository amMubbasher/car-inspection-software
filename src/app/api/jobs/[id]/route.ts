// app/api/jobs/[id]/route.ts
import { connectToDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { NextResponse } from "next/server";
import { Types } from "mongoose";
import {
  assertObjectId,
  audit,
  AuthError,
  can,
  requirePermission,
  requireUser,
  routeError,
} from "@/lib/rbac/server";
import { jobScope } from "@/lib/rbac/jobs";
import { jobEditSchema, PAYMENT_METHOD_REQUIRED } from "@/lib/validations/jobSchema";
import { needsPaymentMethod } from "@/config/paymentMethods";
import { serializeJob } from "@/lib/serializeJob";

type Params = { params: Promise<{ id: string }> };

const REVIEWABLE_STATUSES = ["completed", "accepted", "rejected"];

export async function GET(_req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const scope = jobScope(user);
    const { id } = await params;
    assertObjectId(id, "Job");

    await connectToDB();
    const job = await Job.findOne({ _id: id, ...scope })
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email");
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }
    return NextResponse.json(serializeJob(job), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return routeError(error, "Failed to fetch job");
  }
}

export async function PATCH(req: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const scope = jobScope(user);
    const { id: jobId } = await params;
    assertObjectId(jobId, "Job");

    const parsed = jobEditSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Validation failed" },
        { status: 400 }
      );
    }
    const { status, rejectionNote, ...edits } = parsed.data;
    const hasEdits = Object.values(edits).some((value) => value !== undefined);
    const hasReview = status !== undefined || rejectionNote !== undefined;

    if (!hasEdits && !hasReview) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }
    if (hasEdits && !can(user, "jobs.edit")) {
      throw new AuthError(403, "You do not have permission to edit jobs");
    }
    if (hasReview && !can(user, "jobs.review")) {
      throw new AuthError(403, "You do not have permission to review jobs");
    }

    await connectToDB();

    const updatePayload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(edits)) {
      if (value !== undefined) updatePayload[key] = value;
    }

    // Price and payment method are validated together against the stored job, since
    // a request may change only one of them.
    if (edits.price !== undefined || edits.paymentMethod !== undefined) {
      const current = await Job.findOne({ _id: jobId, ...scope }).select("price paymentMethod").lean();
      if (!current) return NextResponse.json({ error: "Job not found" }, { status: 404 });
      const price = edits.price ?? current.price ?? 0;
      const method = edits.paymentMethod !== undefined ? edits.paymentMethod : current.paymentMethod;
      if (needsPaymentMethod(price) && !method) {
        return NextResponse.json({ error: PAYMENT_METHOD_REQUIRED }, { status: 400 });
      }
    }

    const filter: Record<string, unknown> = { _id: jobId, ...scope };
    if (hasReview) {
      if (!status) {
        return NextResponse.json({ error: "Status is required" }, { status: 400 });
      }
      filter.status = { $in: REVIEWABLE_STATUSES };
      updatePayload.status = status;
      updatePayload.rejectionNote = status === "rejected" ? rejectionNote ?? "" : "";
    }

    const updatedJob = await Job.findOneAndUpdate(filter, updatePayload, {
      new: true,
      runValidators: true,
    });

    if (!updatedJob) {
      return NextResponse.json(
        { error: hasReview ? "Job not found or not ready for review" : "Job not found" },
        { status: 404 }
      );
    }

    if (hasReview) {
      await audit(user, {
        action: `job.${status}`,
        targetType: "job",
        targetId: new Types.ObjectId(jobId),
        after: { status, rejectionNote: updatePayload.rejectionNote },
      });
    }

    return NextResponse.json(serializeJob(updatedJob));
  } catch (error) {
    return routeError(error, "Failed to update job");
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const user = await requirePermission("jobs.delete");
    const scope = jobScope(user);
    const { id: jobId } = await params;
    assertObjectId(jobId, "Job");

    await connectToDB();

    const deletedJob = await Job.findOneAndDelete({ _id: jobId, ...scope });
    if (!deletedJob) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    await audit(user, {
      action: "job.delete",
      targetType: "job",
      targetId: deletedJob._id,
      before: { jobCount: deletedJob.jobCount, carNumber: deletedJob.carNumber },
    });

    return NextResponse.json({ message: "Job deleted successfully" });
  } catch (error) {
    return routeError(error, "Failed to delete job");
  }
}
