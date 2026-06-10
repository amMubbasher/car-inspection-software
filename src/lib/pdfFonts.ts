import { readFile } from "fs/promises";
import { join } from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, StandardFonts } from "pdf-lib";
import arabicReshaper from "arabic-reshaper";

const ARABIC_LOCALES = new Set(["ar", "ur"]);
const ARABIC_SCRIPT_RE = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export type PdfFontSet = {
  font: PDFFont;
  boldFont: PDFFont;
  latinFont: PDFFont;
  latinBoldFont: PDFFont;
};

function fontFileForLocale(locale: string): string {
  const normalized = locale.toLowerCase();
  if (ARABIC_LOCALES.has(normalized)) return "NotoSansArabic-Regular.ttf";
  if (normalized === "hi" || normalized === "bn") return "NotoSansDevanagari-Regular.ttf";
  if (normalized.startsWith("zh")) return "NotoSansSC-Regular.otf";
  return "NotoSans-Regular.ttf";
}

async function embedCustomFont(
  pdfDoc: PDFDocument,
  fileName: string
): Promise<PDFFont | null> {
  try {
    const fontPath = join(process.cwd(), "public", "fonts", fileName);
    const fontBytes = await readFile(fontPath);
    return await pdfDoc.embedFont(fontBytes);
  } catch {
    return null;
  }
}

export async function embedPdfFonts(
  pdfDoc: PDFDocument,
  locale: string
): Promise<PdfFontSet> {
  const normalized = locale.toLowerCase();

  if (normalized === "en") {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    return { font, boldFont, latinFont: font, latinBoldFont: boldFont };
  }

  pdfDoc.registerFontkit(fontkit);

  const latinFont =
    (await embedCustomFont(pdfDoc, "NotoSans-Regular.ttf")) ??
    (await pdfDoc.embedFont(StandardFonts.Helvetica));
  const latinBoldFont = latinFont;

  const primaryFile = fontFileForLocale(locale);
  const primaryFont =
    (await embedCustomFont(pdfDoc, primaryFile)) ??
    (await embedCustomFont(pdfDoc, "NotoSans-Regular.ttf"));

  if (!primaryFont) {
    throw new Error(
      `No embeddable font found for locale "${locale}". Add fonts under public/fonts/.`
    );
  }

  return {
    font: primaryFont,
    boldFont: primaryFont,
    latinFont,
    latinBoldFont,
  };
}

export function containsArabicScript(text: string): boolean {
  return ARABIC_SCRIPT_RE.test(text);
}

export function shapePdfText(text: string, locale: string): string {
  const normalized = locale.toLowerCase();
  if (!text || !ARABIC_LOCALES.has(normalized) || !containsArabicScript(text)) {
    return text;
  }
  try {
    return arabicReshaper.convertArabic(text);
  } catch {
    return text;
  }
}

export function getDateLocale(locale: string): string {
  const map: Record<string, string> = {
    en: "en-GB",
    ar: "ar-AE",
    ur: "ur-PK",
    hi: "hi-IN",
    fr: "fr-FR",
    de: "de-DE",
    es: "es-ES",
    ru: "ru-RU",
    tr: "tr-TR",
    pt: "pt-PT",
    bn: "bn-BD",
    "zh-cn": "zh-CN",
  };
  return map[locale.toLowerCase()] ?? "en-GB";
}
