import { connectToDB } from "@/lib/db";
import { Job } from "@/models/Job";
import { NextResponse } from "next/server";
import {
  assertObjectId,
  AuthError,
  can,
  requirePermission,
  routeError,
} from "@/lib/rbac/server";
import { jobScope } from "@/lib/rbac/jobs";
import { buildReceiptData, generateJobPDF, generateReceiptPDF } from "@/lib/pdf";
import { Vat } from "@/models/Vat";
import { toVatSnapshot } from "@/lib/vat";
import { getLocaleFromRequest } from "@/lib/translate";
import { processCarDiagramPng } from "@/lib/carDiagram";
import type { Job as JobType } from "@/types/job";
import { readFile } from "fs/promises";
import { join } from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

type PdfKind = "report" | "receipt" | "report_receipt";

/** `type=report|receipt|report_receipt`; the older `receipt=1` still means receipt. */
function pdfKind(searchParams: URLSearchParams): PdfKind {
  const type = searchParams.get("type");
  if (type === "receipt" || type === "report_receipt") return type;
  if (searchParams.get("receipt") === "1") return "receipt";
  return "report";
}

// Paths are written out in full (not built from variables) so the deploy build can see
// these files and bundle them; next.config.ts also lists them in outputFileTracingIncludes.
const BANNER_PATH = join(process.cwd(), "public", "report-banner.jpeg");
const DIAGRAM_PATH = join(process.cwd(), "public", "car-diagram.png");
const RECEIPT_LOGO_PATH = join(process.cwd(), "public", "receipt-logo.png");

async function readAsset(path: string): Promise<Uint8Array | undefined> {
  try {
    return new Uint8Array(await readFile(path));
  } catch (e) {
    console.warn(`[pdf] ${path} load failed:`, e instanceof Error ? e.message : e);
    return undefined;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const started = Date.now();
  let jobId = "?";

  try {
    const user = await requirePermission("jobs.download_pdf");
    const scope = jobScope(user);
    const kind = pdfKind(new URL(req.url).searchParams);
    const wantsReceipt = kind !== "report";
    if (wantsReceipt && !can(user, "jobs.download_receipt")) {
      throw new AuthError(403, "You do not have permission to download receipts");
    }

    const { id } = await params;
    assertObjectId(id, "Job");
    jobId = id;
    console.log(`[pdf] request id=${id} type=${kind}`);
    await connectToDB();
    const job = await Job.findOne({ _id: id, ...scope })
      .populate("assignedTo", "name email")
      .populate("createdBy", "name email")
      .lean();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const jobData = job as unknown as JobType;
    let receipt = null;
    if (wantsReceipt) {
      // Jobs created before VAT was recorded on each job use the currently active VAT.
      const fallbackVat = jobData.vat
        ? null
        : toVatSnapshot(await Vat.findOne({ isActive: true }).lean());
      receipt = buildReceiptData(jobData, {
        fallbackVat,
        logoBytes: await readAsset(RECEIPT_LOGO_PATH),
      });
    }

    let pdfBytes: Uint8Array;
    if (kind === "receipt") {
      pdfBytes = await generateReceiptPDF(receipt!);
    } else {
      const bannerBytes = await readAsset(BANNER_PATH);
      const diagramBytes = await readAsset(DIAGRAM_PATH);
      let carDiagramBytes: Uint8Array | undefined;
      try {
        carDiagramBytes = diagramBytes ? await processCarDiagramPng(diagramBytes) : undefined;
      } catch (e) {
        console.warn(`[pdf] diagram processing failed:`, e instanceof Error ? e.message : e);
      }
      pdfBytes = await generateJobPDF(jobData, {
        locale: getLocaleFromRequest(req),
        bannerBytes,
        carDiagramBytes,
        // Report + Receipt keeps the report exactly as the old priced report.
        includePrice: kind === "report_receipt",
        receipt,
      });
    }

    const safeName = job.customerName
      ? job.customerName.replace(/[^a-z0-9]/gi, "_").toLowerCase()
      : "unknown";
    const suffix = { report: "", receipt: "-receipt", report_receipt: "-report-receipt" }[kind];
    const filename = `job-${safeName}${suffix}.pdf`;

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
    if (error instanceof AuthError) return routeError(error);
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
      { error: "Failed to generate PDF" },
      { status: 500 }
    );
  }
}
