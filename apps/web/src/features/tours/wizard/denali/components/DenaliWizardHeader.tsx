"use client";

import { useTranslations } from "next-intl";

import { calculateCompletionPercentage, useDenaliWizardFormSnapshot } from "../application";

import styles from "./DenaliWizardHeader.module.css";

export function DenaliWizardHeader({ percentage }: { percentage: number }) {
  const t = useTranslations("tours.denali");
  const clamped = Math.min(100, Math.max(0, Math.round(percentage)));

  return (
    <div
      className={styles.root}
      data-testid="workspace-wizard-content-quality"
      aria-label={t("contentQuality.ariaLabel", { percentage: clamped })}
    >
      <div className={styles.labelRow}>
        <span className={styles.label}>{t("contentQuality.label")}</span>
        <span className={styles.value}>{t("contentQuality.percentage", { percentage: clamped })}</span>
      </div>
      <div
        className={styles.track}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={t("contentQuality.ariaLabel", { percentage: clamped })}
      >
        <div className={styles.fill} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

export function DenaliWizardContentQualityHeader() {
  // Immediate snapshot — draft debounce in WorkspaceTourWizard owns the 500ms watch.
  const form = useDenaliWizardFormSnapshot({ debounceMs: 0 });
  const percentage = calculateCompletionPercentage(form);

  return <DenaliWizardHeader percentage={percentage} />;
}
