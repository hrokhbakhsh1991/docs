import type { MarketingCatalogCard } from "./catalog-types";

export type CatalogTourFaqItem = {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly source: "tour" | "static";
};

export type BuildCatalogTourFaqItemsInput = {
  readonly tour: MarketingCatalogCard;
  readonly tourLabels: {
    readonly fitnessQuestion: string;
    readonly cancellationQuestion: string;
  };
  readonly formatCancellationAnswer: () => string | null;
  readonly staticItems: readonly {
    readonly id: string;
    readonly question: string;
    readonly answer: string;
  }[];
};

function readFitnessFaqItem(
  tour: MarketingCatalogCard,
  question: string,
): CatalogTourFaqItem | null {
  const answer = tour.fitnessPrerequisiteText?.trim() ?? "";
  if (answer.length === 0) {
    return null;
  }
  return Object.freeze({
    id: "fitness-prerequisite",
    question,
    answer,
    source: "tour",
  });
}

function readCancellationFaqItem(
  question: string,
  formatCancellationAnswer: () => string | null,
): CatalogTourFaqItem | null {
  const answer = formatCancellationAnswer()?.trim() ?? "";
  if (answer.length === 0) {
    return null;
  }
  return Object.freeze({
    id: "cancellation",
    question,
    answer,
    source: "tour",
  });
}

/** PR-D5 — admin/tour FAQ first; static i18n only when tour has no FAQ rows. */
export function buildCatalogTourFaqItems(
  input: BuildCatalogTourFaqItemsInput,
): readonly CatalogTourFaqItem[] {
  const tourItems = [
    readFitnessFaqItem(input.tour, input.tourLabels.fitnessQuestion),
    readCancellationFaqItem(
      input.tourLabels.cancellationQuestion,
      input.formatCancellationAnswer,
    ),
  ].filter((item): item is CatalogTourFaqItem => item != null);

  if (tourItems.length > 0) {
    return Object.freeze(tourItems);
  }

  return Object.freeze(
    input.staticItems.map((item) =>
      Object.freeze({
        id: item.id,
        question: item.question,
        answer: item.answer,
        source: "static" as const,
      }),
    ),
  );
}

export function tourHasAdminCatalogFaqData(tour: MarketingCatalogCard): boolean {
  if ((tour.fitnessPrerequisiteText?.trim().length ?? 0) > 0) {
    return true;
  }
  const deadline = tour.cancellationDeadlineHours;
  const penalty = tour.cancellationPenaltyPercentage;
  return (
    (deadline != null && Number.isFinite(deadline)) ||
    (penalty != null && Number.isFinite(penalty))
  );
}
