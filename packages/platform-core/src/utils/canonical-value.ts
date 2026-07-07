import type { WorkspaceFieldKind } from "@app-tour/workspace-sdk/plugin-types";

import { PlatformCoreError } from "../errors/platform-core.error";
import {
  isPlatformCoreError,
  platformFail,
  platformOk,
  type PlatformResult,
} from "../errors/platform-result";
import { assertCompositeCanonicalValue } from "./canonical-value-composite";
import {
  assertScalarCanonicalValue,
  emptyRequired,
  type CanonicalValueValidationOptions,
  typeMismatch,
} from "./canonical-value-text";

export type { CanonicalValueValidationOptions } from "./canonical-value-text";

export function tryAssertCanonicalValueMatchesKind(
  value: unknown,
  kind: WorkspaceFieldKind,
  canonicalPath: string,
  options?: CanonicalValueValidationOptions,
): PlatformResult<void> {
  try {
    assertCanonicalValueMatchesKind(value, kind, canonicalPath, options);
    return platformOk(undefined);
  } catch (error: unknown) {
    if (isPlatformCoreError(error)) {
      return platformFail(error.code, error.message, error.details);
    }
    throw error;
  }
}

export function assertCanonicalValueMatchesKind(
  value: unknown,
  kind: WorkspaceFieldKind,
  canonicalPath: string,
  options?: CanonicalValueValidationOptions,
): void {
  switch (kind) {
    case "text":
    case "number":
    case "boolean":
    case "date":
    case "enum":
      assertScalarCanonicalValue(value, kind, canonicalPath, options);
      return;
    case "composite": {
      if (Array.isArray(value)) {
        return;
      }
      if (value == null || typeof value !== "object") {
        throw typeMismatch(canonicalPath, kind, typeof value);
      }
      if (Object.keys(value as object).length === 0) {
        throw emptyRequired(canonicalPath, kind);
      }
      assertCompositeCanonicalValue(value, canonicalPath);
      return;
    }
    default: {
      const _exhaustive: never = kind;
      throw new PlatformCoreError(
        "CANONICAL_TYPE_MISMATCH",
        `Unknown field kind ${String(_exhaustive)} at "${canonicalPath}"`,
        { canonicalPath },
      );
    }
  }
}

export function isEmptyCanonicalValue(
  value: unknown,
  kind: WorkspaceFieldKind,
  options?: CanonicalValueValidationOptions,
): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  if (kind === "text" && typeof value === "string" && value.trim() === "") {
    return true;
  }

  if (kind === "enum" && typeof value === "string" && value.trim() === "") {
    return true;
  }

  if (kind === "composite" && Array.isArray(value)) {
    return value.length === 0;
  }

  if (kind === "composite" && typeof value === "object" && value != null && !Array.isArray(value)) {
    return Object.keys(value as object).length === 0;
  }

  const checked = tryAssertCanonicalValueMatchesKind(value, kind, "<path>", options);
  if (checked.ok) {
    return false;
  }
  if (
    checked.error.code === "REQUIRED_FIELD_EMPTY" ||
    checked.error.code === "CANONICAL_TYPE_MISMATCH"
  ) {
    return checked.error.code === "REQUIRED_FIELD_EMPTY";
  }
  throw checked.error;
}
