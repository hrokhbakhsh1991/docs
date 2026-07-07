"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

type ErrorPageProps = {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
};

export default function MarketingCatalogError({ reset }: ErrorPageProps) {
  const t = useTranslations("catalog.error");

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
        <Link href="/tours">{t("backToTours")}</Link>
      </p>
    </div>
  );
}
