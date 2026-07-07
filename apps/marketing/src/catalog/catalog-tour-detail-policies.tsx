import { getTranslations } from "next-intl/server";

import type { MarketingCatalogCard } from "./catalog-types";

export type CatalogTourDetailPoliciesProps = {
  readonly tour: MarketingCatalogCard;
};

export async function CatalogTourDetailPolicies({ tour }: CatalogTourDetailPoliciesProps) {
  const t = await getTranslations("catalog");
  const policiesText = tour.policiesText?.trim() ?? "";
  const cancellationLines: string[] = [];

  const deadlineHours = tour.cancellationDeadlineHours;
  if (deadlineHours != null && Number.isFinite(deadlineHours)) {
    cancellationLines.push(
      t("detail.cancellationDeadline", { hours: Math.trunc(deadlineHours) }),
    );
  }

  const penaltyPercent = tour.cancellationPenaltyPercentage;
  if (penaltyPercent != null && Number.isFinite(penaltyPercent)) {
    cancellationLines.push(
      t("detail.cancellationPenalty", { percent: Math.trunc(penaltyPercent) }),
    );
  }

  if (policiesText.length === 0 && cancellationLines.length === 0) {
    return null;
  }

  return (
    <section data-tour-policies data-marketing-catalog-detail-policies>
      <h2>{t("detail.policiesHeading")}</h2>
      {policiesText.length > 0 ? <p data-tour-policies-text>{policiesText}</p> : null}
      {cancellationLines.length > 0 ? (
        <ul data-marketing-catalog-detail-cancellation>
          {cancellationLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
