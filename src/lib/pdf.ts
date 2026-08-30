import type { Job } from "@/types/job";
import {
  PDF_LABELS_EN,
  PDF_TRANSLATABLE_LABEL_KEYS,
  type PdfLabels,
} from "@/lib/pdfLabels";
import { bytesToDataUrl } from "@/lib/pdfAssets";
import { renderHtmlToPdf } from "@/lib/pdfBrowser";
import { buildReportHtml, type ReportIssue } from "@/lib/pdfTemplate";
import { translateBatch } from "@/lib/translate";

type GenerateJobPDFOptions = {
  locale?: string;
  bannerBytes?: Uint8Array;
  carDiagramBytes?: Uint8Array;
  includePrice?: boolean;
};

const TIMEZONE = "Asia/Dubai";

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

  const translateStarted = Date.now();
  const { labels, issues } = await buildTranslatedContent(job, locale);
  console.log(
    `[pdf] translated locale=${locale} issues=${issues.length} in ${
      Date.now() - translateStarted
    }ms`
  );

  const fallback = PDF_LABELS_EN.fallback;
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
      { label: PDF_LABELS_EN.vehicle, value: job.carNumber || fallback },
      {
        label: PDF_LABELS_EN.chassis,
        value: job.engineNumber ? String(job.engineNumber).toUpperCase() : fallback,
      },
      { label: PDF_LABELS_EN.inspector, value: job.customerName || fallback },
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
        )}`
      : null,
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
