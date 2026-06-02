import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { routing } from "@/i18n/routing";
import { fetchTourTitleForMetadata } from "@/lib/tours/fetchTourTitleForMetadata";

import { RegisterForTourClient } from "./register-for-tour-client";

const LOCALE = routing.defaultLocale;

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  setRequestLocale(LOCALE);
  const t = await getTranslations({ locale: LOCALE, namespace: "tours.register" });
  const tourTitle = await fetchTourTitleForMetadata(params.id);

  return {
    title: tourTitle ? t("metaTitle", { title: tourTitle }) : t("metaTitleDefault"),
    description: t("metaDesc"),
  };
}

export default function TourRegisterPage({ params }: { params: { id: string } }) {
  return <RegisterForTourClient tourId={params.id} />;
}
