import type { Job, VatSnapshot } from "@/types/job";
import { paymentMethodLabel } from "@/config/paymentMethods";
import {
  PDF_LABELS_EN,
  PDF_TRANSLATABLE_LABEL_KEYS,
  type PdfLabels,
} from "@/lib/pdfLabels";
import { bytesToDataUrl } from "@/lib/pdfAssets";
import { renderHtmlToPdf } from "@/lib/pdfBrowser";
import { buildReportHtml, type ReportIssue } from "@/lib/pdfTemplate";
import { buildReceiptHtml, renderReceipt, type ReceiptData } from "@/lib/receiptTemplate";
import { splitVatInclusive } from "@/lib/vat";
import { carNameOf } from "@/lib/serializeJob";
import { translateBatch } from "@/lib/translate";

type GenerateJobPDFOptions = {
  locale?: string;
  bannerBytes?: Uint8Array;
  carDiagramBytes?: Uint8Array;
  includePrice?: boolean;
  /** Appends the receipt as the last page. */
  receipt?: ReceiptData | null;
};

const TIMEZONE = "Asia/Dubai";

function formatDate(value: string | Date | null | undefined): string {
  const date = value ? new Date(value) : new Date();
  return (Number.isNaN(date.getTime()) ? new Date() : date).toLocaleDateString("en-GB", {
    timeZone: TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Receipt content for a job. The job price already includes VAT; `fallbackVat` is used
 * for jobs created before VAT was recorded on each job.
 */
export function buildReceiptData(
  job: Job,
  options: { fallbackVat?: VatSnapshot | null; logoBytes?: Uint8Array } = {}
): ReceiptData {
  const vat = job.vat ?? options.fallbackVat ?? null;
  const vatPercentage = vat && vat.percentage > 0 ? vat.percentage : null;
  const amounts = splitVatInclusive(Number(job.price) || 0, vatPercentage ?? 0);
  const paid = Boolean(job.paymentReceivedBy);

  return {
    logoUrl: options.logoBytes ? bytesToDataUrl(options.logoBytes) : null,
    registrationNumber: vat?.registrationNumber?.trim() || null,
    receiptNumber: `RCP-${String(job.jobCount ?? 0).padStart(6, "0")}`,
    date: formatDate(paid ? job.paymentReceivedAt : job.createdAt),
    paid,
    paymentMethod: paymentMethodLabel(job.paymentMethod),
    customerPhone: job.customerPhone?.trim() || "",
    carName: carNameOf(job) || "-",
    chassis: job.engineNumber ? String(job.engineNumber).toUpperCase() : "",
    service: job.inspectionType?.trim() || "Vehicle inspection",
    jobNumber: `#${job.jobCount ?? "-"}`,
    inspector:
      job.assignedTo && typeof job.assignedTo === "object"
        ? job.assignedTo.name?.trim() || job.assignedTo.email
        : "",
    total: amounts.total,
    net: amounts.net,
    vatAmount: amounts.vatAmount,
    vatPercentage,
    generatedTimestamp: new Date().toLocaleString("en-GB", { timeZone: TIMEZONE }),
  };
}

export async function generateReceiptPDF(receipt: ReceiptData): Promise<Uint8Array> {
  return renderHtmlToPdf(await buildReceiptHtml(receipt));
}

async function buildTranslatedContent(
  job: Job,
  locale: string
): Promise<{ labels: PdfLabels; issues: ReportIssue[] }> {
  const issues: ReportIssue[] = [];

  for (const tab of job.inspectionTabs || []) {
    for (const issue of tab.subIssues || []) {
      issues.push({
        severity: issue.severity,
        label: issue.label ?? PDF_LABELS_EN.fallback,
        comment: issue.comment?.trim() ?? "",
      });
    }
  }

  const stringsToTranslate = [
    ...PDF_TRANSLATABLE_LABEL_KEYS.map((key) => PDF_LABELS_EN[key]),
    ...issues.map((i) => i.label),
    ...issues.filter((i) => i.comment).map((i) => i.comment),
  ];

  const translated = await translateBatch(stringsToTranslate, locale);

  const labels = { ...PDF_LABELS_EN };
  let index = 0;
  for (const key of PDF_TRANSLATABLE_LABEL_KEYS) {
    labels[key] = translated[index++] ?? PDF_LABELS_EN[key];
  }

  const translatedIssues = issues.map((issue, issueIndex) => {
    const labelIndex = PDF_TRANSLATABLE_LABEL_KEYS.length + issueIndex;
    const commentOffset = PDF_TRANSLATABLE_LABEL_KEYS.length + issues.length;
    const commentIndex = issues
      .slice(0, issueIndex)
      .filter((i) => i.comment).length;

    return {
      ...issue,
      label: translated[labelIndex] ?? issue.label,
      comment: issue.comment
        ? translated[commentOffset + commentIndex] ?? issue.comment
        : "",
    };
  });

  return { labels, issues: translatedIssues };
}

function countSeverity(job: Job, severity: "ok" | "minor" | "major"): number {
  return (
    job.inspectionTabs
      ?.flatMap((tab) => tab.subIssues)
      .filter((i) => i.severity === severity).length || 0
  );
}

export async function generateJobPDF(
  job: Job,
  options: GenerateJobPDFOptions = {}
): Promise<Uint8Array> {
  const locale = options.locale ?? "en";
  const includePrice = options.includePrice ?? false;
  const jobPrice = Math.max(0, Number(job.price) || 0);
  const showCost = includePrice && jobPrice > 0;
  const paymentMethod = paymentMethodLabel(job.paymentMethod);

  const translateStarted = Date.now();
  const { labels, issues } = await buildTranslatedContent(job, locale);
  console.log(
    `[pdf] translated locale=${locale} issues=${issues.length} in ${
      Date.now() - translateStarted
    }ms`
  );

  const fallback = PDF_LABELS_EN.fallback;
  // The inspector is the user the job is assigned to.
  const assignee = job.assignedTo;
  const inspector =
    (assignee && typeof assignee === "object"
      ? assignee.name?.trim() || assignee.email
      : "") || fallback;
  const inspectionType = job.inspectionType?.trim() || fallback;
  const reportDate = new Date().toLocaleDateString("en-GB", {
    timeZone: TIMEZONE,
  });

  const html = await buildReportHtml({
    locale,
    labels,
    issues,
    inspectionType,
    metaFields: [
      { label: PDF_LABELS_EN.fileNumber, value: String(job.jobCount ?? fallback) },
      { label: PDF_LABELS_EN.vehicle, value: carNameOf(job) || fallback },
      {
        label: PDF_LABELS_EN.chassis,
        value: job.engineNumber ? String(job.engineNumber).toUpperCase() : fallback,
      },
      { label: PDF_LABELS_EN.inspector, value: inspector },
      { label: PDF_LABELS_EN.date, value: reportDate },
      { label: PDF_LABELS_EN.currentOdo, value: String(job.odometer ?? fallback) },
    ],
    summary: {
      okay: countSeverity(job, "ok"),
      minor: countSeverity(job, "minor"),
      major: countSeverity(job, "major"),
    },
    costText: showCost
      ? `${inspectionType} ${PDF_LABELS_EN.cost}: AED ${jobPrice.toLocaleString(
          "en-AE"
        )}${paymentMethod ? ` (${paymentMethod})` : ""}`
      : null,
    receiptHtml: options.receipt ? renderReceipt(options.receipt, true) : null,
    generatedTimestamp: new Date().toLocaleString("en-GB", {
      timeZone: TIMEZONE,
    }),
    bannerUrl: options.bannerBytes ? bytesToDataUrl(options.bannerBytes) : null,
    diagramUrl: options.carDiagramBytes
      ? bytesToDataUrl(options.carDiagramBytes)
      : null,
  });

  console.log(`[pdf] html ${Math.round(html.length / 1024)}KB`);

  return renderHtmlToPdf(html);
}
