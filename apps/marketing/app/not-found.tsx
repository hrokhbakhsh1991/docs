import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";

import { isAppLocale, resolveMarketingLocalePath, routing } from "@/i18n/routing";
import { buildMarketingSurfaceNoindexMetadata } from "@/seo/build-marketing-metadata";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("catalog.pageNotFound");
  return buildMarketingSurfaceNoindexMetadata({
    title: t("metadataTitle"),
    description: t("metadataDescription"),
  });
}

export default async function MarketingNotFound() {
  const t = await getTranslations("catalog.pageNotFound");
  const localeRaw = await getLocale();
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const homeHref = resolveMarketingLocalePath("/", locale);

  return (
    <div data-marketing-not-found data-marketing-page-not-found>
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      <p>
        <Link href={homeHref}>{t("back")}</Link>
      </p>
    </div>
  );
}
