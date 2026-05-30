import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

import { ToursPageClient } from "./tours-page-client";

const LOCALE = routing.defaultLocale;

export async function generateMetadata(): Promise<Metadata> {
  setRequestLocale(LOCALE);
  const t = await getTranslations({ locale: LOCALE, namespace: "tours.page" });

  return {
    title: t("metaTitle"),
    description: t("metaDesc"),
  };
}

export default function ToursPage() {
  return <ToursPageClient />;
}
