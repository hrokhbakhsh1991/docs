import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

import { SettingsPageClient } from "./settings-page-client";

const LOCALE = routing.defaultLocale;

export async function generateMetadata(): Promise<Metadata> {
  setRequestLocale(LOCALE);
  const t = await getTranslations({ locale: LOCALE, namespace: "settings" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default function SettingsPage() {
  return <SettingsPageClient />;
}
