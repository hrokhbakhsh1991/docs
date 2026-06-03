import type { WorkspaceFieldRegistryEntry } from "@app-tour/workspace-sdk/plugin-types";

import { isPlatformCoreError } from "../errors/platform-result";
import type { EffectiveFieldState } from "../types/effective-field-state";
import {
  hiddenFieldPoisonViolation,
  passesHiddenFieldKindGate,
} from "../contracts/canonical-field-validation-contract";
import { getCanonicalValue } from "../utils/canonical-path";
import {
  tryAssertCanonicalValueMatchesKind,
  isEmptyCanonicalValue,
} from "../utils/canonical-value";
import type { ViolationCollector } from "./validation-status-map";

export function validateFieldValue(
  field: WorkspaceFieldRegistryEntry,
  sanitizedData: Readonly<Record<string, unknown>>,
  effective: EffectiveFieldState,
  validationStatus: ViolationCollector,
): void {
  const hidden = effective.hidden;

  let value: unknown;
  try {
    value = getCanonicalValue(sanitizedData, field.canonicalPath);
  } catch (error: unknown) {
    if (isPlatformCoreError(error)) {
      validationStatus.record(error.code, field.id, error.message);
      return;
    }
    throw error;
  }

  const poison = hiddenFieldPoisonViolation({
    fieldId: field.id,
    canonicalPath: field.canonicalPath,
    kind: field.kind,
    hidden,
    value,
  });
  if (poison != null) {
    validationStatus.record(poison.code, field.id, poison.message);
    return;
  }

  if (
    hidden &&
    value !== undefined &&
    !passesHiddenFieldKindGate(value, field.kind, field.enumOptions)
  ) {
    return;
  }

  if (value === undefined) {
    if (effective.required && !hidden) {
      validationStatus.record(
        "UNKNOWN_CANONICAL_PATH",
        field.id,
        `No value at canonical path "${field.canonicalPath}"`,
      );
    }
    return;
  }

  if (
    !effective.required &&
    isEmptyCanonicalValue(value, field.kind, { enumOptions: field.enumOptions })
  ) {
    return;
  }

  const kindResult = tryAssertCanonicalValueMatchesKind(value, field.kind, field.canonicalPath, {
    enumOptions: field.enumOptions,
  });
  if (!kindResult.ok) {
    validationStatus.record(kindResult.error.code, field.id, kindResult.error.message);
  }
}
