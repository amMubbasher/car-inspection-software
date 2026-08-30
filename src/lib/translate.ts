const PAGE_SOURCE_LANG = "en";
const TRANSLATE_ENDPOINT =
  "https://translation.googleapis.com/language/translate/v2";
const MAX_SEGMENTS_PER_REQUEST = 128;

const translationCache = new Map<string, string>();
let missingKeyWarned = false;

function decodeHtmlEntities(str: string): string {
  if (!str) return str;

  const withEntities = str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10))
    )
    .replace(/&amp;/g, "&");

  return withEntities;
}

function cacheKey(locale: string, text: string): string {
  return `${locale}\0${text}`;
}

function getApiKey(): string | undefined {
  const key = process.env.GOOGLE_TRANSLATE_API_KEY?.trim();
  return key || undefined;
}

export function normalizeLocale(locale: string): string {
  return locale?.trim() || PAGE_SOURCE_LANG;
}

export function getLocaleFromRequest(req: Request): string {
  try {
    const fromQuery = new URL(req.url).searchParams.get("locale")?.trim();
    if (fromQuery) return normalizeLocale(fromQuery);
  } catch {
    // ignore malformed URLs and fall through to cookie
  }

  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)googtrans=([^;]*)/);
  if (!match) return PAGE_SOURCE_LANG;

  const value = decodeURIComponent(match[1].trim());
  if (!value) return PAGE_SOURCE_LANG;

  const parts = value.split("/").filter(Boolean);
  return parts[parts.length - 1] || PAGE_SOURCE_LANG;
}

type TranslateV2Response = {
  data?: {
    translations?: Array<{ translatedText?: string }>;
  };
};

async function translateChunk(
  texts: string[],
  target: string,
  apiKey: string
): Promise<string[]> {
  const url = `${TRANSLATE_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Accept: "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      q: texts,
      source: PAGE_SOURCE_LANG,
      target,
      format: "text",
    }),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.warn(
      "Google Translate API error:",
      res.status,
      body.slice(0, 500)
    );
    return texts;
  }

  const jsonText = new TextDecoder("utf-8").decode(await res.arrayBuffer());
  const data = JSON.parse(jsonText) as TranslateV2Response;
  const translations = data.data?.translations;
  if (!translations || translations.length !== texts.length) {
    console.warn("Google Translate API unexpected response shape");
    return texts;
  }

  return translations.map((item, index) => {
    const raw = item.translatedText ?? "";
    const decoded = raw ? decodeHtmlEntities(raw) : texts[index];
    console.log("[translate] Google response", {
      en: texts[index],
      target,
      rawFromGoogle: raw,
      afterDecode: decoded,
    });
    return decoded;
  });
}

export async function translateText(
  text: string,
  locale: string
): Promise<string> {
  const [result] = await translateBatch([text], locale);
  return result ?? text;
}

export async function translateBatch(
  texts: string[],
  locale: string
): Promise<string[]> {
  const target = normalizeLocale(locale);
  if (target === PAGE_SOURCE_LANG) return texts;

  const apiKey = getApiKey();
  if (!apiKey) {
    if (!missingKeyWarned) {
      missingKeyWarned = true;
      console.warn(
        "GOOGLE_TRANSLATE_API_KEY is not set; PDF text will stay in English"
      );
    }
    return texts;
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const text of texts) {
    if (!text || text === "-") continue;
    if (translationCache.has(cacheKey(target, text))) continue;
    if (seen.has(text)) continue;
    seen.add(text);
    unique.push(text);
  }

  for (let i = 0; i < unique.length; i += MAX_SEGMENTS_PER_REQUEST) {
    const chunk = unique.slice(i, i + MAX_SEGMENTS_PER_REQUEST);
    try {
      const translated = await translateChunk(chunk, target, apiKey);
      chunk.forEach((text, index) => {
        translationCache.set(
          cacheKey(target, text),
          translated[index] ?? text
        );
      });
    } catch (error) {
      console.warn("Google Translate API request failed:", error);
    }
  }

  return texts.map((text) => {
    if (!text || text === "-") return text;
    const cached = translationCache.get(cacheKey(target, text));
    return cached ? decodeHtmlEntities(cached) : text;
  });
}
