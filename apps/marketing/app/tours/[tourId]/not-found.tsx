import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { isAppLocale, resolveMarketingLocalePath, routing } from "@/i18n/routing";
import { buildMarketingNotFoundMetadata } from "@/seo/build-marketing-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalog.notFound");
  return buildMarketingNotFoundMetadata({
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  });
}

export default async function MarketingTourNotFound() {
  const t = await getTranslations("catalog.notFound");
  const localeRaw = await getLocale();
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const toursHref = resolveMarketingLocalePath("/tours", locale);

  return (
    <div data-marketing-not-found data-marketing-tour-not-found>
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      <p>
        <Link href={toursHref}>{t("back")}</Link>
      </p>
    </div>
  );
}
