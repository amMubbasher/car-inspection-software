// lib/pdf.ts
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import type { Job } from "@/types/job";

export async function generateJobPDF(job: Job, logoBytes?: Uint8Array, bannerBytes?: Uint8Array): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595, 842]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // NOTE: width/height must be mutable because we add pages later.
  let { height, width } = page.getSize();

  let y = height - 70;
  const marginX = 40;
  const lineHeight = 18;

  // ---------- helpers (wrapping/auto-height + numbering UI; pdf-lib safe) ----------
  const maxTextWidth = (padLeft = 0, padRight = 0) =>
    width - marginX * 2 - padLeft - padRight;

  const refreshPageMetrics = () => {
    const size = page.getSize();
    width = size.width;
    height = size.height;
  };

  const ensureSpace = (need: number) => {
    const bottomY = 40; // bottom margin
    if (y - need < bottomY) {
      page = pdfDoc.addPage([595, 842]);
      refreshPageMetrics();
      y = height - 70;
    }
  };

  const wrapText = (
    text: string,
    usedFont: typeof font,
    size: number,
    maxWidth: number
  ) => {
    const words = (text ?? "-").split(/\s+/);
    const lines: string[] = [];
    let current = "";
    for (const w of words) {
      const test = current ? current + " " + w : w;
      const wWidth = usedFont.widthOfTextAtSize(test, size);
      if (wWidth <= maxWidth) {
        current = test;
      } else {
        if (current) lines.push(current);
        // hard-wrap single ultra-long words/URLs
        if (usedFont.widthOfTextAtSize(w, size) > maxWidth) {
          let chunk = "";
          for (const ch of w) {
            const t = chunk + ch;
            if (usedFont.widthOfTextAtSize(t, size) <= maxWidth) {
              chunk = t;
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

  const drawCommentBox = (
    label: string,
    text: string,
    options?: { pad?: number }
  ) => {
    const pad = options?.pad ?? 8;
    const labelSize = 10.5;
    const textSize = 10.5;
    const lh = 14;

    const labelWidth = maxTextWidth(pad, pad);
    const labelLines = wrapText(label, boldFont, labelSize, labelWidth);
    const textLines = wrapText(text || "-", font, textSize, labelWidth);

    const contentHeight = labelLines.length * lh + 4 + textLines.length * lh;
    const boxHeight = contentHeight + pad * 2;
    ensureSpace(boxHeight + 6);

    // background (use low opacity fill via color+opacity on a normal rectangle)
    page.drawRectangle({
      x: marginX,
      y: y - boxHeight,
      width: width - marginX * 2,
      height: boxHeight,
      // borderRadius: 6,
      color: rgb(0, 0, 0),
      opacity: 0.04,
    });

    // border (stroke only)
    page.drawRectangle({
      x: marginX,
      y: y - boxHeight,
      width: width - marginX * 2,
      height: boxHeight,
      // borderRadius: 6,
      borderColor: rgb(0.82, 0.82, 0.82),
      borderWidth: 1,
    });

    // label lines (bold)
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

    // comment text lines
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
    accent: [number, number, number] = [0.27, 0.27, 0.27]
  ) => {
    const size = 11.5;
    const lh = 16;
    const leftRuleW = 3;
    const padLeft = 10;
    const contentWidth = maxTextWidth(leftRuleW + padLeft, 0);
    const headingText = `${index}. ${text || "-"}`;
    const lines = wrapText(headingText, boldFont, size, contentWidth);
    const blockH = Math.max(18, lines.length * lh);
    ensureSpace(blockH + 6);

    // left rule (solid bar)
    page.drawRectangle({
      x: marginX,
      y: y - blockH,
      width: leftRuleW,
      height: blockH,
      color: rgb(...accent),
    });

    // text
    let ty = y - size - 2;
    for (const ln of lines) {
      page.drawText(ln, {
        x: marginX + leftRuleW + padLeft,
        y: ty,
        size,
        font: boldFont,
        color: rgb(0.13, 0.13, 0.13),
      });
      ty -= lh;
    }

    y -= blockH + 6;
  };

  const severityAccent: Record<string, [number, number, number]> = {
    Minor: [0.95, 0.6, 0.1], // orange-ish
    Major: [0.9, 0.2, 0.2],  // red-ish
    OK:    [0.1, 0.55, 0.85],// blue-ish
  };

  // ====== Banner Image Header ======
  const headerHeight = 100;
  
  if (bannerBytes) {
    try {
      const bannerImg = await pdfDoc.embedJpg(bannerBytes);
      const bannerDims = bannerImg.scale(1);
      
      // Calculate dimensions to fit the header while maintaining aspect ratio
      // Use content width (with margins) instead of full page width
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
      // Fallback to gradient header if banner fails
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

      page.drawText("CAR INSPECTION REPORT", {
        x: marginX + 120,
        y: height - 65,
        size: 24,
        font: boldFont,
        color: rgb(1, 1, 1),
      });

      page.drawText("Comprehensive Vehicle Assessment", {
        x: marginX + 120,
        y: height - 85,
        size: 12,
        font,
        color: rgb(0.9, 0.9, 0.9),
      });
      
      y = height - 140;
    }
  } else {
    // Fallback to gradient header if no banner provided
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

    page.drawText("CAR INSPECTION REPORT", {
      x: marginX + 120,
      y: height - 65,
      size: 24,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    page.drawText("Comprehensive Vehicle Assessment", {
      x: marginX + 120,
      y: height - 85,
      size: 12,
      font,
      color: rgb(0.9, 0.9, 0.9),
    });
    
    y = height - 140;
  }

  // ====== Info box (your original look; page-safety only) ======
  ensureSpace(70 + 10);
  page.drawRectangle({
    x: marginX,
    y: y - 70,
    width: width - marginX * 2,
    height: 70,
    borderColor: rgb(0.7, 0.7, 0.7),
    borderWidth: 1,
    color: rgb(0.96, 0.96, 1),
    // borderRadius: 5,
  });

  const infoLeft = [`FILE #: ${job.jobCount || "-"}`,`VEHICLE: ${job.carNumber || "-"}`, `CHASSIS #: ${job.engineNumber.toUpperCase() || "-"}`];
  const infoRight = [
    `INSPECTOR: ${job.customerName || "-"}`,
    `DATE: ${new Date().toLocaleDateString('en-GB', { timeZone: 'Asia/Dubai' })}`,
    `CURRENT ODO: ${job.odometer || "-"}`,
  ];

  let infoY = y - 20;
  infoLeft.forEach((line) => {
    page.drawText(line, { x: marginX + 10, y: infoY, size: 11, font });
    infoY -= 15;
  });

  infoY = y - 20;
  infoRight.forEach((line) => {
    page.drawText(line, {
      x: width / 2 + 20,
      y: infoY,
      size: 11,
      font,
    });
    infoY -= 15;
  });

  y -= 110;

  // ====== Summary badges (unchanged) ======
  page.drawText("Summary of Inspection", {
    x: marginX,
    y,
    size: 14,
    font: boldFont,
    color: rgb(0.2, 0.2, 0.5),
  });
  y -= 30;

  const summary = {
    Okay:
      job.inspectionTabs?.flatMap((t) => t.subIssues).filter((i) => i.severity === "ok")
        .length || 0,
    Minor:
      job.inspectionTabs?.flatMap((t) => t.subIssues).filter((i) => i.severity === "minor")
        .length || 0,
    Major:
      job.inspectionTabs?.flatMap((t) => t.subIssues).filter((i) => i.severity === "major")
        .length || 0,
  };

  const badgeColors: Record<string, [number, number, number]> = {
    Okay: [0.1, 0.7, 0.2],
    Minor: [0.95, 0.6, 0.1],
    Major: [0.9, 0.2, 0.2],
  };

  let xPos = marginX;
  Object.entries(summary).forEach(([label, count]) => {
    const color = rgb(...badgeColors[label]);
    page.drawRectangle({
      x: xPos,
      y: y - 5,
      width: 90,
      height: 25,
      color,
      // borderRadius: 5,
    });
    page.drawText(`${label}: ${count}`, {
      x: xPos + 10,
      y: y,
      size: 11,
      font: boldFont,
      color: rgb(1, 1, 1),
    });
    xPos += 110;
  });

  y -= 30;

  // ====== Issues grouped (UI: numbering + wrapped comments) ======
  const grouped: Record<string, typeof job.inspectionTabs[0]["subIssues"]> = {
    Minor: [],
    Major: [],
    OK: [],
  };

  for (const tab of job.inspectionTabs || []) {
    for (const issue of tab.subIssues || []) {
      if (issue.severity === "minor") grouped.Minor.push(issue);
      if (issue.severity === "major") grouped.Major.push(issue);
      if (issue.severity === "ok") grouped.OK.push(issue);
    }
  }

  const sectionColors: Record<string, [number, number, number]> = {
    Minor: [1, 0.97, 0.9],
    Major: [1, 0.95, 0.95],
    OK: [0.95, 0.98, 1],
  };

  for (const severity of Object.keys(grouped)) {
    if (grouped[severity].length > 0) {
      // Section header (same visual)
      ensureSpace(22 + 18);
      page.drawRectangle({
        x: marginX,
        y: y - 20,
        width: width - marginX * 2,
        height: 22,
        color: rgb(...sectionColors[severity]),
        // borderRadius: 4,
      });

      page.drawText(severity, {
        x: marginX + 10,
        y: y - 5,
        size: 12,
        font: boldFont,
        color: rgb(0.2, 0.2, 0.2),
      });

      y -= 40;

      // Numbered sub-issues with eye-catching heading + auto-expanding comments
      let idx = 1;
      for (const issue of grouped[severity]) {
        drawNumberedHeading(
          idx,
          issue.label ?? "-",
          severityAccent[severity] || [0.27, 0.27, 0.27]
        );

        if (issue.comment && issue.comment.trim().length > 0) {
          drawCommentBox("Comment:", issue.comment);
        }

        idx += 1;
      }

      y -= 20;
    }
  }

  // ====== Disclaimer Box ======
  y -= 10; // Space before disclaimer
  
  const disclaimerBoxWidth = width - marginX * 2;
  const disclaimerBoxHeight = 85;
  const disclaimerHeaderHeight = 22;
  const disclaimerPadding = 10;
  
  ensureSpace(disclaimerBoxHeight + 10);
  
  // Black header bar
  page.drawRectangle({
    x: marginX,
    y: y - disclaimerHeaderHeight,
    width: disclaimerBoxWidth,
    height: disclaimerHeaderHeight,
    color: rgb(0, 0, 0),
  });
  
  // Header text "Disclaimer:" in white
  page.drawText("Disclaimer:", {
    x: marginX + disclaimerPadding,
    y: y - disclaimerHeaderHeight + 6,
    size: 12,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  
  y -= disclaimerHeaderHeight;
  
  // White content box with border
  page.drawRectangle({
    x: marginX,
    y: y - (disclaimerBoxHeight - disclaimerHeaderHeight),
    width: disclaimerBoxWidth,
    height: disclaimerBoxHeight - disclaimerHeaderHeight,
    color: rgb(1, 1, 1),
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });
  
  // Disclaimer bullet points
  const bulletSize = 10;
  const bulletX = marginX + disclaimerPadding + 5;
  let bulletY = y - 18;
  
  // Bullet 1
  page.drawText("•", {
    x: bulletX,
    y: bulletY,
    size: bulletSize,
    font: boldFont,
    color: rgb(1, 0.4, 0),
  });
  
  const line1 = "I acknowledge Motor Expert has inspected my vehicle and returned it in good condition.";
  const line1Wrapped = wrapText(line1, font, bulletSize, disclaimerBoxWidth - disclaimerPadding * 2 - 15);
  
  for (const line of line1Wrapped) {
    page.drawText(line, {
      x: bulletX + 12,
      y: bulletY,
      size: bulletSize,
      font,
      color: rgb(0.1, 0.1, 0.5),
    });
    bulletY -= 12;
  }
  
  bulletY -= 3; // Extra space between bullets
  
  // Bullet 2
  page.drawText("•", {
    x: bulletX,
    y: bulletY,
    size: bulletSize,
    font: boldFont,
    color: rgb(1, 0.4, 0),
  });
  
  const line2 = "I acknowledge that this inspection is valid only at the time of inspection.";
  const line2Wrapped = wrapText(line2, font, bulletSize, disclaimerBoxWidth - disclaimerPadding * 2 - 15);
  
  for (const line of line2Wrapped) {
    page.drawText(line, {
      x: bulletX + 12,
      y: bulletY,
      size: bulletSize,
      font,
      color: rgb(0.1, 0.1, 0.5),
    });
    bulletY -= 12;
  }
  
  // Signature line
  const signatureY = y - (disclaimerBoxHeight - disclaimerHeaderHeight) + 12;
  const signatureLineStart = width - marginX - 170;
  const signatureLineEnd = width - marginX - disclaimerPadding;
  
  page.drawLine({
    start: { x: signatureLineStart, y: signatureY },
    end: { x: signatureLineEnd, y: signatureY },
    color: rgb(0, 0, 0),
    thickness: 1,
  });
  
  y -= (disclaimerBoxHeight - disclaimerHeaderHeight) + 5;

  // ====== Footer (below disclaimer) ======
  y -= 10; // Space between disclaimer and footer
  page.drawText(`Generated on ${new Date().toLocaleString('en-GB', { timeZone: 'Asia/Dubai' })}`, {
    x: marginX,
    y: y,
    size: 9,
    font,
    color: rgb(0.5, 0.5, 0.5),
  });

  return await pdfDoc.save();
}
