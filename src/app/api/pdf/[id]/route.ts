import { connectToDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { NextResponse } from "next/server";
import { generateJobPDF } from "@/lib/pdf";
import { getLocaleFromRequest } from "@/lib/translate";
import { processCarDiagramPng } from "@/lib/carDiagram";
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
    let carDiagramBytes: Uint8Array | undefined;
    try {
      const bannerPath = join(process.cwd(), "public", "report-banner.jpeg");
      const bannerBuffer = await readFile(bannerPath);
      bannerBytes = new Uint8Array(bannerBuffer);
    } catch (e) {
      console.warn("Failed to load banner image:", e);
    }

    try {
      const diagramPath = join(process.cwd(), "public", "car-diagram.png");
      const diagramBuffer = await readFile(diagramPath);
      carDiagramBytes = await processCarDiagramPng(new Uint8Array(diagramBuffer));
    } catch (e) {
      console.warn("Failed to load car diagram image:", e);
    }

    const locale = getLocaleFromRequest(req);
    const receipt = new URL(req.url).searchParams.get("receipt") === "1";
    const pdfBytes = await generateJobPDF(job as JobType, {
      locale,
      bannerBytes,
      carDiagramBytes,
      includePrice: receipt,
    });

    const safeName = job.customerName
      ? job.customerName.replace(/[^a-z0-9]/gi, "_").toLowerCase()
      : "unknown";
    const filename = receipt
      ? `job-${safeName}-receipt.pdf`
      : `job-${safeName}.pdf`;

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      {
        error: "Failed to generate PDF",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
