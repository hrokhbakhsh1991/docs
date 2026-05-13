import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";

import { TourCreateWizardChunkLoading } from "./tour-create-wizard-chunk-loading";
import { TourCreateWizardWrapper } from "./tour-create-wizard-wrapper";

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
  return (
    <Suspense fallback={<TourCreateWizardChunkLoading />}>
      <TourCreateWizardWrapper />
    </Suspense>
  );
}
