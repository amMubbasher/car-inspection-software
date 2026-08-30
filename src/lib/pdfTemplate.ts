import type { PdfLabels } from "@/lib/pdfLabels";
import { PDF_LABELS_EN } from "@/lib/pdfLabels";
import { fontDataUrl, isRtlLocale, scriptFontFile } from "@/lib/pdfAssets";

export type ReportIssue = {
  severity: "minor" | "major" | "ok";
  label: string;
  comment: string;
};

export type ReportData = {
  locale: string;
  labels: PdfLabels;
  issues: ReportIssue[];
  metaFields: Array<{ label: string; value: string }>;
  summary: { okay: number; minor: number; major: number };
  inspectionType: string;
  costText: string | null;
  generatedTimestamp: string;
  bannerUrl: string | null;
  diagramUrl: string | null;
};

const SEVERITY_ACCENT: Record<ReportIssue["severity"], string> = {
  minor: "#f2991a",
  major: "#e63333",
  ok: "#1a8cd9",
};

const SECTION_BG: Record<ReportIssue["severity"], string> = {
  minor: "#fff7e6",
  major: "#fff2f2",
  ok: "#f2fbff",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Chrome resolves direction per string, so Arabic and English can share a page. */
function auto(value: string): string {
  return `<span dir="auto">${escapeHtml(value)}</span>`;
}

function buildFontFaces(latinUrl: string | null, scriptUrl: string | null): string {
  const faces: string[] = [];

  if (latinUrl) {
    faces.push(
      `@font-face{font-family:'ReportLatin';src:url('${latinUrl}') format('truetype');font-weight:normal;font-style:normal;font-display:block;}`
    );
  }
  if (scriptUrl) {
    faces.push(
      `@font-face{font-family:'ReportScript';src:url('${scriptUrl}') format('truetype');font-weight:normal;font-style:normal;font-display:block;}`
    );
  }

  return faces.join("");
}

function renderHeader(data: ReportData): string {
  if (data.bannerUrl) {
    return `<div class="banner"><img src="${data.bannerUrl}" alt=""></div>`;
  }

  return `<div class="gradient-header">
      <div class="gradient-title">${escapeHtml(PDF_LABELS_EN.title)}</div>
      <div class="gradient-subtitle">${escapeHtml(PDF_LABELS_EN.subtitle)}</div>
    </div>`;
}

function renderInfoRow(data: ReportData): string {
  const rows = data.metaFields
    .map(
      ({ label, value }) =>
        `<div class="info-line"><span class="info-key">${escapeHtml(
          label
        )}:</span> ${auto(value)}</div>`
    )
    .join("");

  const card = `<div class="info-card">
      <div class="info-title" dir="auto">${escapeHtml(data.inspectionType)}</div>
      ${rows}
    </div>`;

  const diagram = data.diagramUrl
    ? `<div class="diagram"><img src="${data.diagramUrl}" alt=""></div>`
    : "";

  return `<div class="info-row">${card}${diagram}</div>`;
}

function renderBadges(data: ReportData): string {
  const entries: Array<{ label: string; count: number; color: string }> = [
    { label: data.labels.okay, count: data.summary.okay, color: "#1ab333" },
    { label: data.labels.minor, count: data.summary.minor, color: "#f2991a" },
    { label: data.labels.major, count: data.summary.major, color: "#e63333" },
  ];

  const badges = entries
    .map(
      ({ label, count, color }) =>
        `<div class="badge" style="background:${color}">${auto(
          `${label}:`
        )}<span class="badge-count">${count}</span></div>`
    )
    .join("");

  return `<div class="badges">${badges}</div>`;
}

function renderIssue(
  index: number,
  issue: ReportIssue,
  commentLabel: string
): string {
  const heading = `<div class="issue" style="border-inline-start-color:${
    SEVERITY_ACCENT[issue.severity]
  }">
      <span class="issue-num">${index}.</span>
      <span class="issue-text" dir="auto">${escapeHtml(
        issue.label || PDF_LABELS_EN.fallback
      )}</span>
    </div>`;

  if (!issue.comment) return heading;

  const comment = `<div class="comment">
      <div class="comment-label" dir="auto">${escapeHtml(commentLabel)}</div>
      <div class="comment-text" dir="auto">${escapeHtml(issue.comment)}</div>
    </div>`;

  return `<div class="issue-block">${heading}${comment}</div>`;
}

function renderSections(data: ReportData): string {
  const order: Array<{ key: ReportIssue["severity"]; title: string }> = [
    { key: "minor", title: data.labels.sectionMinor },
    { key: "major", title: data.labels.sectionMajor },
    { key: "ok", title: data.labels.sectionOk },
  ];

  return order
    .map(({ key, title }) => {
      const sectionIssues = data.issues.filter((i) => i.severity === key);
      if (sectionIssues.length === 0) return "";

      const items = sectionIssues
        .map((issue, i) => renderIssue(i + 1, issue, data.labels.comment))
        .join("");

      return `<div class="section">
          <div class="section-bar" dir="auto" style="background:${
            SECTION_BG[key]
          }">${escapeHtml(title)}</div>
          ${items}
        </div>`;
    })
    .join("");
}

function renderDisclaimer(): string {
  return `<div class="disclaimer">
      <div class="disclaimer-head">${escapeHtml(PDF_LABELS_EN.disclaimer)}</div>
      <div class="disclaimer-body">
        <ul>
          <li>${escapeHtml(PDF_LABELS_EN.disclaimerLine1)}</li>
          <li>${escapeHtml(PDF_LABELS_EN.disclaimerLine2)}</li>
        </ul>
        <div class="signature"><div class="signature-line"></div></div>
      </div>
    </div>`;
}

export async function buildReportHtml(data: ReportData): Promise<string> {
  const scriptFile = scriptFontFile(data.locale);
  const [latinUrl, scriptUrl] = await Promise.all([
    fontDataUrl("NotoSans-Regular.ttf"),
    scriptFile ? fontDataUrl(scriptFile) : Promise.resolve(null),
  ]);

  const fontStack = [
    latinUrl ? "'ReportLatin'" : null,
    scriptUrl ? "'ReportScript'" : null,
    "Arial",
    "Helvetica",
    "sans-serif",
  ]
    .filter(Boolean)
    .join(",");

  const costBlock = data.costText
    ? `<div class="cost" dir="auto">${escapeHtml(data.costText)}</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="${escapeHtml(data.locale)}"${isRtlLocale(data.locale) ? ' data-rtl="1"' : ""}>
<head>
<meta charset="utf-8">
<style>
${buildFontFaces(latinUrl, scriptUrl)}
@page { size: A4; margin: 40pt; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: ${fontStack};
  font-size: 11pt;
  line-height: 1.35;
  color: #333333;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
img { display: block; }
.banner img { width: 100%; height: auto; }
.gradient-header {
  height: 100pt;
  background: linear-gradient(to right, #591a99, #1a66cc);
  color: #ffffff;
  padding: 0 0 0 120pt;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.gradient-title { font-size: 24pt; font-weight: bold; }
.gradient-subtitle { font-size: 12pt; color: #e6e6e6; }
.info-row { display: flex; gap: 12pt; margin-top: 16pt; align-items: stretch; }
.info-card {
  flex: 1;
  border: 1pt solid #b3b3b3;
  background: #f5f5ff;
  padding: 10pt;
  min-height: 190pt;
}
.info-title {
  font-size: 13pt;
  font-weight: bold;
  color: #333380;
  margin-bottom: 8pt;
}
.info-line { font-size: 11pt; line-height: 15pt; }
.info-key { color: #333333; }
.diagram { width: 283pt; display: flex; align-items: center; justify-content: flex-end; }
.diagram img { max-width: 100%; max-height: 200pt; }
.cost {
  margin-top: 10pt;
  height: 28pt;
  border: 1pt solid #8c8cbf;
  background: #ebf0ff;
  display: flex;
  align-items: center;
  padding: 0 10pt;
  font-size: 12pt;
  font-weight: bold;
}
.summary-heading {
  margin: 18pt 0 12pt;
  font-size: 14pt;
  font-weight: bold;
  color: #333380;
}
.badges { display: flex; gap: 12pt; }
.badge {
  min-width: 110pt;
  height: 25pt;
  display: flex;
  align-items: center;
  gap: 5pt;
  padding: 0 10pt;
  color: #ffffff;
  font-size: 11pt;
  font-weight: bold;
}
.section { margin-top: 18pt; }
.section-bar {
  height: 22pt;
  display: flex;
  align-items: center;
  padding: 0 10pt;
  font-size: 12pt;
  font-weight: bold;
  color: #333333;
  margin-bottom: 12pt;
}
.issue-block { break-inside: avoid; page-break-inside: avoid; }
.issue {
  display: flex;
  gap: 4pt;
  border-inline-start: 3pt solid #454545;
  padding-inline-start: 10pt;
  min-height: 18pt;
  font-size: 11.5pt;
  font-weight: bold;
  color: #212121;
  line-height: 16pt;
  margin-bottom: 6pt;
  break-inside: avoid;
  page-break-inside: avoid;
}
.issue-text { flex: 1; }
.comment {
  background: #f5f5f5;
  border: 1pt solid #d1d1d1;
  padding: 8pt;
  margin-bottom: 10pt;
  break-inside: avoid;
  page-break-inside: avoid;
}
.comment-label {
  font-size: 10.5pt;
  font-weight: bold;
  color: #404040;
  line-height: 14pt;
}
.comment-text { font-size: 10.5pt; color: #333333; line-height: 14pt; }
.disclaimer { margin-top: 22pt; break-inside: avoid; page-break-inside: avoid; }
.disclaimer-head {
  height: 22pt;
  background: #000000;
  color: #ffffff;
  font-size: 12pt;
  font-weight: bold;
  display: flex;
  align-items: center;
  padding: 0 10pt;
}
.disclaimer-body {
  border: 1pt solid #000000;
  border-top: none;
  background: #ffffff;
  padding: 10pt 10pt 6pt;
}
.disclaimer-body ul { list-style: none; margin: 0; padding: 0; }
.disclaimer-body li {
  position: relative;
  padding-left: 14pt;
  font-size: 10pt;
  line-height: 13pt;
  color: #1a1a80;
  margin-bottom: 4pt;
}
.disclaimer-body li::before {
  content: "\\2022";
  position: absolute;
  left: 0;
  color: #ff6600;
  font-weight: bold;
}
.signature { display: flex; justify-content: flex-end; margin-top: 14pt; }
.signature-line { width: 170pt; border-top: 1pt solid #000000; }
.generated { margin-top: 12pt; font-size: 9pt; color: #808080; }
</style>
</head>
<body>
${renderHeader(data)}
${renderInfoRow(data)}
${costBlock}
<div class="summary-heading" dir="auto">${escapeHtml(
    data.labels.summaryHeading
  )}</div>
${renderBadges(data)}
${renderSections(data)}
${renderDisclaimer()}
<div class="generated">${auto(data.labels.generatedOn)} ${escapeHtml(
    data.generatedTimestamp
  )}</div>
</body>
</html>`;
}
