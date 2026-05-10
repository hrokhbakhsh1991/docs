import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

const LOCALE = routing.defaultLocale;

export async function generateMetadata(): Promise<Metadata> {
  setRequestLocale(LOCALE);
  const t = await getTranslations({ locale: LOCALE, namespace: "settings" });

  return {
    title: t("tourThemesMetadataTitle"),
    description: t("tourThemesMetadataDescription"),
  };
}

export default function TourThemesSettingsLayout({ children }: { children: ReactNode }) {
  return children;
}
