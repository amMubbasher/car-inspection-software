// Receipt PDF layout: a single centred receipt slip.
// Rendered on its own, or appended to the inspection report as an extra page; every class
// is prefixed with "rc-" so it can't clash with the report's CSS.
import { COMPANY } from "@/config/company";
import { fontDataUrl, fontFormat, isRtlLocale, scriptFontFile } from "@/lib/pdfAssets";

/** Receipt wording in English; translated per download (see localizeReceipt in pdf.ts). */
export const RECEIPT_LABELS_EN = {
  taxInvoice: "Tax Invoice",
  receipt: "Receipt",
  receiptNo: "Receipt no.",
  date: "Date",
  jobNo: "Job no.",
  carName: "Car name",
  chassis: "Chassis number",
  customerPhone: "Customer phone",
  inspector: "Inspector",
  subtotal: "Subtotal (excl. VAT)",
  vat: "VAT",
  total: "Total",
  inclusiveOfVat: "Inclusive of VAT",
  paymentMethod: "Payment method",
  paid: "PAID",
  unpaid: "UNPAID",
  thankYou: "Thank you for choosing",
  generatedOn: "Generated on",
};

export type ReceiptLabels = typeof RECEIPT_LABELS_EN;

export type ReceiptData = {
  /** Language the receipt is written in; "en" when not translated. */
  locale: string;
  labels: ReceiptLabels;
  logoUrl: string | null;
  /** VAT registration number (TRN); null when no VAT is set up. */
  registrationNumber: string | null;
  receiptNumber: string;
  date: string;
  paid: boolean;
  paymentMethod: string;
  customerPhone: string;
  carName: string;
  chassis: string;
  inspector: string;
  service: string;
  jobNumber: string;
  total: number;
  net: number;
  vatAmount: number;
  /** null when no VAT applies; the receipt then shows only the total. */
  vatPercentage: number | null;
  generatedTimestamp: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function money(value: number): string {
  return `${COMPANY.currency} ${value.toLocaleString("en-AE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function percent(value: number): string {
  return `${Number(value.toFixed(2))}%`;
}

/**
 * NotoSans-Regular.ttf is a variable font, so declaring its weight range gives real bold/black.
 * The script font (Arabic, Devanagari, Chinese) covers the characters Latin can't; its weight
 * range lets Chrome use it for bold text too.
 */
export function receiptFontFace(
  latinUrl: string | null,
  scriptUrl: string | null = null,
  scriptFile: string | null = null
): string {
  const faces: string[] = [];
  if (latinUrl) {
    faces.push(
      `@font-face{font-family:'ReceiptLatin';src:url('${latinUrl}') format('truetype');font-weight:100 900;font-display:block;}`
    );
  }
  if (scriptUrl && scriptFile) {
    faces.push(
      `@font-face{font-family:'ReceiptScript';src:url('${scriptUrl}') format('${fontFormat(scriptFile)}');font-weight:100 900;font-display:block;}`
    );
  }
  return faces.join("");
}

export const RECEIPT_CSS = `
.rc { font-family: 'ReceiptLatin', 'ReceiptScript', Arial, Helvetica, sans-serif; color: #1f2937; font-size: 10pt; line-height: 1.45; }
.rc[dir="rtl"] .rc-val, .rc[dir="rtl"] .rc-vat-note { text-align: left; }
.rc-page { break-before: page; page-break-before: always; }
.rc-paper { width: 330pt; margin: 6pt auto 0; padding: 26pt 24pt 22pt; background: #ffffff; border: 1pt solid #e5e7eb; border-radius: 4pt; box-shadow: 0 1pt 6pt rgba(17, 24, 39, 0.06); }

.rc-header { text-align: center; }
.rc-logo { width: 54pt; height: auto; margin: 0 auto 8pt; }
.rc-name { font-size: 17pt; font-weight: 800; letter-spacing: 1.5pt; color: #111827; text-transform: uppercase; }
.rc-tagline { margin-top: 1pt; font-size: 8.5pt; font-weight: 600; letter-spacing: 1.2pt; color: #6b7280; text-transform: uppercase; }
.rc-contact { margin-top: 8pt; font-size: 8.5pt; color: #4b5563; line-height: 1.5; }
.rc-trn { margin-top: 4pt; font-size: 8.5pt; color: #4b5563; }

.rc-title { margin-top: 16pt; text-align: center; font-size: 11pt; font-weight: 700; letter-spacing: 3pt; color: #4f46e5; text-transform: uppercase; }

.rc-cut { margin: 12pt 0; border-top: 1.2pt dashed #c7cbd1; }
.rc-line { display: flex; justify-content: space-between; gap: 12pt; padding: 2.5pt 0; }
.rc-key { color: #6b7280; }
.rc-val { color: #111827; font-weight: 600; text-align: right; }

.rc-item { display: flex; justify-content: space-between; gap: 12pt; align-items: baseline; }
.rc-item-name { font-size: 10.5pt; font-weight: 700; color: #111827; }
.rc-item-price { font-weight: 700; color: #111827; white-space: nowrap; }

.rc-total { display: flex; justify-content: space-between; align-items: baseline; margin-top: 6pt; padding-top: 8pt; border-top: 1.2pt solid #111827; }
.rc-total-label { font-size: 11pt; font-weight: 800; color: #111827; text-transform: uppercase; letter-spacing: 0.6pt; }
.rc-total-value { font-size: 15pt; font-weight: 800; color: #111827; }
.rc-vat-note { margin-top: 4pt; font-size: 8pt; color: #6b7280; text-align: right; }

.rc-status { text-align: center; }
.rc-badge { display: inline-block; padding: 3pt 14pt; border-radius: 99pt; font-size: 9pt; font-weight: 700; letter-spacing: 1.5pt; }
.rc-badge-paid { background: #dcfce7; color: #15803d; }
.rc-badge-unpaid { background: #fef3c7; color: #b45309; }

.rc-thanks { text-align: center; font-size: 11pt; font-weight: 700; color: #111827; }
.rc-foot { margin-top: 3pt; text-align: center; font-size: 8pt; color: #9ca3af; }
`;

/** The receipt body. `asExtraPage` starts it on a new page (when appended to the report). */
export function renderReceipt(data: ReceiptData, asExtraPage = false): string {
  const hasVat = data.vatPercentage !== null;
  const t = data.labels;
  // Values such as amounts, phone numbers and chassis keep their own direction in RTL receipts.
  const line = (key: string, value: string) =>
    `<div class="rc-line"><span class="rc-key">${escapeHtml(key)}</span><span class="rc-val" dir="auto">${escapeHtml(value || "-")}</span></div>`;

  const vehicle = [line(t.carName, data.carName)];
  if (data.chassis) vehicle.push(line(t.chassis, data.chassis));
  if (data.customerPhone) vehicle.push(line(t.customerPhone, data.customerPhone));
  vehicle.push(line(t.inspector, data.inspector));

  const amounts = hasVat
    ? line(t.subtotal, money(data.net)) +
      line(`${t.vat} (${percent(data.vatPercentage!)})`, money(data.vatAmount))
    : "";

  const dir = isRtlLocale(data.locale) ? "rtl" : "ltr";
  return `<section class="rc${asExtraPage ? " rc-page" : ""}" dir="${dir}" lang="${escapeHtml(data.locale)}">
<div class="rc-paper">
  <div class="rc-header">
    ${data.logoUrl ? `<img class="rc-logo" src="${data.logoUrl}" alt="">` : ""}
    <div class="rc-name">${escapeHtml(COMPANY.name)}</div>
    <div class="rc-tagline">${escapeHtml(COMPANY.tagline)}</div>
    <div class="rc-contact" dir="ltr">${escapeHtml(COMPANY.addressLines.join(" "))}<br>${escapeHtml(COMPANY.phone)}</div>
    ${data.registrationNumber ? `<div class="rc-trn" dir="ltr">TRN: ${escapeHtml(data.registrationNumber)}</div>` : ""}
  </div>

  <div class="rc-title">${escapeHtml(hasVat ? t.taxInvoice : t.receipt)}</div>

  <div class="rc-cut"></div>
  ${line(t.receiptNo, data.receiptNumber)}
  ${line(t.date, data.date)}
  ${line(t.jobNo, data.jobNumber)}

  <div class="rc-cut"></div>
  ${vehicle.join("")}

  <div class="rc-cut"></div>
  <div class="rc-item">
    <div>
      <div class="rc-item-name">${escapeHtml(data.service)}</div>
    </div>
    <div class="rc-item-price" dir="ltr">${money(hasVat ? data.net : data.total)}</div>
  </div>

  ${hasVat ? `<div class="rc-cut"></div>${amounts}` : ""}
  <div class="rc-total">
    <span class="rc-total-label">${escapeHtml(t.total)}</span>
    <span class="rc-total-value" dir="ltr">${money(data.total)}</span>
  </div>
  ${hasVat ? `<div class="rc-vat-note">${escapeHtml(t.inclusiveOfVat)} <span dir="ltr">${percent(data.vatPercentage!)}</span></div>` : ""}

  <div class="rc-cut"></div>
  ${line(t.paymentMethod, data.paymentMethod)}
  <div class="rc-status" style="margin-top:8pt">
    <span class="rc-badge ${data.paid ? "rc-badge-paid" : "rc-badge-unpaid"}">${escapeHtml(data.paid ? t.paid : t.unpaid)}</span>
  </div>

  <div class="rc-cut"></div>
  <div class="rc-thanks">${escapeHtml(t.thankYou)} <span dir="ltr">${escapeHtml(COMPANY.name)}</span></div>
  <div class="rc-foot">${escapeHtml(t.generatedOn)} <span dir="ltr">${escapeHtml(data.generatedTimestamp)}</span></div>
</div>
</section>`;
}

/** A complete HTML document with only the receipt. */
export async function buildReceiptHtml(data: ReceiptData): Promise<string> {
  const scriptFile = scriptFontFile(data.locale);
  const [latinUrl, scriptUrl] = await Promise.all([
    fontDataUrl("NotoSans-Regular.ttf"),
    scriptFile ? fontDataUrl(scriptFile) : Promise.resolve(null),
  ]);
  const fontFace = receiptFontFace(latinUrl, scriptUrl, scriptFile);
  return `<!DOCTYPE html>
<html lang="${escapeHtml(data.locale)}">
<head>
<meta charset="utf-8">
<style>
${fontFace}
@page { size: A4; margin: 36pt 40pt; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: #ffffff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
img { display: block; }
${RECEIPT_CSS}
</style>
</head>
<body>
${renderReceipt(data)}
</body>
</html>`;
}
