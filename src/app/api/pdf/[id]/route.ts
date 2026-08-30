import { connectToDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { NextResponse } from "next/server";
import { generateJobPDF } from "@/lib/pdf";
import { getLocaleFromRequest } from "@/lib/translate";
import { processCarDiagramPng } from "@/lib/carDiagram";
import type { Job as JobType } from "@/types/job";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const started = Date.now();
  let jobId = "?";

  try {
    const { id } = await params;
    jobId = id;
    console.log(`[pdf] request id=${id}`);
    await connectToDB();
    const job = await Job.findById(id).lean();

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
      console.warn(`[pdf] banner load failed:`, e instanceof Error ? e.message : e);
    }

    try {
      const diagramPath = join(process.cwd(), "public", "car-diagram.png");
      const diagramBuffer = await readFile(diagramPath);
      carDiagramBytes = await processCarDiagramPng(new Uint8Array(diagramBuffer));
    } catch (e) {
      console.warn(`[pdf] diagram load failed:`, e instanceof Error ? e.message : e);
    }

    const locale = getLocaleFromRequest(req);
    const receipt = new URL(req.url).searchParams.get("receipt") === "1";
    const pdfBytes = await generateJobPDF(job as unknown as JobType, {
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

    console.log(
      `[pdf] done id=${jobId} ${Math.round(pdfBytes.length / 1024)}KB in ${
        Date.now() - started
      }ms`
    );

    return new NextResponse(Buffer.from(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[pdf] FAILED id=${jobId} after ${Date.now() - started}ms: ${
        error instanceof Error ? error.name : "Error"
      }: ${message}`
    );
    console.error(
      `[pdf] stack: ${
        error instanceof Error
          ? (error.stack ?? "").split("\n").slice(1, 4).join(" | ")
          : "n/a"
      }`
    );

    return NextResponse.json(
      { error: "Failed to generate PDF", details: message },
      { status: 500 }
    );
  }
}
