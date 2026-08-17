"use client";

import { useTranslations } from "next-intl";

export const DENALI_DESTINATION_OFFERED_EMPTY_TEST_ID = "denali-destination-offered-empty";
export const DENALI_DESTINATION_OFFERED_EMPTY_RETRY_TEST_ID =
  "denali-destination-offered-empty-retry";

type DenaliDestinationOfferedEmptyNoticeProps = {
  readonly onRetry: () => void;
};

/** ED-DEST-REFETCH-01 — empty-after-filter is not an HTTP error; retry reloads the catalog. */
export function DenaliDestinationOfferedEmptyNotice({
  onRetry,
}: DenaliDestinationOfferedEmptyNoticeProps) {
  const t = useTranslations("denali");
  return (
    <div
      className="denali-wizard-composite__status"
      role="status"
      data-testid={DENALI_DESTINATION_OFFERED_EMPTY_TEST_ID}
    >
      <p>{t("composites.destination.empty")}</p>
      <button
        type="button"
        className="denali-wizard-composite__link"
        data-testid={DENALI_DESTINATION_OFFERED_EMPTY_RETRY_TEST_ID}
        onClick={onRetry}
      >
        {t("composites.catalog.retry")}
      </button>
    </div>
  );
}
