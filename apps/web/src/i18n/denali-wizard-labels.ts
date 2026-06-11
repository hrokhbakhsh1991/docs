import type { AppLocale } from "./routing";

export type DenaliWizardMessages = {
  readonly steps: Record<string, string>;
  readonly fields: Record<string, unknown>;
  readonly fieldKinds: Record<string, string>;
  readonly tourKinds: Record<string, string>;
  readonly transportModes: Record<string, string>;
};

type DenaliTranslator = (
  key: string,
  values?: Record<string, string | number | Date>
) => string;

export function canonicalPathToFieldMessageKey(canonicalPath: string): string {
  return `fields.${canonicalPath}`;
}

export function getNestedStringValue(
  root: Record<string, unknown> | undefined,
  path: string
): string | undefined {
  if (root === undefined) {
    return undefined;
  }
  const parts = path.split(".");
  let cursor: unknown = root;
  for (const part of parts) {
    if (cursor === null || typeof cursor !== "object" || Array.isArray(cursor)) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return typeof cursor === "string" ? cursor : undefined;
}

export function formatCanonicalPathToLabel(canonicalPath: string): string {
  const segment = canonicalPath.split(".").pop() ?? canonicalPath;
  return segment
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function resolveDenaliFieldLabelFromMessages(
  messages: DenaliWizardMessages,
  canonicalPath: string
): string {
  return (
    getNestedStringValue(messages.fields as Record<string, unknown>, canonicalPath) ??
    formatCanonicalPathToLabel(canonicalPath)
  );
}

export function resolveDenaliStepLabelFromMessages(
  messages: DenaliWizardMessages,
  stepId: string
): string {
  const label = messages.steps[stepId];
  if (label !== undefined) {
    return label;
  }
  return stepId
    .replace(/^denali_/, "")
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveDenaliFieldKindLabelFromMessages(
  messages: DenaliWizardMessages,
  kind: string
): string {
  return messages.fieldKinds[kind] ?? kind;
}

export function resolveDenaliFieldLabel(t: DenaliTranslator, canonicalPath: string): string {
  const key = canonicalPathToFieldMessageKey(canonicalPath);
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

export function resolveDenaliStepLabel(t: DenaliTranslator, stepId: string): string {
  try {
    const label = t(`steps.${stepId}`);
    if (label !== `steps.${stepId}` && label.length > 0) {
      return label;
    }
  } catch {
    // Missing message keys fall back to formatted step id.
  }
  return resolveDenaliStepLabelFromMessages({ steps: {}, fields: {}, fieldKinds: {}, tourKinds: {}, transportModes: {} }, stepId);
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

export function isDenaliWizardMessages(value: unknown): value is DenaliWizardMessages {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.steps === "object" &&
    record.steps !== null &&
    typeof record.fields === "object" &&
    record.fields !== null
  );
}

export function denaliMessagesFromAppMessages(
  messages: Record<string, unknown>,
  locale: AppLocale
): DenaliWizardMessages {
  const denali = messages.denali;
  if (isDenaliWizardMessages(denali)) {
    return denali;
  }
  throw new Error(`DENALI_MESSAGES_MISSING_${locale}`);
}
