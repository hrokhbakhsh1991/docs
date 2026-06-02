import { isDenaliEventTourKind, isDenaliTourKind, type DenaliTourKind } from "@repo/types";

/** Target catalogue after Phase 2 consolidation. */
export const DENALI_CONSOLIDATED_THEME_SEEDS = [
  {
    slug: "nature",
    name: "طبیعت‌گردی",
    description: "طبیعت‌گردی",
    sortOrder: 10,
    formProfile: "denali_pilot" as const,
    canonicalId: "theme_nature",
  },
  {
    slug: "mountain",
    name: "کوهنوردی",
    description: "کوهنوردی",
    sortOrder: 20,
    formProfile: "denali_pilot" as const,
    canonicalId: "theme_mountain",
  },
] as const;

export type ConsolidatedThemeSlug = (typeof DENALI_CONSOLIDATED_THEME_SEEDS)[number]["slug"];

export function resolveConsolidatedThemeSlug(
  oldSlug: string,
  matchTourType: string | null | undefined,
): ConsolidatedThemeSlug {
  const slug = oldSlug.toLowerCase();
  if (slug.includes("mountain") || matchTourType === "mountain") {
    return "mountain";
  }
  if (slug.includes("nature") || matchTourType === "nature" || slug.includes("desert")) {
    return "nature";
  }
  if (slug.includes("short-session") || matchTourType === "event") {
    return "nature";
  }
  return "nature";
}

export function sanitizePresetDefaultsGhost(
  defaults: Record<string, unknown>,
): { sanitized: Record<string, unknown>; warnings: string[]; changed: boolean } {
  const warnings: string[] = [];
  const basic = defaults.basicInfo as Record<string, unknown> | undefined;
  const kind = basic?.tourType;
  if (!isDenaliTourKind(kind)) {
    return { sanitized: defaults, warnings, changed: false };
  }

  const sanitized = structuredClone(defaults) as Record<string, unknown>;
  const programNature = sanitized.programNature as Record<string, unknown> | undefined;
  if (!programNature || !isDenaliEventTourKind(kind as DenaliTourKind)) {
    return { sanitized, warnings, changed: false };
  }

  let changed = false;
  if (programNature.difficultyLevel !== undefined) {
    delete programNature.difficultyLevel;
    warnings.push("cleared programNature.difficultyLevel (event kind)");
    changed = true;
  }
  if (programNature.hikingHoursApprox !== undefined) {
    delete programNature.hikingHoursApprox;
    warnings.push("cleared programNature.hikingHoursApprox (event kind)");
    changed = true;
  }
  return { sanitized, warnings, changed };
}

export function sanitizeTripDetailsGhost(
  tripDetails: Record<string, unknown>,
): { sanitized: Record<string, unknown>; warnings: string[]; changed: boolean } {
  const warnings: string[] = [];
  const overview = tripDetails.overview as Record<string, unknown> | undefined;
  if (!overview) {
    return { sanitized: tripDetails, warnings, changed: false };
  }

  const kind = overview.denaliTourKind;
  if (!isDenaliTourKind(kind) || !isDenaliEventTourKind(kind as DenaliTourKind)) {
    return { sanitized: tripDetails, warnings, changed: false };
  }

  const sanitized = structuredClone(tripDetails) as Record<string, unknown>;
  const nextOverview = sanitized.overview as Record<string, unknown>;
  if (nextOverview.difficultyLevel === undefined) {
    return { sanitized: tripDetails, warnings, changed: false };
  }

  delete nextOverview.difficultyLevel;
  warnings.push("cleared overview.difficultyLevel (event kind)");
  return { sanitized, warnings, changed: true };
}
