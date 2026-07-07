import type { MarketingCatalogCard } from "./catalog-types";

export function formatCatalogCancellationDeadline(
  hours: number | null | undefined,
  labelTemplate: string,
): string | null {
  if (hours == null || !Number.isFinite(hours)) {
    return null;
  }
  return labelTemplate.replace("{hours}", String(Math.trunc(hours)));
}

export function formatCatalogCancellationPenalty(
  percentage: number | null | undefined,
  labelTemplate: string,
): string | null {
  if (percentage == null || !Number.isFinite(percentage)) {
    return null;
  }
  return labelTemplate.replace("{percent}", String(Math.trunc(percentage)));
}

export function buildCatalogCancellationLines(
  tour: MarketingCatalogCard,
  labels: {
    readonly deadline: string;
    readonly penalty: string;
  },
): readonly string[] {
  const lines: string[] = [];
  const deadline = formatCatalogCancellationDeadline(
    tour.cancellationDeadlineHours,
    labels.deadline,
  );
  if (deadline != null) {
    lines.push(deadline);
  }
  const penalty = formatCatalogCancellationPenalty(
    tour.cancellationPenaltyPercentage,
    labels.penalty,
  );
  if (penalty != null) {
    lines.push(penalty);
  }
  return Object.freeze(lines);
}
