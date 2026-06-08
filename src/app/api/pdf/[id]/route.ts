// @ts-nocheck
import { connectToDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { NextResponse } from "next/server";
import { generateJobPDF } from "@/lib/pdf";
import { readFile } from "fs/promises";
import { join } from "path";

// src/pages/api/pdf.ts
console.log("📄 PDF API route START", new Date().toISOString());
export async function GET(req, { params }) {
  try {
    await connectToDB();
    const job = await Job.findById(params.id).lean();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Load banner image
    let bannerBytes;
    try {
      const bannerPath = join(process.cwd(), "public", "report-banner.jpeg");
      const bannerBuffer = await readFile(bannerPath);
      bannerBytes = new Uint8Array(bannerBuffer);
    } catch (e) {
      console.warn("Failed to load banner image:", e);
    }

    const pdfBytes = await generateJobPDF(job, undefined, bannerBytes);

    // Create safe filename from customer name
    const safeName = job.customerName
      ? job.customerName.replace(/[^a-z0-9]/gi, "_").toLowerCase()
      : "unknown";

    return new NextResponse(pdfBytes, {
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
