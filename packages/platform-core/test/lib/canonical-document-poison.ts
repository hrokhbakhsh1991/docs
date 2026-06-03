import type { CanonicalDocument } from "@app-tour/workspace-sdk/canonical";

/**
 * Test-only document envelope for runtime values canonical typing rejects (e.g. BigInt).
 * Callers pass plain objects; validation runs through the facade ingress path.
 */
export function documentWithRuntimePoison(payload: {
  schemaVersion: 1;
  roots: readonly string[];
  data: Record<string, unknown>;
}): CanonicalDocument {
  return payload as CanonicalDocument;
}
