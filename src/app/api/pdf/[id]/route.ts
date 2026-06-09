import { connectToDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { NextResponse } from "next/server";
import { generateJobPDF } from "@/lib/pdf";
import { getLocaleFromRequest } from "@/lib/translate";
import type { Job as JobType } from "@/types/job";
import { readFile } from "fs/promises";
import { join } from "path";
import type { Model } from "mongoose";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await connectToDB();
    const job = await (Job as Model<JobType>).findById(id).lean();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    let bannerBytes: Uint8Array | undefined;
    try {
      const bannerPath = join(process.cwd(), "public", "report-banner.jpeg");
      const bannerBuffer = await readFile(bannerPath);
      bannerBytes = new Uint8Array(bannerBuffer);
    } catch (e) {
      console.warn("Failed to load banner image:", e);
    }

    const locale = getLocaleFromRequest(req);
    const pdfBytes = await generateJobPDF(job as JobType, { locale, bannerBytes });

    const safeName = job.customerName
      ? job.customerName.replace(/[^a-z0-9]/gi, "_").toLowerCase()
      : "unknown";

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="job-${safeName}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
