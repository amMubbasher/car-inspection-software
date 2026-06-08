const PAGE_SOURCE_LANG = "en";

export function getLocaleFromRequest(req: Request): string {
  const cookie = req.headers.get("cookie") ?? "";
  const match = cookie.match(/(?:^|;\s*)googtrans=([^;]*)/);
  if (!match) return PAGE_SOURCE_LANG;

  const value = decodeURIComponent(match[1].trim());
  if (!value) return PAGE_SOURCE_LANG;

  const parts = value.split("/").filter(Boolean);
  return parts[parts.length - 1] || PAGE_SOURCE_LANG;
}

export function normalizeLocale(locale: string): string {
  return locale?.trim() || PAGE_SOURCE_LANG;
}

export async function translateText(text: string, locale: string): Promise<string> {
  const target = normalizeLocale(locale);
  if (!text || target === PAGE_SOURCE_LANG) return text;

  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${PAGE_SOURCE_LANG}&tl=${encodeURIComponent(target)}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, { next: { revalidate: 0 } });
    if (!res.ok) return text;

    const data = (await res.json()) as [Array<[string]>, ...unknown[]];
    const translated = data[0]?.map((part) => part[0]).join("") ?? text;
    return translated || text;
  } catch {
    return text;
  }
}

export async function translateBatch(texts: string[], locale: string): Promise<string[]> {
  const target = normalizeLocale(locale);
  if (target === PAGE_SOURCE_LANG) return texts;

  const cache = new Map<string, string>();
  const unique = [...new Set(texts.filter((t) => t && t !== "-"))];

  await Promise.all(
    unique.map(async (text) => {
      cache.set(text, await translateText(text, target));
    })
  );

  return texts.map((text) => {
    if (!text || text === "-") return text;
    return cache.get(text) ?? text;
  });
}
