"use client";

import { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "@/redux/store";
import { ThemeProvider } from "@/components/theme-provider";
import { GoogleTranslateProvider } from "@/components/i18n/GoogleTranslateProvider";
import "./globals.css";
import Navbar from "@/components/Navbar";

const GOOGLE_TRANSLATE_CRITICAL_CSS = `
html { margin-top: 0 !important; }
body, html.translated-ltr body, html.translated-rtl body {
  top: 0 !important;
  margin-top: 0 !important;
  padding-top: 0 !important;
  position: static !important;
}
.goog-te-banner-frame, iframe.goog-te-banner-frame, iframe.skiptranslate,
body > iframe.skiptranslate, .skiptranslate > iframe, .goog-te-banner,
.VIpgJd-ZVi9od-ORHb-OEVmcd, .VIpgJd-ZVi9od-aZ2wEe-wOHMyf, .VIpgJd-ZVi9od-aZ2wEe {
  display: none !important;
  height: 0 !important;
  max-height: 0 !important;
  visibility: hidden !important;
  pointer-events: none !important;
  opacity: 0 !important;
}
#goog-gt-tt, .goog-te-balloon-frame, #goog-gt-original-text, .goog-te-spinner-pos {
  display: none !important;
}
`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <style id="google-translate-critical-css">{GOOGLE_TRANSLATE_CRITICAL_CSS}</style>
      </head>
      <body>
        <div
          id="google_translate_element"
          className="absolute left-[-9999px] w-px h-px overflow-hidden"
          aria-hidden="true"
        />
        <SessionProvider>
          <ReduxProvider store={store}>
            <ThemeProvider>
              <GoogleTranslateProvider>
                <Navbar />
                <div className="mt-20 md:mt-16">{children}</div>
              </GoogleTranslateProvider>
            </ThemeProvider>
          </ReduxProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
