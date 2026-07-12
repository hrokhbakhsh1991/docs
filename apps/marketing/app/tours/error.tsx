"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { isAppLocale, resolveMarketingToursListPath, routing } from "@/i18n/routing";

type ErrorPageProps = {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
};

export default function MarketingCatalogError({ reset }: ErrorPageProps) {
  const t = useTranslations("catalog.error");
  const localeRaw = useLocale();
  const locale = isAppLocale(localeRaw) ? localeRaw : routing.defaultLocale;
  const toursHref = resolveMarketingToursListPath(locale);

  return (
    <div data-marketing-catalog-error>
      <h1>{t("catalogTitle")}</h1>
      <p>{t("catalogBody")}</p>
      <p>
        <button type="button" onClick={() => reset()}>
          {t("retry")}
        </button>
      </p>
      <p>
        <Link href={toursHref}>{t("backToTours")}</Link>
      </p>
    </div>
  );
}
