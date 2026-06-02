import type { WorkspaceFieldKind } from "@app-tour/workspace-sdk";
import {
  assertStablePlainPrototype,
  readOwnDataProperty,
} from "@app-tour/workspace-sdk";

import { PlatformCoreError } from "../errors/platform-core.error";

const FORBIDDEN_OBJECT_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_COMPOSITE_DEPTH = 16;
const MAX_COMPOSITE_KEYS = 500;
const MAX_COMPOSITE_STACK = MAX_COMPOSITE_DEPTH * MAX_COMPOSITE_KEYS;
const MAX_ENUM_OPTIONS = 500;
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

function compositeFail(canonicalPath: string, message: string): never {
  throw new PlatformCoreError(
    "CANONICAL_TYPE_MISMATCH",
    message,
    { canonicalPath, kind: "composite" },
  );
}

function assertCompositeLeaf(
  leaf: unknown,
  path: string,
  canonicalPath: string,
): void {
  if (leaf == null) {
    return;
  }
  if (typeof leaf === "string" || typeof leaf === "boolean") {
    return;
  }
  if (typeof leaf === "number") {
    if (!Number.isFinite(leaf)) {
      throw typeMismatch(path, "composite", "non-finite number in nested value");
    }
    return;
  }
  if (typeof leaf === "bigint") {
    throw typeMismatch(path, "composite", "BigInt in nested value");
  }
  if (typeof leaf === "symbol") {
    compositeFail(canonicalPath, `Symbol primitive is not allowed at ${path}`);
  }
  compositeFail(canonicalPath, `Unsupported nested value at ${path}`);
}

function assertCompositeNodeObject(
  node: object,
  path: string,
  canonicalPath: string,
): void {
  const fail = (message: string): never => compositeFail(canonicalPath, message);
  assertStablePlainPrototype(node, path, fail);

  if (Object.getOwnPropertySymbols(node).length > 0) {
    compositeFail(canonicalPath, `Symbol keys are not allowed at ${path}`);
  }

  const enumerableKeys = Object.keys(node);
  const ownNames = Object.getOwnPropertyNames(node);
  if (ownNames.length !== enumerableKeys.length) {
    compositeFail(canonicalPath, `Hidden non-enumerable keys are not allowed at ${path}`);
  }

  if (enumerableKeys.length > MAX_COMPOSITE_KEYS) {
    compositeFail(canonicalPath, `Too many keys at ${path}`);
  }
}

/**
 * Flat iterative composite walk — no recursive call frames on hot path.
 */
function assertCompositeIterative(value: unknown, canonicalPath: string): void {
  const compositeNodeStack: unknown[] = [value];
  const compositeDepthStack: number[] = [0];

  while (compositeNodeStack.length > 0) {
    const node = compositeNodeStack.pop()!;
    const depth = compositeDepthStack.pop()!;

    if (depth > MAX_COMPOSITE_DEPTH) {
      compositeFail(
        canonicalPath,
        `composite at "${canonicalPath}" exceeds max nested depth (${MAX_COMPOSITE_DEPTH})`,
      );
    }

    if (node == null || typeof node !== "object" || Array.isArray(node)) {
      compositeFail(canonicalPath, `composite at "${canonicalPath}" must be a plain object`);
    }

    assertCompositeNodeObject(node, canonicalPath, canonicalPath);
    const fail = (message: string): never => compositeFail(canonicalPath, message);
    const record = node as Record<string, unknown>;
    const keys = Object.keys(record);

    for (let index = keys.length - 1; index >= 0; index -= 1) {
      const key = keys[index]!;
      if (FORBIDDEN_OBJECT_KEYS.has(key)) {
        compositeFail(
          canonicalPath,
          `composite at "${canonicalPath}" contains forbidden key "${key}"`,
        );
      }

      const childPath = `${canonicalPath}.${key}`;
      const child = readOwnDataProperty(record, key, childPath, fail);

      if (child == null) {
        continue;
      }

      if (typeof child === "object" && !Array.isArray(child)) {
        if (compositeNodeStack.length >= MAX_COMPOSITE_STACK) {
          compositeFail(canonicalPath, `composite at "${canonicalPath}" exceeds walk stack limit`);
        }
        compositeNodeStack.push(child);
        compositeDepthStack.push(depth + 1);
      } else {
        assertCompositeLeaf(child, childPath, canonicalPath);
      }
    }
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
      if (Object.keys(value as object).length === 0) {
        throw emptyRequired(canonicalPath, kind);
      }
      assertCompositeIterative(value, canonicalPath);
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

  if (kind === "composite" && typeof value === "object" && value != null && !Array.isArray(value)) {
    return Object.keys(value as object).length === 0;
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
