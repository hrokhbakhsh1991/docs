import { DENALI_COMPOSITE_LABEL_CANONICAL_PATH } from "./denali-composite-label-paths";
import { resolveDenaliStepLabelFallback } from "./field-labels";
import { formatCanonicalPathToLabel } from "./format-canonical-path-label";
import { getNestedStringValue } from "./nested-string";

export type DenaliWizardMessages = {
  readonly steps: Record<string, string>;
  readonly fields: Record<string, unknown>;
  readonly fieldKinds: Record<string, string>;
  readonly tourKinds: Record<string, string>;
  readonly transportModes: Record<string, string>;
};

/** Messages-object resolver — template catalog / offline message-bag parity. */
export function resolveDenaliFieldLabelFromMessages(
  messages: DenaliWizardMessages,
  canonicalPath: string
): string {
  if (canonicalPath.startsWith("denali.")) {
    const mapped = DENALI_COMPOSITE_LABEL_CANONICAL_PATH[canonicalPath];
    if (mapped !== undefined) {
      return resolveDenaliFieldLabelFromMessages(messages, mapped);
    }
  }
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
  return resolveDenaliStepLabelFallback(stepId);
}

export function resolveDenaliFieldKindLabelFromMessages(
  messages: DenaliWizardMessages,
  kind: string
): string {
  return messages.fieldKinds[kind] ?? kind;
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
