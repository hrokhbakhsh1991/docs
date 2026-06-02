import { PlatformCoreError } from "../errors/platform-core.error";

export { assertCanonicalValueMatchesKind, isEmptyCanonicalValue } from "./canonical-value";

const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * Dot-path walker for canonical document data (phase 1 — no array segments).
 */
export function getCanonicalValue(
  data: Readonly<Record<string, unknown>>,
  path: string,
): unknown {
  if (!path) {
    return undefined;
  }

  const segments = path.split(".");
  let current: unknown = data;

  for (const segment of segments) {
    if (FORBIDDEN_SEGMENTS.has(segment)) {
      throw new PlatformCoreError(
        "UNKNOWN_CANONICAL_PATH",
        `Forbidden path segment "${segment}" in "${path}"`,
        { path, segment },
      );
    }
    if (current == null) {
      return undefined;
    }
    if (typeof current !== "object") {
      throw new PlatformCoreError(
        "CANONICAL_TYPE_MISMATCH",
        `Cannot traverse canonical path "${path}" through non-object value at segment "${segment}"`,
        { path, segment, actual: typeof current },
      );
    }
    if (Array.isArray(current)) {
      throw new PlatformCoreError(
        "CANONICAL_TYPE_MISMATCH",
        `Cannot traverse canonical path "${path}" through array at segment "${segment}"`,
        { path, segment },
      );
    }
    if (!Object.prototype.hasOwnProperty.call(current, segment)) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return current;
}
