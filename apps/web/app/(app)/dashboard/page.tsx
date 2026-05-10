import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

import { DashboardPageClient } from "./dashboard-page-client";

const LOCALE = routing.defaultLocale;

export async function generateMetadata() {
  setRequestLocale(LOCALE);
  const t = await getTranslations({ locale: LOCALE, namespace: "metadata.dashboard" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function DashboardPage() {
  setRequestLocale(LOCALE);

  return <DashboardPageClient />;
}
