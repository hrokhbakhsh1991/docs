"use client";

import { useTranslations } from "next-intl";

import { isDenaliCatalogSoftFail } from "../adapters/catalog-soft-fail";
import { resolveCodedErrorMessage } from "../adapters/i18n-errors";

export const DENALI_CATALOG_SOFT_FAIL_TEST_ID = "denali-catalog-soft-fail";
export const DENALI_CATALOG_SOFT_FAIL_RETRY_TEST_ID = "denali-catalog-soft-fail-retry";

type DenaliCatalogLoadNoticeProps = {
  readonly error: string | null;
  readonly onRetry?: () => void;
};

/** Catalog fetch notice — soft-fails HTTP 5xx/429/network so flat-edit save is not framed as blocked. */
export function DenaliCatalogLoadNotice({ error, onRetry }: DenaliCatalogLoadNoticeProps) {
  const t = useTranslations("denali");
  const tErrors = useTranslations("settings.errors");

  if (error === null) {
    return null;
  }

  if (isDenaliCatalogSoftFail(error)) {
    return (
      <div
        className="denali-wizard-composite__status"
        role="status"
        data-testid={DENALI_CATALOG_SOFT_FAIL_TEST_ID}
        data-operator-catalog-soft-fail=""
      >
        <p>{t("composites.catalog.degraded")}</p>
        {onRetry ? (
          <button
            type="button"
            className="denali-wizard-composite__link"
            data-testid={DENALI_CATALOG_SOFT_FAIL_RETRY_TEST_ID}
            onClick={onRetry}
          >
            {t("composites.catalog.retry")}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <p className="denali-wizard-composite__error" role="alert">
      {resolveCodedErrorMessage(tErrors, error)}
    </p>
  );
}
