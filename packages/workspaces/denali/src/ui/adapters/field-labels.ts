import {
  compositeIdToSectionTitleMessageKey,
  DENALI_COMPOSITE_LABEL_CANONICAL_PATH,
} from "./denali-composite-label-paths";
import { formatCanonicalPathToLabel } from "./format-canonical-path-label";

export type DenaliTranslator = ((
  key: string,
  values?: Record<string, string | number | Date>
) => string) & {
  readonly has?: (key: string) => boolean;
};

export function canonicalPathToFieldMessageKey(canonicalPath: string): string {
  return `fields.${canonicalPath}`;
}

/**
 * next-intl missing keys often echo `denali.${key}` when `useTranslations("denali")`
 * is used — treat those as unresolved so we never surface raw message keys in UI.
 */
export function isUnresolvedDenaliTranslation(key: string, translated: string): boolean {
  const value = translated.trim();
  if (value.length === 0) {
    return true;
  }
  if (value === key) {
    return true;
  }
  if (value === `denali.${key}`) {
    return true;
  }
  if (value.endsWith(`.${key}`)) {
    return true;
  }
  return /^(denali\.)?(fields|composites|validation|steps|enumOptions)\./.test(value);
}

function tryDenaliTranslate(t: DenaliTranslator, key: string): string | null {
  if (typeof t.has === "function") {
    if (!t.has(key)) {
      return null;
    }
    const translated = t(key);
    return isUnresolvedDenaliTranslation(key, translated) ? null : translated;
  }
  try {
    const translated = t(key);
    return isUnresolvedDenaliTranslation(key, translated) ? null : translated;
  } catch {
    return null;
  }
}

/**
 * Indexed itinerary paths (e.g. `programNature.itinerary.2.title`,
 * `program.itinerary.0.segments.1.title`) map to composite itinerary copy.
 */
export function resolveDenaliIndexedItineraryFieldLabel(
  t: DenaliTranslator,
  canonicalPath: string
): string | null {
  const match = canonicalPath.match(
    /^(?:programNature|program)\.itinerary\.(\d+)(?:\.(.+))?$/
  );
  if (match === null) {
    return null;
  }
  const rest = match[2] ?? "";

  if (rest.length === 0 || rest === "title") {
    return (
      tryDenaliTranslate(t, "composites.itinerary.dayTitle") ??
      tryDenaliTranslate(t, "fields.program.itinerary")
    );
  }
  if (rest === "summary") {
    return tryDenaliTranslate(t, "composites.itinerary.daySummary");
  }
  if (/^segments\.\d+\.title$/.test(rest)) {
    return (
      tryDenaliTranslate(t, "composites.itinerary.dayTitle") ??
      tryDenaliTranslate(t, "composites.itinerary.segmentsHeading")
    );
  }
  if (/^segments\.\d+/.test(rest)) {
    return tryDenaliTranslate(t, "composites.itinerary.segmentsHeading");
  }

  return tryDenaliTranslate(t, "fields.program.itinerary");
}

/** Strip numeric path segments and retry `fields.*` (and programNature→program alias). */
function resolveDenaliFieldLabelByStrippingIndexes(
  t: DenaliTranslator,
  canonicalPath: string
): string | null {
  const parts = canonicalPath.split(".");
  if (!parts.some((part) => /^\d+$/.test(part))) {
    return null;
  }
  const withoutIndexes = parts.filter((part) => !/^\d+$/.test(part)).join(".");
  if (withoutIndexes.length === 0 || withoutIndexes === canonicalPath) {
    return null;
  }
  const candidates = [withoutIndexes];
  if (withoutIndexes.startsWith("programNature.")) {
    candidates.push(`program.${withoutIndexes.slice("programNature.".length)}`);
  }
  for (const candidate of candidates) {
    const label = tryDenaliTranslate(t, canonicalPathToFieldMessageKey(candidate));
    if (label !== null) {
      return label;
    }
  }
  return null;
}

