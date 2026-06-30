import { PDFDocument, PDFFont, rgb } from "pdf-lib";
import type { Job } from "@/types/job";
import {
  PDF_LABELS_EN,
  PDF_TRANSLATABLE_LABEL_KEYS,
  type PdfLabels,
} from "@/lib/pdfLabels";
import { embedPdfFonts, shapePdfText } from "@/lib/pdfFonts";
import { translateBatch } from "@/lib/translate";

type GenerateJobPDFOptions = {
  locale?: string;
  bannerBytes?: Uint8Array;
};

type IssueEntry = {
  severity: "minor" | "major" | "ok";
  label: string;
  comment: string;
  price: number;
};

async function buildTranslatedContent(
  job: Job,
  locale: string
): Promise<{ labels: PdfLabels; issues: IssueEntry[] }> {
  const issues: IssueEntry[] = [];

  for (const tab of job.inspectionTabs || []) {
    for (const issue of tab.subIssues || []) {
      issues.push({
        severity: issue.severity,
        label: issue.label ?? PDF_LABELS_EN.fallback,
        comment: issue.comment?.trim() ?? "",
        price: issue.price ?? 0,
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

export async function generateJobPDF(
  job: Job,
  options: GenerateJobPDFOptions = {}
): Promise<Uint8Array> {
  const locale = options.locale ?? "en";
  const bannerBytes = options.bannerBytes;
  const { labels, issues } = await buildTranslatedContent(job, locale);

  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]);
  const { font, boldFont, latinFont, latinBoldFont } = await embedPdfFonts(
    pdfDoc,
    locale
  );

  let { height, width } = page.getSize();
  let y = height - 70;
  const marginX = 40;
  const tz = "Asia/Dubai";

  const t = (text: string) => shapePdfText(text, locale);

  const drawLatin = (
    text: string,
    x: number,
    yPos: number,
    size: number,
    opts: { font?: PDFFont; color?: ReturnType<typeof rgb> } = {}
  ) => {
    page.drawText(text, {
      x,
      y: yPos,
      size,
      font: opts.font ?? latinFont,
      color: opts.color,
    });
  };

  const drawLabelValue = (
    label: string,
    value: string,
    x: number,
    yPos: number,
    size: number,
    labelFont: PDFFont = latinFont
  ) => {
    const prefix = `${label}: `;
    drawLatin(prefix, x, yPos, size, { font: labelFont });
    const prefixWidth = labelFont.widthOfTextAtSize(prefix, size);
    drawLatin(value, x + prefixWidth, yPos, size);
  };

  const maxTextWidth = (padLeft = 0, padRight = 0) =>
    width - marginX * 2 - padLeft - padRight;

  const refreshPageMetrics = () => {
    const size = page.getSize();
    width = size.width;
    height = size.height;
  };

  const ensureSpace = (need: number) => {
    const bottomY = 40;
    if (y - need < bottomY) {
      page = pdfDoc.addPage([595, 842]);
      refreshPageMetrics();
      y = height - 70;
    }
  };

  const wrapText = (text: string, usedFont: PDFFont, size: number, maxWidth: number) => {
    const words = (text ?? labels.fallback).split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      const wWidth = usedFont.widthOfTextAtSize(test, size);
      if (wWidth <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        if (usedFont.widthOfTextAtSize(w, size) > maxWidth) {
          let chunk = "";
          for (const ch of w) {
            const candidate = chunk + ch;
            if (usedFont.widthOfTextAtSize(candidate, size) <= maxWidth) {
              chunk = candidate;
            } else {
              if (chunk) lines.push(chunk);
              chunk = ch;
            }
          }
          current = chunk;
        } else {
          current = w;
        }
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const drawCommentBox = (label: string, text: string, options?: { pad?: number }) => {
    const pad = options?.pad ?? 8;
    const labelSize = 10.5;
    const textSize = 10.5;
    const lh = 14;
    const labelWidth = maxTextWidth(pad, pad);
    const labelLines = wrapText(t(label), boldFont, labelSize, labelWidth);
    const textLines = wrapText(t(text || labels.fallback), font, textSize, labelWidth);
    const contentHeight = labelLines.length * lh + 4 + textLines.length * lh;
    const boxHeight = contentHeight + pad * 2;
    ensureSpace(boxHeight + 6);

    page.drawRectangle({
      x: marginX,
      y: y - boxHeight,
      width: width - marginX * 2,
      height: boxHeight,
      color: rgb(0, 0, 0),
      opacity: 0.04,
    });

    page.drawRectangle({
      x: marginX,
      y: y - boxHeight,
      width: width - marginX * 2,
      height: boxHeight,
      borderColor: rgb(0.82, 0.82, 0.82),
      borderWidth: 1,
    });

    let ty = y - pad - labelSize;
    for (const ln of labelLines) {
      page.drawText(ln, {
        x: marginX + pad,
        y: ty,
        size: labelSize,
        font: boldFont,
        color: rgb(0.25, 0.25, 0.25),
      });
      ty -= lh;
    }

    ty -= 2;
    for (const ln of textLines) {
      page.drawText(ln, {
        x: marginX + pad,
        y: ty,
        size: textSize,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });
      ty -= lh;
    }

    y -= boxHeight + 6;
  };

  const drawNumberedHeading = (
    index: number,
    text: string,
    accent: [number, number, number] = [0.27, 0.27, 0.27],
    price?: number
  ) => {
    const size = 11.5;
    const lh = 16;
    const leftRuleW = 3;
    const padLeft = 10;
    const contentWidth = maxTextWidth(leftRuleW + padLeft, 0);
    const prefix = `${index}. `;
    const prefixWidth = latinBoldFont.widthOfTextAtSize(prefix, size);
    const formattedPrice =
      price && price > 0 ? price.toLocaleString("en-AE") : "";
    const priceSuffix =
      formattedPrice ? ` (Cost: AED ${formattedPrice})` : "";
    const priceSuffixWidth = priceSuffix
      ? latinBoldFont.widthOfTextAtSize(priceSuffix, size)
      : 0;
    const shapedText = t(text || labels.fallback);

    let bodyLines: string[];
    if (priceSuffix) {
      const firstLineMax = Math.max(0, contentWidth - prefixWidth - priceSuffixWidth);
      const words = shapedText.split(/\s+/).filter(Boolean);
      let firstLine = "";
      let consumed = 0;

      for (let i = 0; i < words.length; i++) {
        const test = firstLine ? `${firstLine} ${words[i]}` : words[i];
        if (boldFont.widthOfTextAtSize(test, size) <= firstLineMax) {
          firstLine = test;
          consumed = i + 1;
        } else {
          break;
        }
      }

      if (!firstLine && words.length > 0) {
        firstLine = words[0];
        consumed = 1;
      }

      const remainder = words.slice(consumed).join(" ");
      bodyLines = firstLine ? [firstLine] : [];
      if (remainder) {
        bodyLines.push(...wrapText(remainder, boldFont, size, contentWidth));
      }
      if (bodyLines.length === 0) {
        bodyLines = [shapedText];
      }
    } else {
      bodyLines = wrapText(shapedText, boldFont, size, contentWidth);
    }

    const blockH = Math.max(18, bodyLines.length * lh);
    ensureSpace(blockH + 6);

    page.drawRectangle({
      x: marginX,
      y: y - blockH,
      width: leftRuleW,
      height: blockH,
      color: rgb(...accent),
    });

    const lineX = marginX + leftRuleW + padLeft;
    let ty = y - size - 2;
    bodyLines.forEach((ln, lineIndex) => {
      if (lineIndex === 0) {
        drawLatin(prefix, lineX, ty, size, {
          font: latinBoldFont,
          color: rgb(0.13, 0.13, 0.13),
        });
        page.drawText(ln, {
          x: lineX + prefixWidth,
          y: ty,
          size,
          font: boldFont,
          color: rgb(0.13, 0.13, 0.13),
        });
        if (priceSuffix) {
          const lineWidth = boldFont.widthOfTextAtSize(ln, size);
          drawLatin(priceSuffix, lineX + prefixWidth + lineWidth, ty, size, {
            font: latinBoldFont,
            color: rgb(0.13, 0.13, 0.13),
          });
        }
      } else {
        page.drawText(ln, {
          x: lineX,
          y: ty,
          size,
          font: boldFont,
          color: rgb(0.13, 0.13, 0.13),
        });
      }
      ty -= lh;
    });

    y -= blockH + 6;
  };

  const severityAccent: Record<string, [number, number, number]> = {
    minor: [0.95, 0.6, 0.1],
    major: [0.9, 0.2, 0.2],
    ok: [0.1, 0.55, 0.85],
  };

  const headerHeight = 100;

  const drawGradientHeader = () => {
    const gradientSteps = 20;
    const gradientWidth = width / gradientSteps;

    for (let i = 0; i < gradientSteps; i++) {
      const progress = i / gradientSteps;
      const color = rgb(0.35 - progress * 0.25, 0.1 + progress * 0.3, 0.6 + progress * 0.2);
      page.drawRectangle({
        x: i * gradientWidth,
        y: height - headerHeight,
        width: gradientWidth,
        height: headerHeight,
        color,
      });
    }

    drawLatin(PDF_LABELS_EN.title, marginX + 120, height - 65, 24, {
      font: latinBoldFont,
      color: rgb(1, 1, 1),
    });

    drawLatin(PDF_LABELS_EN.subtitle, marginX + 120, height - 85, 12, {
      color: rgb(0.9, 0.9, 0.9),
    });

    y = height - 140;
  };

  if (bannerBytes) {
    try {
      const bannerImg = await pdfDoc.embedJpg(bannerBytes);
      const bannerDims = bannerImg.scale(1);
      const bannerAspect = bannerDims.width / bannerDims.height;
      const bannerWidth = width - marginX * 2;
      const bannerHeight = bannerWidth / bannerAspect;

      page.drawImage(bannerImg, {
        x: marginX,
        y: height - bannerHeight - 20,
        width: bannerWidth,
        height: bannerHeight,
      });

      y = height - bannerHeight - 60;
    } catch (e) {
      console.warn("Banner embedding failed", e);
      drawGradientHeader();
    }
  } else {
    drawGradientHeader();
  }

  ensureSpace(80);
  page.drawRectangle({
    x: marginX,
    y: y - 70,
    width: width - marginX * 2,
    height: 70,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.96, 0.96, 1),
  });

  const fallback = PDF_LABELS_EN.fallback;
  const chassisValue = job.engineNumber
    ? String(job.engineNumber).toUpperCase()
    : fallback;
  const reportDate = new Date().toLocaleDateString("en-GB", { timeZone: tz });

  const infoLeft = [
    { label: PDF_LABELS_EN.fileNumber, value: String(job.jobCount ?? fallback) },
    { label: PDF_LABELS_EN.vehicle, value: job.carNumber || fallback },
    { label: PDF_LABELS_EN.chassis, value: chassisValue },
  ];
  const infoRight = [
    { label: PDF_LABELS_EN.inspector, value: job.customerName || fallback },
    { label: PDF_LABELS_EN.date, value: reportDate },
    { label: PDF_LABELS_EN.currentOdo, value: String(job.odometer ?? fallback) },
  ];

  let infoY = y - 20;
  infoLeft.forEach(({ label, value }) => {
    drawLabelValue(label, value, marginX + 10, infoY, 11);
    infoY -= 15;
  });

  infoY = y - 20;
  infoRight.forEach(({ label, value }) => {
    drawLabelValue(label, value, width / 2 + 20, infoY, 11);
    infoY -= 15;
  });

  y -= 110;

  page.drawText(t(labels.summaryHeading), {
    x: marginX,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.5),
  });
  y -= 30;

  const summary = {
    okay:
      job.inspectionTabs?.flatMap((tab) => tab.subIssues).filter((i) => i.severity === "ok")
        .length || 0,
    minor:
      job.inspectionTabs?.flatMap((tab) => tab.subIssues).filter((i) => i.severity === "minor")
        .length || 0,
    major:
      job.inspectionTabs?.flatMap((tab) => tab.subIssues).filter((i) => i.severity === "major")
        .length || 0,
  };

  const badgeEntries: Array<{
    key: keyof typeof summary;
    label: string;
    color: [number, number, number];
  }> = [
    { key: "okay", label: labels.okay, color: [0.1, 0.7, 0.2] },
    { key: "minor", label: labels.minor, color: [0.95, 0.6, 0.1] },
    { key: "major", label: labels.major, color: [0.9, 0.2, 0.2] },
  ];

  let xPos = marginX;
  badgeEntries.forEach(({ key, label, color }) => {
    page.drawRectangle({
      x: xPos,
      y: y - 5,
      width: 90,
      height: 25,
      color: rgb(...color),
    });
    const badgeX = xPos + 10;
    const labelWithColon = `${t(label)}: `;
    page.drawText(labelWithColon, {
      x: badgeX,
      y: y,
      size: 11,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    const labelWidth = boldFont.widthOfTextAtSize(labelWithColon, 11);
    drawLatin(String(summary[key]), badgeX + labelWidth, y, 11, {
      font: latinBoldFont,
      color: rgb(1, 1, 1),
    });
    xPos += 110;
  });

  y -= 30;

  const grouped: Record<"minor" | "major" | "ok", IssueEntry[]> = {
    minor: issues.filter((i) => i.severity === "minor"),
    major: issues.filter((i) => i.severity === "major"),
    ok: issues.filter((i) => i.severity === "ok"),
  };

  const sectionMeta: Array<{
    key: "minor" | "major" | "ok";
    title: string;
    bg: [number, number, number];
  }> = [
    { key: "minor", title: labels.sectionMinor, bg: [1, 0.97, 0.9] },
    { key: "major", title: labels.sectionMajor, bg: [1, 0.95, 0.95] },
    { key: "ok", title: labels.sectionOk, bg: [0.95, 0.98, 1] },
  ];

  for (const section of sectionMeta) {
    const sectionIssues = grouped[section.key];
    if (sectionIssues.length === 0) continue;

    ensureSpace(40);
    page.drawRectangle({
      x: marginX,
      y: y - 20,
      width: width - marginX * 2,
      height: 22,
      color: rgb(...section.bg),
    });

    page.drawText(t(section.title), {
      x: marginX + 10,
      y: y - 5,
      size: 12,
      font: boldFont,
      color: rgb(0.2, 0.2, 0.2),
    });

    y -= 40;

    let idx = 1;
    for (const issue of sectionIssues) {
      drawNumberedHeading(idx, issue.label, severityAccent[section.key], issue.price);
      if (issue.comment) {
        drawCommentBox(labels.comment, issue.comment);
      }
      idx += 1;
    }

    y -= 20;
  }

  y -= 10;
  const disclaimerBoxWidth = width - marginX * 2;
  const disclaimerBoxHeight = 85;
  const disclaimerHeaderHeight = 22;
  const disclaimerPadding = 10;

  ensureSpace(disclaimerBoxHeight + 10);

  page.drawRectangle({
    x: marginX,
    y: y - disclaimerHeaderHeight,
    width: disclaimerBoxWidth,
    height: disclaimerHeaderHeight,
    color: rgb(0, 0, 0),
  });

  drawLatin(PDF_LABELS_EN.disclaimer, marginX + disclaimerPadding, y - disclaimerHeaderHeight + 6, 12, {
    font: latinBoldFont,
    color: rgb(1, 1, 1),
  });

  y -= disclaimerHeaderHeight;

  page.drawRectangle({
    x: marginX,
    y: y - (disclaimerBoxHeight - disclaimerHeaderHeight),
    width: disclaimerBoxWidth,
    height: disclaimerBoxHeight - disclaimerHeaderHeight,
    color: rgb(1, 1, 1),
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });

  const bulletSize = 10;
  const bulletX = marginX + disclaimerPadding + 5;
  let bulletY = y - 18;

  page.drawText("•", {
    x: bulletX,
    y: bulletY,
    size: bulletSize,
    font: boldFont,
    color: rgb(1, 0.4, 0),
  });

  const line1Wrapped = wrapText(
    PDF_LABELS_EN.disclaimerLine1,
    latinFont,
    bulletSize,
    disclaimerBoxWidth - disclaimerPadding * 2 - 15
  );

  for (const line of line1Wrapped) {
    drawLatin(line, bulletX + 12, bulletY, bulletSize, {
      color: rgb(0.1, 0.1, 0.5),
    });
    bulletY -= 12;
  }

  bulletY -= 3;

  page.drawText("•", {
    x: bulletX,
    y: bulletY,
    size: bulletSize,
    font: boldFont,
    color: rgb(1, 0.4, 0),
  });

  const line2Wrapped = wrapText(
    PDF_LABELS_EN.disclaimerLine2,
    latinFont,
    bulletSize,
    disclaimerBoxWidth - disclaimerPadding * 2 - 15
  );

  for (const line of line2Wrapped) {
    drawLatin(line, bulletX + 12, bulletY, bulletSize, {
      color: rgb(0.1, 0.1, 0.5),
    });
    bulletY -= 12;
  }

  const signatureY = y - (disclaimerBoxHeight - disclaimerHeaderHeight) + 12;
  page.drawLine({
    start: { x: width - marginX - 170, y: signatureY },
    end: { x: width - marginX - disclaimerPadding, y: signatureY },
    color: rgb(0, 0, 0),
    thickness: 1,
  });

  y -= disclaimerBoxHeight - disclaimerHeaderHeight + 5;
  y -= 10;

  const generatedPrefix = `${t(labels.generatedOn)} `;
  const generatedTimestamp = new Date().toLocaleString("en-GB", { timeZone: tz });
  page.drawText(generatedPrefix, {
    x: marginX,
    y: y,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });
  const prefixWidth = font.widthOfTextAtSize(generatedPrefix, 9);
  drawLatin(generatedTimestamp, marginX + prefixWidth, y, 9, {
    color: rgb(0.5, 0.5, 0.5),
  });

  return pdfDoc.save();
}
