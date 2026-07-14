export type PopularLanguage = {
  countryCode: string;
  name: string;
  locale: string;
  flag: string;
};

export const POPULAR_LANGUAGES: PopularLanguage[] = [
  { countryCode: "GB", name: "English", locale: "en", flag: "🇬🇧" },
  { countryCode: "AE", name: "Arabic", locale: "ar", flag: "🇦🇪" },
  { countryCode: "IR", name: "Persian", locale: "fa", flag: "🇮🇷" },
  { countryCode: "PK", name: "Urdu", locale: "ur", flag: "🇵🇰" },
  { countryCode: "IN", name: "Hindi", locale: "hi", flag: "🇮🇳" },
  { countryCode: "FR", name: "French", locale: "fr", flag: "🇫🇷" },
  { countryCode: "DE", name: "German", locale: "de", flag: "🇩🇪" },
  { countryCode: "ES", name: "Spanish", locale: "es", flag: "🇪🇸" },
  { countryCode: "RU", name: "Russian", locale: "ru", flag: "🇷🇺" },
  { countryCode: "CN", name: "Chinese", locale: "zh-CN", flag: "🇨🇳" },
  { countryCode: "TR", name: "Turkish", locale: "tr", flag: "🇹🇷" },
  { countryCode: "PT", name: "Portuguese", locale: "pt", flag: "🇵🇹" },
  { countryCode: "BD", name: "Bengali", locale: "bn", flag: "🇧🇩" },
];

export const DEFAULT_COUNTRY_CODE = "GB";

export const INCLUDED_GOOGLE_LOCALES = POPULAR_LANGUAGES.map((l) => l.locale)
  .filter((locale) => locale !== "en")
  .join(",");

export function getLanguageByCountryCode(countryCode: string): PopularLanguage | undefined {
  return POPULAR_LANGUAGES.find((l) => l.countryCode === countryCode);
}
