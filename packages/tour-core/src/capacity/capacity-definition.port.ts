import { readFiniteCapacityNumber } from "./read-finite-capacity";

/** Workspace adapters supply path segments — tour-core does not encode Denali/Urban/Harbor paths. */
export type CanonicalCapacityPath = readonly string[];

/**
 * Neutral capacity definition port — read total capacity from opaque canonical `data`.
 * Path-based reads stay in workspace adapters; this port type documents the seam.
 */
export type CapacityDefinitionPort = {
  readonly readCapacity: (data: unknown) => number | null;
};

/** Read capacity from nested object path (DG-3.1). Product packages pass their path. */
export function readCapacityAtPath(data: unknown, path: CanonicalCapacityPath): number | null {
  if (path.length === 0) {
    return null;
  }
  let cursor: unknown = data;
  for (const segment of path) {
    if (cursor === null || typeof cursor !== "object" || Array.isArray(cursor)) {
      return null;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return readFiniteCapacityNumber(cursor);
}
