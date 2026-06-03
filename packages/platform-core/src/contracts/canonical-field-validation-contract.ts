import type { WorkspaceFieldKind } from "@app-tour/workspace-sdk/plugin-types";

import type { PlatformCoreErrorCode } from "../errors/platform-core.error";

/**
 * Single contract table for hidden-field poison vs canonical kind validation.
 *
 * | Surface | Hidden + value | Kind check |
 * |---------|----------------|------------|
 * | Visible required empty path | UNKNOWN_CANONICAL_PATH | — |
 * | Visible value present | assertCanonicalValueMatchesKind | strict |
 * | Hidden non-composite + any value | HIDDEN_FIELD_POISON | — |
 * | Hidden composite + value | allowed at path (leaves validated when visible) | — |
 */
export const CANONICAL_FIELD_VALIDATION_CONTRACT = [
  {
    id: "hidden-non-composite-poison",
    violation: "HIDDEN_FIELD_POISON" as const,
    when: "effective.hidden && kind !== composite && value !== undefined",
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
  if (!input.hidden || input.value === undefined) {
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

/** Lightweight kind gate (hidden-field fast path) — mirrors scalar emptiness in {@link isEmptyCanonicalValue}. */
export function passesHiddenFieldKindGate(
  value: unknown,
  kind: WorkspaceFieldKind,
  enumOptions?: readonly string[],
): boolean {
  switch (kind) {
    case "text":
      return typeof value === "string" && value.length > 0 && value.trim().length > 0;
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "boolean":
      return typeof value === "boolean";
    case "date":
      return typeof value === "string" && value.length >= 10;
    case "enum":
      if (typeof value !== "string" || value.length === 0 || value.trim() !== value) {
        return false;
      }
      return enumOptions != null && enumOptions.length > 0 && enumOptions.includes(value);
    case "composite":
      return (
        value != null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.keys(value as object).length > 0
      );
    default:
      return false;
  }
}

export type KindValidationViolation = {
  readonly code: PlatformCoreErrorCode;
  readonly message: string;
};
