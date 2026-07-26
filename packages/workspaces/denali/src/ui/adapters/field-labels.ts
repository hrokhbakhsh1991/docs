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
    if (typeof t.has === "function") {
      if (t.has(sectionKey)) {
        return t(sectionKey);
      }
    } else {
      try {
        const sectionLabel = t(sectionKey);
        if (sectionLabel !== sectionKey && sectionLabel.length > 0) {
          return sectionLabel;
        }
      } catch {
        // Fall through to fields.* / formatted path.
      }
    }
  }

  const key = canonicalPathToFieldMessageKey(canonicalPath);
  if (typeof t.has === "function") {
    if (t.has(key)) {
      return t(key);
    }
    return formatCanonicalPathToLabel(canonicalPath);
  }
  try {
    const label = t(key);
    if (label !== key && label.length > 0) {
      return label;
    }
  } catch {
    // Missing message keys fall back to formatted path.
  }
  return formatCanonicalPathToLabel(canonicalPath);
}

function readEnumOptionLabel(t: DenaliTranslator, key: string, _fallback: string): string | null {
  if (typeof t.has === "function") {
    return t.has(key) ? t(key) : null;
  }
  try {
    const label = t(key);
    return label !== key && label.length > 0 ? label : null;
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

  const candidates: readonly string[] = [
    `enumOptions.${canonicalPath}.${slug}`,
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
