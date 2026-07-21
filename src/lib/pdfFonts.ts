import { readFile } from "fs/promises";
import { join } from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, StandardFonts } from "pdf-lib";
import arabicReshaper from "arabic-reshaper";

/** Locales that use Arabic script (and need Noto Sans Arabic + reshaping). */
const ARABIC_SCRIPT_LOCALES = new Set(["ar", "ur", "fa"]);
const ARABIC_SCRIPT_RE =
  /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;

export type PdfFontSet = {
  font: PDFFont;
  boldFont: PDFFont;
  latinFont: PDFFont;
  latinBoldFont: PDFFont;
};

function normalizeLocale(locale: string): string {
  return (locale || "en").trim().toLowerCase().split(/[-_]/)[0] ?? "en";
}

export function usesArabicScript(locale: string): boolean {
  return ARABIC_SCRIPT_LOCALES.has(normalizeLocale(locale));
}

function fontFileForLocale(locale: string): string {
  const base = normalizeLocale(locale);
  if (ARABIC_SCRIPT_LOCALES.has(base)) return "NotoSansArabic-Regular.ttf";
  if (base === "hi" || base === "bn") return "NotoSansDevanagari-Regular.ttf";
  if (base === "zh" || locale.toLowerCase().startsWith("zh")) {
    return "NotoSansSC-Regular.otf";
  }
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
  const base = normalizeLocale(locale);

  if (base === "en") {
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

/**
 * Shape Arabic-script text for PDF (connected forms).
 * Applies for ar/ur/fa, and also whenever the string itself contains Arabic letters
 * (covers mixed content and locale variants like fa-IR).
 */
export function shapePdfText(text: string, locale: string): string {
  if (!text) return text;
  const needsShape =
    usesArabicScript(locale) || containsArabicScript(text);
  if (!needsShape) return text;
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
    fa: "fa-IR",
    hi: "hi-IN",
    fr: "fr-FR",
    de: "de-DE",
    es: "es-ES",
    ru: "ru-RU",
    tr: "tr-TR",
    pt: "pt-PT",
    bn: "bn-BD",
    zh: "zh-CN",
  };
  return map[normalizeLocale(locale)] ?? "en-GB";
}
