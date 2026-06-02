import type { WorkspaceFieldKind } from "@app-tour/workspace-sdk";

import { PlatformCoreError } from "../errors/platform-core.error";

const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_COMPOSITE_DEPTH = 16;
const MIN_DATE_YEAR = 1970;
const MAX_DATE_YEAR = 2100;

/** ISO-8601 calendar date or date-time (Z or numeric offset). */
const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

export type CanonicalValueValidationOptions = {
  readonly enumOptions?: readonly string[];
};

function typeMismatch(
  canonicalPath: string,
  kind: WorkspaceFieldKind,
  actual: string,
): PlatformCoreError {
  return new PlatformCoreError(
    "CANONICAL_TYPE_MISMATCH",
    `Canonical path "${canonicalPath}" expects kind "${kind}" but got ${actual}`,
    { canonicalPath, kind, actual },
  );
}

function emptyRequired(
  canonicalPath: string,
  kind: WorkspaceFieldKind,
): PlatformCoreError {
  return new PlatformCoreError(
    "REQUIRED_FIELD_EMPTY",
    `Required ${kind} at "${canonicalPath}" is empty`,
    { canonicalPath, kind },
  );
}

function assertValidCanonicalDate(value: string, canonicalPath: string): void {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed !== value) {
    throw typeMismatch(canonicalPath, "date", typeof value);
  }
  if (!ISO_DATE_TIME_PATTERN.test(trimmed)) {
    throw typeMismatch(canonicalPath, "date", "invalid ISO date string");
  }

  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) {
    throw typeMismatch(canonicalPath, "date", "unparseable date");
  }

  const year = Number.parseInt(trimmed.slice(0, 4), 10);
  if (!Number.isFinite(year) || year < MIN_DATE_YEAR || year > MAX_DATE_YEAR) {
    throw typeMismatch(canonicalPath, "date", "date year out of supported range");
  }

  const parsed = new Date(ms);
  if (!Number.isFinite(parsed.getTime())) {
    throw typeMismatch(canonicalPath, "date", "invalid timestamp");
  }
}

function assertValidEnumToken(
  value: string,
  canonicalPath: string,
  enumOptions?: readonly string[],
): void {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed !== value) {
    throw emptyRequired(canonicalPath, "enum");
  }

  if (enumOptions == null || enumOptions.length === 0) {
    throw typeMismatch(
      canonicalPath,
      "enum",
      "enum field requires enumOptions in field registry",
    );
  }

  if (!enumOptions.includes(trimmed)) {
    throw typeMismatch(canonicalPath, "enum", `unknown enum label "${trimmed}"`);
  }
}

function assertCompositeNestedValue(
  value: unknown,
  canonicalPath: string,
  depth: number,
): void {
  if (depth > MAX_COMPOSITE_DEPTH) {
    throw new PlatformCoreError(
      "CANONICAL_TYPE_MISMATCH",
      `composite at "${canonicalPath}" exceeds max nested depth (${MAX_COMPOSITE_DEPTH})`,
      { canonicalPath, kind: "composite" },
    );
  }

  if (value == null) {
    return;
  }

  if (Array.isArray(value)) {
    throw new PlatformCoreError(
      "CANONICAL_TYPE_MISMATCH",
      `composite at "${canonicalPath}" cannot contain arrays`,
      { canonicalPath, kind: "composite" },
    );
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw typeMismatch(canonicalPath, "composite", "non-finite number in nested value");
    }
    return;
  }

  if (typeof value === "bigint") {
    throw typeMismatch(canonicalPath, "composite", "BigInt in nested value");
  }

  if (typeof value !== "object") {
    throw typeMismatch(canonicalPath, "composite", typeof value);
  }

  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype) {
    throw new PlatformCoreError(
      "CANONICAL_TYPE_MISMATCH",
      `composite at "${canonicalPath}" nested value must be a plain object`,
      { canonicalPath, kind: "composite" },
    );
  }

  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (FORBIDDEN_OBJECT_KEYS.has(key)) {
      throw new PlatformCoreError(
        "CANONICAL_TYPE_MISMATCH",
        `composite at "${canonicalPath}" contains forbidden key "${key}"`,
        { canonicalPath, kind: "composite", segment: key },
      );
    }
    assertCompositeNestedValue(record[key], `${canonicalPath}.${key}`, depth + 1);
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
      if (typeof value !== "string") {
        throw typeMismatch(canonicalPath, kind, typeof value);
      }
      if (value.trim() === "") {
        throw emptyRequired(canonicalPath, kind);
      }
      return;
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw typeMismatch(canonicalPath, kind, typeof value);
      }
      return;
    case "boolean":
      if (typeof value !== "boolean") {
        throw typeMismatch(canonicalPath, kind, typeof value);
      }
      return;
    case "date":
      if (typeof value !== "string") {
        throw typeMismatch(canonicalPath, kind, typeof value);
      }
      assertValidCanonicalDate(value, canonicalPath);
      return;
    case "enum":
      if (typeof value !== "string") {
        throw typeMismatch(canonicalPath, kind, typeof value);
      }
      assertValidEnumToken(value, canonicalPath, options?.enumOptions);
      return;
    case "composite": {
      if (value == null || typeof value !== "object" || Array.isArray(value)) {
        throw typeMismatch(canonicalPath, kind, typeof value);
      }
      const keys = Object.keys(value as object);
      if (keys.length === 0) {
        throw emptyRequired(canonicalPath, kind);
      }
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype) {
        throw new PlatformCoreError(
          "CANONICAL_TYPE_MISMATCH",
          `composite at "${canonicalPath}" must be a plain object`,
          { canonicalPath, kind },
        );
      }
      assertCompositeNestedValue(value, canonicalPath, 1);
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

  try {
    assertCanonicalValueMatchesKind(value, kind, "<path>", options);
    return false;
  } catch (error) {
    if (
      error instanceof PlatformCoreError &&
      error.code === "REQUIRED_FIELD_EMPTY"
    ) {
      return true;
    }
    if (
      error instanceof PlatformCoreError &&
      error.code === "CANONICAL_TYPE_MISMATCH"
    ) {
      return false;
    }
    throw error;
  }
}
