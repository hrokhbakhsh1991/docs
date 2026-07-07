import type { WorkspaceFieldKind } from "@app-tour/workspace-sdk/plugin-types";

import type { PlatformCoreErrorCode } from "../errors/platform-core.error";
import { isEmptyCanonicalValue } from "../utils/canonical-value";

/**
 * Single contract table for hidden-field poison vs canonical kind validation.
 *
 * | Surface | Hidden + value | Kind check |
 * |---------|----------------|------------|
 * | Visible required empty path | UNKNOWN_CANONICAL_PATH | — |
 * | Visible value present | assertCanonicalValueMatchesKind | strict |
 * | Hidden non-composite + defined non-null value | HIDDEN_FIELD_POISON | — |
 * | Hidden composite + value | allowed at path (leaves validated when visible) | — |
 * | Visible composite + JSON array | assertCanonicalValueMatchesKind | accepted (Phase 11.10 Denali array ingress) |
 */
export const CANONICAL_FIELD_VALIDATION_CONTRACT = [
  {
    id: "hidden-non-composite-poison",
    violation: "HIDDEN_FIELD_POISON" as const,
    when: "effective.hidden && kind !== composite && value !== undefined && value !== null",
  },
  {
    id: "visible-kind-strict",
    violation: "CANONICAL_TYPE_MISMATCH" as const,
    when: "!hidden && value defined → assertCanonicalValueMatchesKind",
  },
] as const;

export type HiddenFieldPoisonInput = {
  readonly fieldId: string;
  readonly canonicalPath: string;
  readonly kind: WorkspaceFieldKind;
  readonly hidden: boolean;
  readonly value: unknown;
};

export function hiddenFieldPoisonViolation(
  input: HiddenFieldPoisonInput,
): { readonly code: "HIDDEN_FIELD_POISON"; readonly message: string } | null {
  if (!input.hidden || input.value === undefined || input.value === null) {
    return null;
  }
  if (input.kind === "composite") {
    return null;
  }
  return {
    code: "HIDDEN_FIELD_POISON",
    message: `Hidden field "${input.fieldId}" must not contain a value at "${input.canonicalPath}"`,
  };
}

/**
 * Non-empty value for kind — inverse of {@link isEmptyCanonicalValue} (undefined/null → false).
 * Wired from {@link validateFieldValue} in `validate-canonical-field.ts` for hidden composite leaves.
 * Unit table: `test/unit/contracts/hidden-field-kind-gate.spec.ts`.
 */
export function passesHiddenFieldKindGate(
  value: unknown,
  kind: WorkspaceFieldKind,
  enumOptions?: readonly string[],
): boolean {
  if (value === undefined || value === null) {
    return false;
  }
  return !isEmptyCanonicalValue(value, kind, { enumOptions });
}

export type KindValidationViolation = {
  readonly code: PlatformCoreErrorCode;
  readonly message: string;
};
