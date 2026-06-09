import { readFile } from "fs/promises";
import { join } from "path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, PDFFont, StandardFonts } from "pdf-lib";
import arabicReshaper from "arabic-reshaper";

const ARABIC_LOCALES = new Set(["ar", "ur"]);

function fontFileForLocale(locale: string): string {
  const normalized = locale.toLowerCase();
  if (ARABIC_LOCALES.has(normalized)) return "NotoSansArabic-Regular.ttf";
  if (normalized === "hi" || normalized === "bn") return "NotoSansDevanagari-Regular.ttf";
  if (normalized.startsWith("zh")) return "NotoSansSC-Regular.otf";
  return "NotoSans-Regular.ttf";
}

export async function embedPdfFonts(
  pdfDoc: PDFDocument,
  locale: string
): Promise<{ font: PDFFont; boldFont: PDFFont }> {
  const normalized = locale.toLowerCase();

  if (normalized === "en") {
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    return { font, boldFont };
  }

  pdfDoc.registerFontkit(fontkit);

  const candidates = [fontFileForLocale(locale), "NotoSans-Regular.ttf"];

  for (const fileName of candidates) {
    try {
      const fontPath = join(process.cwd(), "public", "fonts", fileName);
      const fontBytes = await readFile(fontPath);
      const font = await pdfDoc.embedFont(fontBytes);
      return { font, boldFont: font };
    } catch (err) {
      console.warn(`Failed to embed font ${fileName}:`, err);
    }
  }

  throw new Error(
    `No embeddable font found for locale "${locale}". Add fonts under public/fonts/.`
  );
}

export function shapePdfText(text: string, locale: string): string {
  const normalized = locale.toLowerCase();
  if (!text || !ARABIC_LOCALES.has(normalized)) return text;
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
