import { getTranslations } from "next-intl/server";

import { buildCatalogTourFaqItems } from "./build-catalog-tour-faq-items";
import type { MarketingCatalogCard } from "./catalog-types";

const STATIC_FAQ_KEYS = ["q1", "q2", "q3", "q4", "q5"] as const;

export type CatalogTourDetailFaqProps = {
  readonly tour: MarketingCatalogCard;
};

function formatTourCancellationAnswer(
  tour: MarketingCatalogCard,
  t: Awaited<ReturnType<typeof getTranslations<"catalog">>>,
): string | null {
  const lines: string[] = [];
  const deadlineHours = tour.cancellationDeadlineHours;
  if (deadlineHours != null && Number.isFinite(deadlineHours)) {
    lines.push(t("detail.cancellationDeadline", { hours: Math.trunc(deadlineHours) }));
  }
  const penaltyPercent = tour.cancellationPenaltyPercentage;
  if (penaltyPercent != null && Number.isFinite(penaltyPercent)) {
    lines.push(t("detail.cancellationPenalty", { percent: Math.trunc(penaltyPercent) }));
  }
  return lines.length > 0 ? lines.join("\n") : null;
}

export async function CatalogTourDetailFaq({ tour }: CatalogTourDetailFaqProps) {
  const t = await getTranslations("catalog");
  const staticItems = STATIC_FAQ_KEYS.map((key) =>
    Object.freeze({
      id: key,
      question: t(`detail.faq.${key}.question`),
      answer: t(`detail.faq.${key}.answer`),
    }),
  );
  const items = buildCatalogTourFaqItems({
    tour,
    tourLabels: {
      fitnessQuestion: t("detail.faq.fitnessPrerequisiteQuestion"),
      cancellationQuestion: t("detail.faq.cancellationQuestion"),
    },
    formatCancellationAnswer: () => formatTourCancellationAnswer(tour, t),
    staticItems,
  });

  if (items.length === 0) {
    return null;
  }

  return (
    <section data-marketing-catalog-detail-faq id="catalog-detail-faq">
      <h2>{t("detail.faq.heading")}</h2>
      <div data-marketing-catalog-detail-faq-list>
        {items.map((item) => (
          <details
            key={item.id}
            data-marketing-catalog-detail-faq-item
            {...(item.source === "tour"
              ? { "data-marketing-catalog-detail-faq-tour": true }
              : {})}
          >
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
