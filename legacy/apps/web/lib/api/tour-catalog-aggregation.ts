import { logBffError } from "@/lib/logging/bff-logger";

export type ResolvedCatalogItem = { id: string; name: string };

type CatalogRow = { id: string; name: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
}

function resolveCatalogIds(
  ids: string[],
  catalog: Map<string, string>,
): ResolvedCatalogItem[] {
  return ids
    .map((id) => {
      const name = catalog.get(id);
      return name ? { id, name } : null;
    })
    .filter((item): item is ResolvedCatalogItem => item !== null);
}

export function ensureTourTripDetailsShell(tour: Record<string, unknown>): Record<string, unknown> {
  let details = asRecord(tour.details);
  if (!details) {
    details = {};
    tour.details = details;
  }
  let tripDetails = asRecord(details.tripDetails);
  if (!tripDetails) {
    tripDetails = {};
    details.tripDetails = tripDetails;
  }
  return tripDetails;
}

export function mergeResolvedGearIntoTour(
  tour: Record<string, unknown>,
  catalog: CatalogRow[] | null,
  logContext: { tourId: string; catalog: "equipment" },
): void {
  const tripDetails = ensureTourTripDetailsShell(tour);
  let participation = asRecord(tripDetails.participation);
  if (!participation) {
    participation = {};
    tripDetails.participation = participation;
  }

  const requiredIds = stringIds(participation.gearRequiredIds);
  const optionalIds = stringIds(participation.gearOptionalIds);

  if (!catalog) {
    participation.resolvedGear = {
      required: requiredIds.map((id) => ({ id, name: id })),
      optional: optionalIds.map((id) => ({ id, name: id })),
    };
    if (requiredIds.length > 0 || optionalIds.length > 0) {
      logBffError("tour_aggregate_gear_catalog_unavailable", {
        tourId: logContext.tourId,
        catalog: logContext.catalog,
        requiredIdCount: requiredIds.length,
        optionalIdCount: optionalIds.length,
      });
    }
    return;
  }

  const equipmentMap = new Map(catalog.map((row) => [row.id, row.name]));
  participation.resolvedGear = {
    required: resolveCatalogIds(requiredIds, equipmentMap),
    optional: resolveCatalogIds(optionalIds, equipmentMap),
  };
}

export function mergeResolvedThemesIntoTour(
  tour: Record<string, unknown>,
  catalog: CatalogRow[] | null,
  logContext: { tourId: string },
): void {
  const tripDetails = ensureTourTripDetailsShell(tour);
  let overview = asRecord(tripDetails.overview);
  if (!overview) {
    overview = {};
    tripDetails.overview = overview;
  }

  const themeIds = stringIds(overview.tourThemeIds);
  const labelSnapshot = asRecord(overview.tourThemeLabels) as Record<string, string> | null;

  if (!catalog) {
    overview.resolvedThemes = themeIds.map((id) => ({
      id,
      name: labelSnapshot?.[id]?.trim() || id,
    }));
    if (themeIds.length > 0) {
      logBffError("tour_aggregate_theme_catalog_unavailable", {
        tourId: logContext.tourId,
        themeIdCount: themeIds.length,
      });
    }
    return;
  }

  const themeMap = new Map(catalog.map((row) => [row.id, row.name]));
  overview.resolvedThemes = themeIds.map((id) => {
    const fromCatalog = themeMap.get(id);
    if (fromCatalog) {
      return { id, name: fromCatalog };
    }
    const fromSnapshot = labelSnapshot?.[id]?.trim();
    return { id, name: fromSnapshot || id };
  });
}

export async function parseCatalogJson(res: Response): Promise<CatalogRow[] | null> {
  if (!res.ok) {
    return null;
  }
  const body = await res.json().catch(() => null);
  if (!Array.isArray(body)) {
    return null;
  }
  return body.filter(
    (row): row is CatalogRow =>
      row != null &&
      typeof row === "object" &&
      typeof (row as CatalogRow).id === "string" &&
      typeof (row as CatalogRow).name === "string",
  );
}
