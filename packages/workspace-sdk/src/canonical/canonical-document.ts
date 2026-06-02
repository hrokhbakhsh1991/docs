/**
 * Generic persisted wizard document — platform source of truth.
 */
import {
  assertPlainObjectShield,
  assertStablePlainPrototype,
  clonePlainObjectShield,
  type PlainObjectShieldFail,
} from "./plain-object-shield";

export interface CanonicalDocument {
  readonly schemaVersion: number;
  readonly roots: readonly string[];
  readonly data: Readonly<Record<string, unknown>>;
}

export type CanonicalDocumentValidationErrorCode =
  | "CANONICAL_INVALID_SCHEMA_VERSION"
  | "CANONICAL_INVALID_ROOTS"
  | "CANONICAL_DUPLICATE_ROOT"
  | "CANONICAL_INVALID_DATA"
  | "CANONICAL_ROOT_UNKNOWN";

export class CanonicalDocumentValidationError extends Error {
  readonly code: CanonicalDocumentValidationErrorCode;

  constructor(code: CanonicalDocumentValidationErrorCode, message: string) {
    super(message);
    this.name = "CanonicalDocumentValidationError";
    this.code = code;
  }
}

const FORBIDDEN_ROOT_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const MAX_ROOTS = 64;
const MAX_DEPTH = 32;
const MAX_KEYS_PER_OBJECT = 500;
const MAX_PATH_SEGMENTS = 16;
const MAX_STRING_LENGTH = 64_000;

const DOCUMENT_SHIELD_OPTIONS = {
  maxDepth: MAX_DEPTH,
  maxKeysPerObject: MAX_KEYS_PER_OBJECT,
  onLeaf(value: unknown, path: string, _depth: number): void {
    if (typeof value === "string" && value.length > MAX_STRING_LENGTH) {
      fail("CANONICAL_INVALID_DATA", `String too long at ${path}`);
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      fail("CANONICAL_INVALID_DATA", `Non-finite number at ${path}`);
    }
  },
} as const;

function fail(code: CanonicalDocumentValidationErrorCode, message: string): never {
  throw new CanonicalDocumentValidationError(code, message);
}

const shieldFail: PlainObjectShieldFail = (message) => {
  fail("CANONICAL_INVALID_DATA", message);
};

function assertSafeRootName(root: string, index: number): void {
  if (FORBIDDEN_ROOT_KEYS.has(root)) {
    fail(
      "CANONICAL_INVALID_ROOTS",
      `Forbidden root key "${root}" at index ${index}`,
    );
  }
  if (!/^[a-z][a-z0-9_-]*$/i.test(root)) {
    fail(
      "CANONICAL_INVALID_ROOTS",
      `Invalid root key "${root}" at index ${index}`,
    );
  }
}

function assertCanonicalDataNode(value: unknown, path: string, depth: number): void {
  assertPlainObjectShield(value, path, depth, DOCUMENT_SHIELD_OPTIONS, shieldFail);
}

function deepCloneFreezePlainData(value: unknown, path: string, depth: number): unknown {
  return clonePlainObjectShield(value, path, depth, DOCUMENT_SHIELD_OPTIONS, shieldFail);
}

/**
 * Returns a deep-frozen plain-object clone of document data (post-assert sanitization).
 */
export function freezeCanonicalDocumentData(
  data: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  return deepCloneFreezePlainData(data, "data", 0) as Readonly<Record<string, unknown>>;
}

/**
 * Validates dot-path segment safety for registry canonical paths.
 */
export function assertCanonicalPathSegments(path: string): void {
  const segments = path.split(".");
  if (segments.length === 0 || segments.length > MAX_PATH_SEGMENTS) {
    fail("CANONICAL_INVALID_DATA", `Invalid canonical path "${path}"`);
  }
  for (const segment of segments) {
    if (FORBIDDEN_ROOT_KEYS.has(segment)) {
      fail(
        "CANONICAL_INVALID_DATA",
        `Forbidden path segment "${segment}" in "${path}"`,
      );
    }
    if (!/^[a-z][a-z0-9_-]*$/i.test(segment)) {
      fail(
        "CANONICAL_INVALID_DATA",
        `Invalid path segment "${segment}" in "${path}"`,
      );
    }
  }
}

/**
 * Full structural validation for canonical documents (roots, data shape, key policy).
 */
export function assertCanonicalDocument(document: CanonicalDocument): void {
  if (typeof document.schemaVersion !== "number" || !Number.isFinite(document.schemaVersion)) {
    fail("CANONICAL_INVALID_SCHEMA_VERSION", "schemaVersion must be a finite number");
  }

  if (!Array.isArray(document.roots) || document.roots.length === 0) {
    fail("CANONICAL_INVALID_ROOTS", "roots must be a non-empty array");
  }

  if (document.roots.length > MAX_ROOTS) {
    fail("CANONICAL_INVALID_ROOTS", `Too many roots (max ${MAX_ROOTS})`);
  }

  const seenRoots = new Set<string>();
  for (const [index, root] of document.roots.entries()) {
    if (typeof root !== "string" || root.length === 0) {
      fail("CANONICAL_INVALID_ROOTS", `roots[${index}] must be a non-empty string`);
    }
    assertSafeRootName(root, index);
    if (seenRoots.has(root)) {
      fail("CANONICAL_DUPLICATE_ROOT", `Duplicate root "${root}" in document.roots`);
    }
    seenRoots.add(root);
  }

  if (
    document.data == null ||
    typeof document.data !== "object" ||
    Array.isArray(document.data)
  ) {
    fail("CANONICAL_INVALID_DATA", "data must be a plain object");
  }

  assertStablePlainPrototype(document.data, "data", shieldFail);

  for (const key of Object.keys(document.data)) {
    if (!seenRoots.has(key)) {
      fail("CANONICAL_ROOT_UNKNOWN", `Key "${key}" is not listed in document.roots`);
    }
    assertCanonicalDataNode(document.data[key], key, 1);
  }

  for (const root of seenRoots) {
    if (!(root in document.data)) {
      fail("CANONICAL_ROOT_UNKNOWN", `Missing data for root "${root}"`);
    }
  }
}

export function assertCanonicalDocumentRoots(document: CanonicalDocument): void {
  assertCanonicalDocument(document);
}

export function createCanonicalDocument(input: {
  schemaVersion: number;
  roots: readonly string[];
  data: Record<string, unknown>;
}): CanonicalDocument {
  const document: CanonicalDocument = {
    schemaVersion: input.schemaVersion,
    roots: input.roots,
    data: input.data,
  };
  assertCanonicalDocument(document);
  return {
    schemaVersion: document.schemaVersion,
    roots: document.roots,
    data: freezeCanonicalDocumentData(document.data),
  };
}
