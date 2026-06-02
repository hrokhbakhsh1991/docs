import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

import { ReconciliationTriageExplorerPage } from "./reconciliation-triage-explorer-page";

const LOCALE = routing.defaultLocale;

export async function generateMetadata(): Promise<Metadata> {
  setRequestLocale(LOCALE);
  const t = await getTranslations({ locale: LOCALE, namespace: "settings" });

  return {
    title: t("reconciliationTriageMetadataTitle"),
    description: t("reconciliationTriageMetadataDescription")
  };
}

export default function ReconciliationTriageSettingsPage() {
  return <ReconciliationTriageExplorerPage />;
}