export function resolveDenaliStepLabelFallback(stepId: string): string {
  return stepId
    .replace(/^denali_/, "")
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Resolve a Denali field label for a translator — composite renderer ids map to
 * section titles / anchor canonical paths before `fields.*` lookup.
 */
export function resolveDenaliFieldLabel(t: DenaliTranslator, canonicalPath: string): string {
  if (canonicalPath.startsWith("denali.")) {
    const mapped = DENALI_COMPOSITE_LABEL_CANONICAL_PATH[canonicalPath];
    if (mapped !== undefined) {
      return resolveDenaliFieldLabel(t, mapped);
    }
    const sectionKey = compositeIdToSectionTitleMessageKey(canonicalPath);
    const sectionLabel = tryDenaliTranslate(t, sectionKey);
    if (sectionLabel !== null) {
      return sectionLabel;
    }
  }

  const indexedItinerary = resolveDenaliIndexedItineraryFieldLabel(t, canonicalPath);
  if (indexedItinerary !== null) {
    return indexedItinerary;
  }

  const stripped = resolveDenaliFieldLabelByStrippingIndexes(t, canonicalPath);
  if (stripped !== null) {
    return stripped;
  }

  const key = canonicalPathToFieldMessageKey(canonicalPath);
  const direct = tryDenaliTranslate(t, key);
  if (direct !== null) {
    return direct;
  }

  if (canonicalPath.startsWith("programNature.")) {
    const aliased = tryDenaliTranslate(
      t,
      canonicalPathToFieldMessageKey(`program.${canonicalPath.slice("programNature.".length)}`)
    );
    if (aliased !== null) {
      return aliased;
    }
  }

  return formatCanonicalPathToLabel(canonicalPath);
}

function readEnumOptionLabel(t: DenaliTranslator, key: string, _fallback: string): string | null {
  if (typeof t.has === "function") {
    if (!t.has(key)) {
      return null;
    }
    const translated = t(key);
    return isUnresolvedDenaliTranslation(key, translated) ? null : translated;
  }
  try {
    const label = t(key);
    return isUnresolvedDenaliTranslation(key, label) ? null : label;
  } catch {
    return null;
  }
}

/** Localize enum/select tokens for flat primitive fields (transport mode, payment mode, etc.). */
export function resolveDenaliEnumOptionLabel(
  t: DenaliTranslator,
  canonicalPath: string,
  value: string
): string {
  const slug = value.trim();
  if (slug.length === 0) {
    return value;
  }

  // Prefer keys that exist in packages/workspaces/denali/messages/*/wizard.json.
  // `enumOptions.*` is optional/legacy — probe last (and only via has()) to avoid MISSING_MESSAGE spam.
  const candidates: readonly string[] = [
    canonicalPath === "transport.mode" || canonicalPath.endsWith(".mode")
      ? `transportModes.${slug}`
      : null,
    canonicalPath === "pricing.paymentMode" ? `paymentModes.${slug}` : null,
    canonicalPath === "publishStatus" || canonicalPath.endsWith(".publishStatus")
      ? `review.publishStatus.${slug}`
      : null,
    canonicalPath === "tour.duration"
      ? `composites.tourKind.durations.${slug}`
      : null,
    canonicalPath === "tour.categoryGroup"
      ? `composites.tourKind.categories.${slug}`
      : null,
    `tourKinds.${slug}`,
    `enumOptions.${canonicalPath}.${slug}`,
  ].filter((entry): entry is string => entry != null);

  for (const key of candidates) {
    const label = readEnumOptionLabel(t, key, slug);
    if (label != null) {
      return label;
    }
  }

  return slug.replace(/_/g, " ");
}

export function resolveDenaliStepLabel(t: DenaliTranslator, stepId: string): string {
  try {
    const label = t(`steps.${stepId}`);
    if (label !== `steps.${stepId}` && label.length > 0) {
      return label;
    }
  } catch {
    // Missing message keys fall back to formatted step id.
  }
  return resolveDenaliStepLabelFallback(stepId);
}

export function resolveDenaliTransportModeLabel(t: DenaliTranslator, mode: string): string {
  try {
    const label = t(`transportModes.${mode}`);
    if (label !== `transportModes.${mode}` && label.length > 0) {
      return label;
    }
  } catch {
    // Missing message keys fall back to slug.
  }
  return mode.replace(/_/g, " ");
}

const DENALI_FITNESS_LEVEL_MESSAGE_KEYS = {
  low: "composites.pricingParticipants.fitnessLow",
  medium: "composites.pricingParticipants.fitnessMedium",
  high: "composites.pricingParticipants.fitnessHigh",
} as const;

export function resolveDenaliFitnessLevelLabel(t: DenaliTranslator, level: string): string {
  const key =
    DENALI_FITNESS_LEVEL_MESSAGE_KEYS[level as keyof typeof DENALI_FITNESS_LEVEL_MESSAGE_KEYS];
  if (key == null) {
    return level;
  }
  try {
    const label = t(key);
    if (label !== key && label.length > 0) {
      return label;
    }
  } catch {
    // Missing message keys fall back to stored enum.
  }
  return level;
}

export function resolveDenaliTourKindLabel(t: DenaliTranslator, tourKind: string): string {
  try {
    const label = t(`tourKinds.${tourKind}`);
    if (label !== `tourKinds.${tourKind}` && label.length > 0) {
      return label;
    }
  } catch {
    // Missing message keys fall back to slug.
  }
  return tourKind.replace(/_/g, " ");
}

export function resolveDenaliPublishStatusLabel(t: DenaliTranslator, status: string): string {
  try {
    const label = t(`review.publishStatus.${status}`);
    if (label !== `review.publishStatus.${status}` && label.length > 0) {
      return label;
    }
  } catch {
    // Missing message keys fall back to slug.
  }
  return status;
}

export function resolveDenaliFieldKindLabel(t: DenaliTranslator, kind: string): string {
  try {
    const label = t(`fieldKinds.${kind}`);
    if (label !== `fieldKinds.${kind}` && label.length > 0) {
      return label;
    }
  } catch {
    // Missing message keys fall back to raw kind.
  }
  return kind;
}

export function resolveDenaliTourCategoryGroupLabel(
  t: DenaliTranslator,
  category: string
): string {
  try {
    const label = t(`composites.tourKind.categories.${category}`);
    if (label !== `composites.tourKind.categories.${category}` && label.length > 0) {
      return label;
    }
  } catch {
    // Missing message keys fall back to slug.
  }
  return category.replace(/_/g, " ");
}

export function resolveDenaliTourDurationLabel(
  t: DenaliTranslator,
  duration: "single_day" | "multi_day"
): string {
  try {
    const label = t(`composites.tourKind.durations.${duration}`);
    if (label !== `composites.tourKind.durations.${duration}` && label.length > 0) {
      return label;
    }
  } catch {
    // Missing message keys fall back to slug.
  }
  return duration.replace(/_/g, " ");
}
