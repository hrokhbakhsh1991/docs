"use client";

import { useTranslations } from "next-intl";

import type { DenaliCanonicalTourModel } from "@repo/types/denali";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";

import { useDenaliStepFieldRules } from "../hooks/useDenaliStepFieldRules";
import { useDenaliCanonicalValue } from "../hooks/useDenaliCanonicalValue";

function ReviewRow({ label, value }: { label: string; value: string | undefined }) {
  if (value == null || (typeof value === "string" && !value.trim())) return null;
  return (
    <div>
      <dt style={{ fontWeight: 600 }}>{label}</dt>
      <dd style={{ margin: "0.15rem 0 0" }}>{value}</dd>
    </div>
  );
}

/** Read-only participant summary on review (placement v1 — no input on review). */
export function DenaliReviewParticipantsDisplay({ form }: { form: DenaliCreateTourWizardForm }) {
  const t = useTranslations("tours.denali");
  const participants = useDenaliCanonicalValue<DenaliCanonicalTourModel["participants"]>(
    "participants",
  );
  const { isVisible } = useDenaliStepFieldRules("review");

  const showMinimumAge = isVisible("participants.minimumAge", form);
  const showMaximumAge = isVisible("participants.maximumAge", form);
  const showFitnessLevel = isVisible("participants.fitnessLevel", form);
  const showNationalId = isVisible("participants.nationalIdRequired", form);
  const showSportsInsurance = isVisible("participants.sportsInsuranceRequired", form);

  if (!showMinimumAge && !showMaximumAge && !showFitnessLevel && !showNationalId && !showSportsInsurance) {
    return null;
  }

  const fitnessLabel =
    participants.fitnessLevel === "low"
      ? t("participants.fitnessLow")
      : participants.fitnessLevel === "medium"
        ? t("participants.fitnessMedium")
        : participants.fitnessLevel === "high"
          ? t("participants.fitnessHigh")
          : undefined;

  return (
    <section
      data-testid="denali-review-participants-display"
      style={{
        display: "grid",
        gap: "0.5rem",
        padding: "0.75rem 0 0",
        borderTop: "1px solid var(--color-border-subtle, #e2e8f0)",
      }}
    >
      <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>
        {t("review.participantsSection")}
      </h3>
      <dl style={{ margin: 0, display: "grid", gap: "0.35rem" }}>
        {showMinimumAge ? (
          <ReviewRow
            label={t("participants.minimumAge")}
            value={
              participants.minimumAge != null
                ? String(participants.minimumAge)
                : undefined
            }
          />
        ) : null}
        {showMaximumAge ? (
          <ReviewRow
            label={t("participants.maximumAge")}
            value={
              participants.maximumAge != null
                ? String(participants.maximumAge)
                : undefined
            }
          />
        ) : null}
        {showFitnessLevel ? (
          <ReviewRow label={t("participants.fitnessLevel")} value={fitnessLabel} />
        ) : null}
        {showNationalId ? (
          <ReviewRow
            label={t("participants.nationalIdRequired")}
            value={
              participants.nationalIdRequired !== false
                ? t("review.yes")
                : t("review.no")
            }
          />
        ) : null}
        {showSportsInsurance ? (
          <ReviewRow
            label={t("participants.sportsInsurance")}
            value={
              participants.sportsInsuranceRequired
                ? t("review.yes")
                : t("review.no")
            }
          />
        ) : null}
      </dl>
    </section>
  );
}
