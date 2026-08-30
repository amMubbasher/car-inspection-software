import { readFile } from "fs/promises";
import { join } from "path";

const FONT_DIR = join(process.cwd(), "public", "fonts");

/** Base64 payloads are reused across requests in the same server instance. */
const dataUrlCache = new Map<string, string | null>();

const RTL_LOCALES = new Set(["ar", "ur", "fa", "he"]);

export function baseLocale(locale: string): string {
  return (locale || "en").trim().toLowerCase().split(/[-_]/)[0] || "en";
}

export function isRtlLocale(locale: string): boolean {
  return RTL_LOCALES.has(baseLocale(locale));
}

/** Font that covers the script of the given locale, beyond Latin. */
export function scriptFontFile(locale: string): string | null {
  const base = baseLocale(locale);
  if (RTL_LOCALES.has(base)) return "Amiri-Regular.ttf";
  if (base === "hi" || base === "bn" || base === "mr" || base === "ne") {
    return "NotoSansDevanagari-Regular.ttf";
  }
  return null;
}

async function toDataUrl(path: string, mime: string): Promise<string | null> {
  const cached = dataUrlCache.get(path);
  if (cached !== undefined) return cached;

  try {
    const bytes = await readFile(path);
    const url = `data:${mime};base64,${bytes.toString("base64")}`;
    dataUrlCache.set(path, url);
    console.log(`[pdf] asset ok ${path} ${Math.round(bytes.length / 1024)}KB`);
    return url;
  } catch {
    dataUrlCache.set(path, null);
    console.warn(`[pdf] asset MISSING ${path}`);
    return null;
  }
}

export function fontDataUrl(fileName: string): Promise<string | null> {
  const mime = fileName.endsWith(".otf") ? "font/otf" : "font/ttf";
  return toDataUrl(join(FONT_DIR, fileName), mime);
}

export function bytesToDataUrl(bytes: Uint8Array): string {
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
  const mime = isPng ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}
