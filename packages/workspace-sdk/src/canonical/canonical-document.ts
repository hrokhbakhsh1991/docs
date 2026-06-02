/**
 * Generic persisted wizard document — platform source of truth.
 */
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

function fail(code: CanonicalDocumentValidationErrorCode, message: string): never {
  throw new CanonicalDocumentValidationError(code, message);
}

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
  if (depth > MAX_DEPTH) {
    fail("CANONICAL_INVALID_DATA", `Max depth exceeded at ${path}`);
  }

  if (value == null) {
    return;
  }

  if (Array.isArray(value)) {
    fail("CANONICAL_INVALID_DATA", `Arrays are not allowed at ${path}`);
  }

  if (typeof value === "string") {
    if (value.length > MAX_STRING_LENGTH) {
      fail("CANONICAL_INVALID_DATA", `String too long at ${path}`);
    }
    return;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail("CANONICAL_INVALID_DATA", `Non-finite number at ${path}`);
    }
    return;
  }

  if (typeof value === "boolean") {
    return;
  }

  if (typeof value === "bigint") {
    fail("CANONICAL_INVALID_DATA", `BigInt is not allowed at ${path}`);
  }

  if (typeof value === "symbol" || typeof value === "function") {
    fail("CANONICAL_INVALID_DATA", `Unsupported exotic value at ${path}`);
  }

  if (typeof value !== "object") {
    fail("CANONICAL_INVALID_DATA", `Unsupported value at ${path}`);
  }

  assertPlainObjectBounded(value, path, depth);
}

function assertPlainObjectBounded(
  value: unknown,
  path: string,
  depth: number,
): asserts value is Record<string, unknown> {
  if (depth > MAX_DEPTH) {
    fail("CANONICAL_INVALID_DATA", `Max depth exceeded at ${path}`);
  }
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    fail("CANONICAL_INVALID_DATA", `Expected object at ${path}`);
  }
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype) {
    fail("CANONICAL_INVALID_DATA", `Non-plain object at ${path}`);
  }
  const keys = Object.keys(value);
  if (keys.length > MAX_KEYS_PER_OBJECT) {
    fail("CANONICAL_INVALID_DATA", `Too many keys at ${path}`);
  }
  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length > 0) {
    fail("CANONICAL_INVALID_DATA", `Symbol keys are not allowed at ${path}`);
  }
  for (const key of keys) {
    if (FORBIDDEN_ROOT_KEYS.has(key)) {
      fail("CANONICAL_INVALID_DATA", `Forbidden key "${key}" at ${path}`);
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor?.get != null || descriptor?.set != null) {
      fail("CANONICAL_INVALID_DATA", `Accessor property "${key}" is not allowed at ${path}`);
    }
    assertCanonicalDataNode(
      (value as Record<string, unknown>)[key],
      `${path}.${key}`,
      depth + 1,
    );
  }
}

function deepCloneFreezePlainData(value: unknown, path: string, depth: number): unknown {
  if (depth > MAX_DEPTH) {
    fail("CANONICAL_INVALID_DATA", `Max depth exceeded at ${path}`);
  }

  if (value == null) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    fail("CANONICAL_INVALID_DATA", `Arrays are not allowed at ${path}`);
  }

  assertPlainObjectBounded(value, path, depth);

  const source = value as Record<string, unknown>;
  const clone: Record<string, unknown> = {};
  for (const key of Object.keys(source)) {
    clone[key] = deepCloneFreezePlainData(source[key], `${path}.${key}`, depth + 1);
  }
  return Object.freeze(clone);
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

  const dataProto = Object.getPrototypeOf(document.data);
  if (dataProto !== Object.prototype) {
    fail("CANONICAL_INVALID_DATA", "data must be a plain object");
  }

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
