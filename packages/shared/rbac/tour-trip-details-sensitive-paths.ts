/**
 * High-risk `tripDetails` paths (Phase 8.1 — urban/cinema pricing, logistics caps).
 * Matched as path prefix against dot-paths collected from a patch object.
 */
export const SENSITIVE_TRIP_DETAILS_PATH_PREFIXES = [
  "pricing.",
  "logistics.groupSize",
  "urban",
  "cinema",
] as const;

export function isSensitiveTripDetailsPath(path: string): boolean {
  const normalized = path.trim();
  if (!normalized) {
    return false;
  }
  return SENSITIVE_TRIP_DETAILS_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}.`) || normalized.startsWith(prefix),
  );
}

export function collectTripDetailsPatchPaths(value: unknown, prefix = ""): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    return prefix ? [prefix] : [];
  }
  const paths: string[] = [];
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      paths.push(...collectTripDetailsPatchPaths(child, next));
    } else {
      paths.push(next);
    }
  }
  return paths;
}

export function listSensitiveTripDetailsPathsFromPatch(tripDetails: unknown): string[] {
  return collectTripDetailsPatchPaths(tripDetails).filter(isSensitiveTripDetailsPath);
}
