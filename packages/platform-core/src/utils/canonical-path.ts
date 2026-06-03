import { readOwnDataProperty } from "@app-tour/workspace-sdk/canonical";

import { PlatformCoreError } from "../errors/platform-core.error";

export { assertCanonicalValueMatchesKind, isEmptyCanonicalValue } from "./canonical-value";

const FORBIDDEN_SEGMENTS = new Set(["__proto__", "prototype", "constructor"]);

function pathTraversalFail(message: string): never {
  if (message.includes("Accessor property") || message.includes("Non-data property")) {
    throw new PlatformCoreError("CANONICAL_TYPE_MISMATCH", message);
  }
  if (message.includes("Missing property descriptor")) {
    throw new PlatformCoreError("UNKNOWN_CANONICAL_PATH", message);
  }
  throw new PlatformCoreError("CANONICAL_TYPE_MISMATCH", message);
}

type SegmentTraversal = {
  readonly value: unknown;
  readonly traversalPrefix: string;
};

function readCanonicalSegmentAt(
  current: unknown,
  segment: string,
  traversalPrefix: string,
  path: string,
): SegmentTraversal {
  if (FORBIDDEN_SEGMENTS.has(segment)) {
    throw new PlatformCoreError(
      "UNKNOWN_CANONICAL_PATH",
      `Forbidden path segment "${segment}" in "${path}"`,
      { path, segment },
    );
  }
  if (current == null) {
    return { value: undefined, traversalPrefix };
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
    return { value: undefined, traversalPrefix };
  }

  const nextPrefix = `${traversalPrefix}.${segment}`;
  const value = readOwnDataProperty(
    current as object,
    segment,
    nextPrefix,
    pathTraversalFail,
  );
  return { value, traversalPrefix: nextPrefix };
}

/**
 * Dot-path walker for canonical document data (descriptor-safe, no getter invocation).
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
  let traversalPrefix = "data";

  for (const segment of segments) {
    const step = readCanonicalSegmentAt(current, segment, traversalPrefix, path);
    if (step.value === undefined && step.traversalPrefix === traversalPrefix) {
      return undefined;
    }
    current = step.value;
    traversalPrefix = step.traversalPrefix;
  }

  return current;
}
