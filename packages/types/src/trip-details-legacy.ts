/**
 * Normalizes stored `tripDetails` JSON that used the legacy singular
 * `overview.tripStyle` key into `overview.tripStyles` (multi-select).
 * Call on read paths before validation / form defaults; does not persist.
 */
export function normalizeLegacyOverviewTripStyleToTripStyles(
  tripDetails: Record<string, unknown> | null | undefined,
): void {
  if (!tripDetails || typeof tripDetails !== "object" || Array.isArray(tripDetails)) {
    return;
  }
  const rawOverview = tripDetails.overview;
  if (!rawOverview || typeof rawOverview !== "object" || Array.isArray(rawOverview)) {
    return;
  }
  const overview = rawOverview as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(overview, "tripStyle")) {
    return;
  }
  const legacy = overview.tripStyle;
  delete overview.tripStyle;
  if (legacy == null || typeof legacy !== "string") {
    return;
  }
  const single = legacy.trim();
  if (!single) {
    return;
  }
  const existingRaw = overview.tripStyles;
  const existing: string[] = Array.isArray(existingRaw)
    ? existingRaw
        .filter((x): x is string => typeof x === "string" && x.trim() !== "")
        .map((x) => x.trim())
    : [];
  const set = new Set(existing);
  set.add(single);
  overview.tripStyles = [...set];
}
