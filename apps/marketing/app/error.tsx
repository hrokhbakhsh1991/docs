"use client";

import { useTranslations } from "next-intl";

type ErrorPageProps = {
  readonly error: Error & { readonly digest?: string };
  readonly reset: () => void;
};

export default function MarketingError({ reset }: ErrorPageProps) {
  const t = useTranslations("catalog.error");

  return (
    <div data-marketing-error>
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      <button type="button" onClick={() => reset()}>
        {t("retry")}
      </button>
    </div>
  );
}
