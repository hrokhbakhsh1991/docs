/**
 * canonicalData JSON dot paths (flat {@link DenaliCanonicalTourModel} storage vocabulary).
 * Rule-engine / registry paths may use RHF-shaped prefixes; map them here for Settings + validation.
 */

/** Registry / rule-model paths that differ from canonicalData JSON storage paths. */
export const DENALI_TEMPLATE_RULE_PATH_TO_STORAGE_PATH: Readonly<Record<string, string>> = {
  "tripDetails.overview.peakHeight": "overview.peakHeight",
  "tripDetails.overview.nonAttendanceDetails": "overview.nonAttendanceDetails",
  "tripDetails.overview.customServiceLabels": "customServiceLabels",
  "tripDetails.metrics.elevationGain": "metrics.elevationGain",
};

const STORAGE_TO_RULE_PATHS = new Map<string, readonly string[]>();
for (const [rulePath, storagePath] of Object.entries(DENALI_TEMPLATE_RULE_PATH_TO_STORAGE_PATH)) {
  const existing = STORAGE_TO_RULE_PATHS.get(storagePath) ?? [];
  STORAGE_TO_RULE_PATHS.set(storagePath, [...existing, rulePath]);
}

/** Normalize a rule-model or legacy overlay path to a canonicalData JSON dot path. */
export function toDenaliTemplateStoragePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) {
    return trimmed;
  }
  const aliased = DENALI_TEMPLATE_RULE_PATH_TO_STORAGE_PATH[trimmed];
  if (aliased != null) {
    return aliased;
  }
  if (trimmed.startsWith("basicInfo.")) {
    return trimmed.slice("basicInfo.".length);
  }
  if (trimmed.startsWith("programNature.")) {
    return `program.${trimmed.slice("programNature.".length)}`;
  }
  if (trimmed.startsWith("pricingPayment.")) {
    return `pricing.${trimmed.slice("pricingPayment.".length)}`;
  }
  if (trimmed.startsWith("participantRequirements.")) {
    return `participants.${trimmed.slice("participantRequirements.".length)}`;
  }
  if (trimmed.startsWith("photosData.")) {
    return trimmed.slice("photosData.".length);
  }
  if (trimmed.startsWith("transport.") && trimmed.endsWith("transportMode")) {
    return "transport.mode";
  }
  return trimmed;
}

/** Legacy overlay / JSON paths that may still exist on read — not valid on save. */
export function listDenaliTemplateLegacyOverlayPaths(storagePath: string): readonly string[] {
  return STORAGE_TO_RULE_PATHS.get(storagePath) ?? [];
}

/** Suggest a canonicalData JSON path when an admin authors an invalid key. */
export function suggestDenaliTemplateStoragePath(invalidPath: string): string | undefined {
  const trimmed = invalidPath.trim();
  if (!trimmed) {
    return undefined;
  }

  const direct = toDenaliTemplateStoragePath(trimmed);
  if (direct !== trimmed && !direct.startsWith("tripDetails")) {
    return direct;
  }

  if (trimmed === "tripDetails") {
    return "overview.peakHeight";
  }
  if (trimmed.startsWith("tripDetails.overview.")) {
    return `overview.${trimmed.slice("tripDetails.overview.".length)}`;
  }
  if (trimmed.startsWith("tripDetails.metrics.")) {
    return `metrics.${trimmed.slice("tripDetails.metrics.".length)}`;
  }
  if (trimmed.startsWith("tripDetails.")) {
    return undefined;
  }
  if (trimmed.startsWith("basicInfo.")) {
    return trimmed.slice("basicInfo.".length);
  }
  if (trimmed.startsWith("programNature.")) {
    return `program.${trimmed.slice("programNature.".length)}`;
  }
  if (trimmed.startsWith("pricingPayment.")) {
    return `pricing.${trimmed.slice("pricingPayment.".length)}`;
  }
  if (trimmed.startsWith("participantRequirements.")) {
    return `participants.${trimmed.slice("participantRequirements.".length)}`;
  }
  return undefined;
}

export function formatDenaliTemplatePathSuggestion(invalidPath: string): string {
  const suggestion = suggestDenaliTemplateStoragePath(invalidPath);
  if (suggestion == null) {
    return `Unknown canonical field "${invalidPath}" — use a path from the Denali template field registry (e.g. overview.peakHeight, title, program.themeIds).`;
  }
  return `Invalid canonical path "${invalidPath}" — use "${suggestion}" in canonicalData JSON instead.`;
}
