"use client";

import { useTranslations } from "next-intl";

import type { DenaliWizardCompletionSnapshot } from "../logic/denali-wizard-completion";
import { DENALI_CONTENT_QUALITY_TEST_IDS } from "../test-ids/denali-review-test-ids";

export { DENALI_CONTENT_QUALITY_TEST_IDS } from "../test-ids/denali-review-test-ids";

type DenaliWizardContentQualityHeaderProps = {
  readonly completion: DenaliWizardCompletionSnapshot;
};

export function DenaliWizardContentQualityHeader({
  completion,
}: DenaliWizardContentQualityHeaderProps) {
  const t = useTranslations("wizard.host.contentQuality");
  const clamped = Math.min(100, Math.max(0, completion.percent));

  return (
    <header
      className="denali-wizard-content-quality"
      data-testid={DENALI_CONTENT_QUALITY_TEST_IDS.header}
      aria-label={t("aria", { percent: clamped })}
    >
      <div className="denali-wizard-content-quality__row">
        <span
          className="denali-wizard-content-quality__label"
          data-testid={DENALI_CONTENT_QUALITY_TEST_IDS.label}
        >
          {t("label", { percent: clamped })}
        </span>
        <span className="denali-wizard-content-quality__fraction" aria-hidden="true">
          {t("fraction", { earned: completion.earned, total: completion.total })}
        </span>
      </div>
      <div
        className="denali-wizard-content-quality__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={t("meterAria", { percent: clamped })}
        data-testid={DENALI_CONTENT_QUALITY_TEST_IDS.meter}
      >
        <div
          className="denali-wizard-content-quality__fill"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </header>
  );
}
