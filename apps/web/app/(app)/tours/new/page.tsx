import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { TourCreateWizard } from "@/components/tours/wizard/TourCreateWizard";
import { routing } from "@/i18n/routing";

/** Types only — Zod schema stays client-side in the wizard/form layer. */
export type { TourCreateModel } from "@/features/tours/models/tourCreateModel";

const LOCALE = routing.defaultLocale;

export async function generateMetadata(): Promise<Metadata> {
  setRequestLocale(LOCALE);
  const t = await getTranslations({ locale: LOCALE, namespace: "tours.new" });

  return {
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  };
}

export default function NewTourPage() {
  return <TourCreateWizard />;
}
