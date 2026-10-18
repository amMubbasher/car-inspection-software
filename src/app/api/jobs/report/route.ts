import { Types } from "mongoose";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { connectToDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { User } from "@/models/User";

export const dynamic = "force-dynamic";

function parseFilterDate(value: string | null, endOfDay: boolean) {
  if (!value) return null;
  const date = value.includes("T")
    ? new Date(value)
    : new Date(endOfDay ? `${value}T23:59:59.999` : `${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    await connectToDB();

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const userIdsParam = searchParams.get("userIds");

    const start = parseFilterDate(startDate, false);
    let end = parseFilterDate(endDate, true);
    if (start && end && end.getTime() <= start.getTime()) {
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
    }

    const selectedIds = (userIdsParam || "")
      .split(",")
      .map((id) => id.trim())
      .filter((id) => Types.ObjectId.isValid(id));

    const users =
      selectedIds.length > 0
        ? await User.find({ _id: { $in: selectedIds } })
            .select("name email")
            .sort({ name: 1 })
            .lean()
        : await User.find()
            .select("name email")
            .sort({ name: 1 })
            .lean();

    const userObjectIds = users.map((user) => user._id);
    const match: Record<string, unknown> = {
      createdBy: { $in: userObjectIds },
    };
    if (start || end) {
      const createdAt: Record<string, Date> = {};
      if (start) createdAt.$gte = start;
      if (end) createdAt.$lte = end;
      match.createdAt = createdAt;
    }

    const aggregates = await Job.aggregate<{
      _id: Types.ObjectId;
      jobCount: number;
      totalPrice: number;
    }>([
      { $match: match },
      {
        $group: {
          _id: "$createdBy",
          jobCount: { $sum: 1 },
          totalPrice: { $sum: { $ifNull: ["$price", 0] } },
        },
      },
    ]);

    const statsByUser = new Map(
      aggregates.map((row) => [
        row._id.toString(),
        {
          jobCount: row.jobCount,
          totalPrice: Math.max(0, Number(row.totalPrice) || 0),
        },
      ])
    );

    const rows = users.map((user) => {
      const id = user._id.toString();
      const stats = statsByUser.get(id) || { jobCount: 0, totalPrice: 0 };
      return {
        userId: id,
        name: user.name?.trim() || "",
        email: user.email,
        jobCount: stats.jobCount,
        totalPrice: stats.totalPrice,
      };
    });

    const totals = rows.reduce(
      (acc, row) => {
        acc.jobCount += row.jobCount;
        acc.totalPrice += row.totalPrice;
        return acc;
      },
      { jobCount: 0, totalPrice: 0 }
    );

    return NextResponse.json(
      { rows, totals },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error: unknown) {
    console.error("Failed to build jobs report:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to build report", details: message },
      { status: 500 }
    );
  }
}
