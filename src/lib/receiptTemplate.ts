// Receipt PDF layout: a single centred receipt slip.
// Rendered on its own, or appended to the inspection report as an extra page; every class
// is prefixed with "rc-" so it can't clash with the report's CSS.
import { COMPANY } from "@/config/company";
import { fontDataUrl } from "@/lib/pdfAssets";

export type ReceiptData = {
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

/** NotoSans-Regular.ttf is a variable font, so declaring its weight range gives real bold/black. */
export function receiptFontFace(latinUrl: string | null): string {
  return latinUrl
    ? `@font-face{font-family:'ReceiptLatin';src:url('${latinUrl}') format('truetype');font-weight:100 900;font-display:block;}`
    : "";
}

export const RECEIPT_CSS = `
.rc { font-family: 'ReceiptLatin', Arial, Helvetica, sans-serif; color: #1f2937; font-size: 10pt; line-height: 1.45; }
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
  const line = (key: string, value: string) =>
    `<div class="rc-line"><span class="rc-key">${escapeHtml(key)}</span><span class="rc-val">${escapeHtml(value || "-")}</span></div>`;

  const vehicle = [line("Car name", data.carName)];
  if (data.chassis) vehicle.push(line("Chassis number", data.chassis));
  if (data.customerPhone) vehicle.push(line("Customer phone", data.customerPhone));
  vehicle.push(line("Inspector", data.inspector));

  const amounts = hasVat
    ? line("Subtotal (excl. VAT)", money(data.net)) +
      line(`VAT (${percent(data.vatPercentage!)})`, money(data.vatAmount))
    : "";

  return `<section class="rc${asExtraPage ? " rc-page" : ""}" dir="ltr">
<div class="rc-paper">
  <div class="rc-header">
    ${data.logoUrl ? `<img class="rc-logo" src="${data.logoUrl}" alt="">` : ""}
    <div class="rc-name">${escapeHtml(COMPANY.name)}</div>
    <div class="rc-tagline">${escapeHtml(COMPANY.tagline)}</div>
    <div class="rc-contact">${escapeHtml(COMPANY.addressLines.join(" "))}<br>${escapeHtml(COMPANY.phone)}</div>
    ${data.registrationNumber ? `<div class="rc-trn">TRN: ${escapeHtml(data.registrationNumber)}</div>` : ""}
  </div>

  <div class="rc-title">${hasVat ? "Tax Invoice" : "Receipt"}</div>

  <div class="rc-cut"></div>
  ${line("Receipt no.", data.receiptNumber)}
  ${line("Date", data.date)}
  ${line("Job no.", data.jobNumber)}

  <div class="rc-cut"></div>
  ${vehicle.join("")}

  <div class="rc-cut"></div>
  <div class="rc-item">
    <div>
      <div class="rc-item-name">${escapeHtml(data.service)}</div>
    </div>
    <div class="rc-item-price">${money(hasVat ? data.net : data.total)}</div>
  </div>

  ${hasVat ? `<div class="rc-cut"></div>${amounts}` : ""}
  <div class="rc-total">
    <span class="rc-total-label">Total</span>
    <span class="rc-total-value">${money(data.total)}</span>
  </div>
  ${hasVat ? `<div class="rc-vat-note">Inclusive of VAT ${percent(data.vatPercentage!)}</div>` : ""}

  <div class="rc-cut"></div>
  ${line("Payment method", data.paymentMethod)}
  <div class="rc-status" style="margin-top:8pt">
    <span class="rc-badge ${data.paid ? "rc-badge-paid" : "rc-badge-unpaid"}">${data.paid ? "PAID" : "UNPAID"}</span>
  </div>

  <div class="rc-cut"></div>
  <div class="rc-thanks">Thank you for choosing ${escapeHtml(COMPANY.name)}</div>
  <div class="rc-foot">Generated on ${escapeHtml(data.generatedTimestamp)}</div>
</div>
</section>`;
}

/** A complete HTML document with only the receipt. */
export async function buildReceiptHtml(data: ReceiptData): Promise<string> {
  const latinUrl = await fontDataUrl("NotoSans-Regular.ttf");
  const fontFace = receiptFontFace(latinUrl);
  return `<!DOCTYPE html>
<html lang="en">
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
