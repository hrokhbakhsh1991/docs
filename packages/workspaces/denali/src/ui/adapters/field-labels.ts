import { formatCanonicalPathToLabel } from "./format-canonical-path-label";

export type DenaliTranslator = ((
  key: string,
  values?: Record<string, string | number | Date>
) => string) & {
  readonly has?: (key: string) => boolean;
};

function canonicalPathToFieldMessageKey(canonicalPath: string): string {
  return `fields.${canonicalPath}`;
}

function resolveDenaliStepLabelFallback(stepId: string): string {
  return stepId
    .replace(/^denali_/, "")
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveDenaliFieldLabel(t: DenaliTranslator, canonicalPath: string): string {
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
