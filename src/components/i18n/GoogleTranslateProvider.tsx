"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { countryCodeToLocale } from "@/lib/countryToLocale";
import {
  DEFAULT_COUNTRY_CODE,
  INCLUDED_GOOGLE_LOCALES,
  getLanguageByCountryCode,
} from "@/lib/popularLanguages";

const PAGE_SOURCE_LANG = "en";
const GOOGTRANS_COOKIE = "googtrans";
const SYNC_KEY = "__gt_cookie_synced";

type GoogleTranslateContextValue = {
  setLanguageByCountryCode: (countryCode: string) => void;
};

const GoogleTranslateContext = createContext<GoogleTranslateContextValue | null>(null);

declare global {
  interface Window {
    googleTranslateElementInit?: () => void;
    google?: {
      translate: {
        TranslateElement: new (
          options: {
            pageLanguage: string;
            includedLanguages: string;
            autoDisplay: boolean;
            layout: number;
          },
          elementId: string
        ) => void;
      };
    };
  }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function setGoogtransCookie(locale: string) {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  if (locale === PAGE_SOURCE_LANG) {
    document.cookie = `${GOOGTRANS_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    document.cookie = `${GOOGTRANS_COOKIE}=; path=/; domain=${window.location.hostname}; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
    return;
  }
  document.cookie = `${GOOGTRANS_COOKIE}=/en/${locale}; path=/; expires=${expires}; SameSite=Lax`;
}

function getLocaleFromGoogtransCookie(): string {
  const value = getCookie(GOOGTRANS_COOKIE);
  if (!value) return PAGE_SOURCE_LANG;
  const parts = value.split("/").filter(Boolean);
  return parts[parts.length - 1] || PAGE_SOURCE_LANG;
}

const HIDE_SELECTORS = [
  ".goog-te-banner-frame",
  "iframe.goog-te-banner-frame",
  "iframe.skiptranslate",
  "body > iframe.skiptranslate",
  ".skiptranslate > iframe",
  ".goog-te-banner",
  ".VIpgJd-ZVi9od-ORHb-OEVmcd",
  ".VIpgJd-ZVi9od-aZ2wEe-wOHMyf",
  ".VIpgJd-ZVi9od-aZ2wEe",
  "#goog-gt-tt",
  ".goog-te-balloon-frame",
  "#goog-gt-original-text",
  ".goog-te-spinner-pos",
  "body > .skiptranslate:not(#google_translate_element)",
].join(",");

function hideGoogleChrome() {
  document.documentElement.style.setProperty("margin-top", "0", "important");
  document.body.style.setProperty("top", "0", "important");
  document.body.style.setProperty("margin-top", "0", "important");
  document.body.style.setProperty("padding-top", "0", "important");
  document.body.style.setProperty("position", "static", "important");

  document.querySelectorAll(HIDE_SELECTORS).forEach((el) => {
    const node = el as HTMLElement;
    node.style.setProperty("display", "none", "important");
    node.style.setProperty("height", "0", "important");
    node.style.setProperty("max-height", "0", "important");
    node.style.setProperty("visibility", "hidden", "important");
    node.style.setProperty("pointer-events", "none", "important");
    node.style.setProperty("opacity", "0", "important");
  });
}

export function GoogleTranslateProvider({ children }: { children: ReactNode }) {
  const scriptLoaded = useRef(false);
  const rafCount = useRef(0);

  const setLanguageByCountryCode = useCallback((countryCode: string) => {
    const locale = countryCodeToLocale(countryCode);
    setGoogtransCookie(locale);
    document.documentElement.lang = locale;
    window.location.reload();
  }, []);

  const value = useMemo(
    () => ({ setLanguageByCountryCode }),
    [setLanguageByCountryCode]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(SYNC_KEY)) return;

    const savedCountry = localStorage.getItem("selectedLanguage") ?? DEFAULT_COUNTRY_CODE;
    const savedLocale = countryCodeToLocale(savedCountry);
    const cookieLocale = getLocaleFromGoogtransCookie();

    const needsSync =
      (savedLocale === PAGE_SOURCE_LANG && cookieLocale !== PAGE_SOURCE_LANG) ||
      (savedLocale !== PAGE_SOURCE_LANG && cookieLocale !== savedLocale);

    if (needsSync) {
      sessionStorage.setItem(SYNC_KEY, "1");
      setGoogtransCookie(savedLocale);
      document.documentElement.lang = savedLocale;
      window.location.reload();
      return;
    }

    sessionStorage.setItem(SYNC_KEY, "1");
    document.documentElement.lang = savedLocale;
  }, []);

  useEffect(() => {
    if (scriptLoaded.current) return;
    scriptLoaded.current = true;

    window.googleTranslateElementInit = () => {
      if (!window.google?.translate?.TranslateElement) return;
      new window.google.translate.TranslateElement(
        {
          pageLanguage: PAGE_SOURCE_LANG,
          includedLanguages: INCLUDED_GOOGLE_LOCALES,
          autoDisplay: false,
          layout: 0,
        },
        "google_translate_element"
      );
    };

    const script = document.createElement("script");
    script.src =
      "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  useLayoutEffect(() => {
    hideGoogleChrome();

    const runFrames = () => {
      hideGoogleChrome();
      rafCount.current += 1;
      if (rafCount.current < 180) {
        requestAnimationFrame(runFrames);
      }
    };
    requestAnimationFrame(runFrames);

    const timeouts = [0, 50, 100, 250, 500, 1000, 1500, 2500].map((ms) =>
      setTimeout(hideGoogleChrome, ms)
    );

    const interval = setInterval(hideGoogleChrome, 350);
    const intervalTimeout = setTimeout(() => clearInterval(interval), 25000);

    const observer = new MutationObserver(hideGoogleChrome);
    observer.observe(document.body, { childList: true, subtree: true });

    const attrObserver = new MutationObserver(hideGoogleChrome);
    attrObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });
    attrObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["style", "class"],
    });

    const onPopup = () => hideGoogleChrome();
    document.addEventListener("goog-gt-popupShown", onPopup);

    return () => {
      timeouts.forEach(clearTimeout);
      clearInterval(interval);
      clearTimeout(intervalTimeout);
      observer.disconnect();
      attrObserver.disconnect();
      document.removeEventListener("goog-gt-popupShown", onPopup);
    };
  }, []);

  return (
    <GoogleTranslateContext.Provider value={value}>
      {children}
    </GoogleTranslateContext.Provider>
  );
}

export function useGoogleTranslate() {
  const ctx = useContext(GoogleTranslateContext);
  if (!ctx) {
    throw new Error("useGoogleTranslate must be used within GoogleTranslateProvider");
  }
  return ctx;
}

export function getSelectedCountryFlag(countryCode: string): string {
  return getLanguageByCountryCode(countryCode)?.flag ?? "🇬🇧";
}
