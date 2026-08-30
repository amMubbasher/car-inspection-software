import {
  DEFAULT_COUNTRY_CODE,
  getLanguageByCountryCode,
  POPULAR_LANGUAGES,
} from "./popularLanguages";

export function countryCodeToLocale(countryCode: string): string {
  return getLanguageByCountryCode(countryCode)?.locale ?? "en";
}

export function getSelectedLocale(): string {
  if (typeof window === "undefined") return "en";
  const countryCode =
    localStorage.getItem("selectedLanguage") ?? DEFAULT_COUNTRY_CODE;
  return countryCodeToLocale(countryCode);
}

export function localeToCountryCode(locale: string): string {
  const normalized = locale.toLowerCase();
  const match = POPULAR_LANGUAGES.find(
    (l) => l.locale.toLowerCase() === normalized
  );
  return match?.countryCode ?? "GB";
}
