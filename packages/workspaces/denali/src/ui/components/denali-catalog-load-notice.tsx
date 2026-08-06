"use client";

import { useTranslations } from "next-intl";

import { isDenaliCatalogSoftFail } from "../adapters/catalog-soft-fail";
import { resolveCodedErrorMessage } from "../adapters/i18n-errors";

export const DENALI_CATALOG_SOFT_FAIL_TEST_ID = "denali-catalog-soft-fail";

type DenaliCatalogLoadNoticeProps = {
  readonly error: string | null;
};

/** Catalog fetch notice — soft-fails HTTP 5xx/429/network so flat-edit save is not framed as blocked. */
export function DenaliCatalogLoadNotice({ error }: DenaliCatalogLoadNoticeProps) {
  const t = useTranslations("denali");
  const tErrors = useTranslations("settings.errors");

  if (error === null) {
    return null;
  }

  if (isDenaliCatalogSoftFail(error)) {
    return (
      <p
        className="denali-wizard-composite__status"
        role="status"
        data-testid={DENALI_CATALOG_SOFT_FAIL_TEST_ID}
        data-operator-catalog-soft-fail=""
      >
        {t("composites.catalog.degraded")}
      </p>
    );
  }

  return (
    <p className="denali-wizard-composite__error" role="alert">
      {resolveCodedErrorMessage(tErrors, error)}
    </p>
  );
}
