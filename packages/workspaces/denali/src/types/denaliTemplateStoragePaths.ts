/** Registry / rule-model paths that differ from canonicalData JSON storage paths. */
export const DENALI_TEMPLATE_RULE_PATH_TO_STORAGE_PATH: Readonly<Record<string, string>> = {
  "tripDetails.overview.peakHeight": "overview.peakHeight",
  "tripDetails.overview.trailDistanceKm": "overview.trailDistanceKm",
  "tripDetails.overview.nonAttendanceDetails": "overview.nonAttendanceDetails",
  "tripDetails.overview.customServiceLabels": "customServiceLabels",
  "tripDetails.metrics.elevationGain": "metrics.elevationGain",
};

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
