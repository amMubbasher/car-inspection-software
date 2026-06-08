"use client";

import { ReactNode } from "react";
import { SessionProvider } from "next-auth/react";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "@/redux/store";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";
import Navbar from "@/components/Navbar";

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <SessionProvider>
          <ReduxProvider store={store}>
            <ThemeProvider>
              {" "}
              {/*wrapping app with theme provider */}
              <Navbar />
              <div className="mt-20 md:mt-16">{children}</div>
            </ThemeProvider>
          </ReduxProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
