import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";

import "@tour/ui/styles.css";
import "./globals.css";

import { routing } from "@/i18n/routing";
import { vazirmatn } from "@/fonts/vazirmatn";

import { AppChromeProviders } from "./providers";

const DOCUMENT_LOCALE = routing.defaultLocale;

/**
 * Root document: Persian-only for now (`lang="fa"` `dir="rtl"`).
 * `next-intl` stays active for `t()` / messages; URLs are locale-less (see `src/i18n/routing.ts`).
 */
export async function generateMetadata(): Promise<Metadata> {
  setRequestLocale(DOCUMENT_LOCALE);
  const t = await getTranslations({ locale: DOCUMENT_LOCALE, namespace: "metadata.layout" });

  return {
    title: {
      default: t("title"),
      template: t("titleTemplate"),
    },
    description: t("description"),
  };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  setRequestLocale(DOCUMENT_LOCALE);
  const messages = await getMessages();

  return (
    <html lang="fa" dir="rtl" className={`${vazirmatn.variable} theme-light`}>
      <body className="font-sans">
        <NextIntlClientProvider locale={DOCUMENT_LOCALE} messages={messages}>
          <AppChromeProviders>{children}</AppChromeProviders>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
