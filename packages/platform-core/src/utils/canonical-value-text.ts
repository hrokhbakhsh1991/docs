import type { WorkspaceFieldKind } from "@app-tour/workspace-sdk/plugin-types";

import { PlatformCoreError } from "../errors/platform-core.error";

const MAX_ENUM_OPTIONS = 500;
const MIN_DATE_YEAR = 1970;
const MAX_DATE_YEAR = 2100;

/** ISO-8601 calendar date or date-time (Z or numeric offset). */
const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

export type CanonicalValueValidationOptions = {
  readonly enumOptions?: readonly string[];
};

export function typeMismatch(
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

export function emptyRequired(
  canonicalPath: string,
  kind: WorkspaceFieldKind,
): PlatformCoreError {
  return new PlatformCoreError(
    "REQUIRED_FIELD_EMPTY",
    `Required ${kind} at "${canonicalPath}" is empty`,
    { canonicalPath, kind },
  );
}

export function assertValidCanonicalDate(value: string, canonicalPath: string): void {
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

export function assertValidEnumToken(
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

  if (enumOptions.length > MAX_ENUM_OPTIONS) {
    throw new PlatformCoreError(
      "CARDINALITY_VIOLATION",
      `enum field at "${canonicalPath}" exceeds maximum enumOptions count (${MAX_ENUM_OPTIONS})`,
      { canonicalPath, enumOptionCount: enumOptions.length },
    );
  }

  const normalizedValue = trimmed.normalize("NFC");
  let matched = false;
  for (const option of enumOptions) {
    if (option.normalize("NFC") === normalizedValue) {
      matched = true;
      break;
    }
  }
  if (!matched) {
    throw typeMismatch(canonicalPath, "enum", `unknown enum label "${trimmed}"`);
  }
}

export function assertScalarCanonicalValue(
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
    default:
      return;
  }
}
