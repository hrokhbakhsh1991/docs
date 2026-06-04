import type { CanonicalDocument } from "@app-tour/workspace-sdk";

/**
 * Phase 5 design hook for MAP §8.3 migrateCanonical — no legacy trip_details execution.
 * Full cutover is Phase 6 (DEL-P5-008).
 */
export type MigrateCanonicalHook = (
  schemaVersion: number,
  data: unknown,
) => CanonicalDocument;

/** Placeholder — callers must not invoke in Phase 5 write paths. */
export const migrateCanonicalNotImplemented: MigrateCanonicalHook = () => {
  throw new Error("MIGRATE_CANONICAL_NOT_IMPLEMENTED_PHASE_5");
};
