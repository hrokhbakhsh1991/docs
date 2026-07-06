import type { MarketingCatalogCard } from "./catalog-types";
import type { MarketingCategoryGroup } from "./marketing-catalog-surface-types";

export type CatalogReadinessCell = {
  readonly id: string;
  readonly label: string;
  readonly value: string;
};

export type BuildCatalogReadinessCellsInput = {
  readonly tour: MarketingCatalogCard;
  readonly family: MarketingCategoryGroup | null;
  readonly labels: {
    readonly hikingHours: string;
    readonly hikingGoHours: string;
    readonly hikingReturnHours: string;
    readonly peakHeight: string;
    readonly trailDistance: string;
    readonly elevationGain: string;
    readonly minimumAge: string;
    readonly maximumAge: string;
  };
  readonly formatHours: (hours: number) => string;
  readonly formatMeters: (meters: number) => string;
  readonly formatKilometers: (km: number) => string;
  readonly formatAge: (years: number) => string;
};

/** PR-D2b outdoor readiness cells — gated by category family + data presence. */
export function buildCatalogReadinessCells(
  input: BuildCatalogReadinessCellsInput,
): readonly CatalogReadinessCell[] {
  const { tour, family } = input;
  const cells: CatalogReadinessCell[] = [];

  if (tour.hikingHoursApprox != null) {
    cells.push({
      id: "hiking-hours",
      label: input.labels.hikingHours,
      value: input.formatHours(tour.hikingHoursApprox),
    });
  }

  if (tour.hikingGoHours != null) {
    cells.push({
      id: "hiking-go-hours",
      label: input.labels.hikingGoHours,
      value: input.formatHours(tour.hikingGoHours),
    });
  }

  if (tour.hikingReturnHours != null) {
    cells.push({
      id: "hiking-return-hours",
      label: input.labels.hikingReturnHours,
      value: input.formatHours(tour.hikingReturnHours),
    });
  }

  if (family === "mountain" && tour.peakHeightMeters != null) {
    cells.push({
      id: "peak-height",
      label: input.labels.peakHeight,
      value: input.formatMeters(tour.peakHeightMeters),
    });
  }

  if (family === "mountain" && tour.elevationGainMeters != null) {
    cells.push({
      id: "elevation-gain",
      label: input.labels.elevationGain,
      value: input.formatMeters(tour.elevationGainMeters),
    });
  }

  if (family === "nature" && tour.trailDistanceKm != null) {
    cells.push({
      id: "trail-distance",
      label: input.labels.trailDistance,
      value: input.formatKilometers(tour.trailDistanceKm),
    });
  }

  if (tour.minimumAge != null) {
    cells.push({
      id: "minimum-age",
      label: input.labels.minimumAge,
      value: input.formatAge(tour.minimumAge),
    });
  }

  if (tour.maximumAge != null) {
    cells.push({
      id: "maximum-age",
      label: input.labels.maximumAge,
      value: input.formatAge(tour.maximumAge),
    });
  }

  return Object.freeze(cells);
}
