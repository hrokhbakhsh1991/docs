import type { CanonicalDocument } from "@app-tour/workspace-sdk";
import { migrateDenaliCanonical } from "@app-tour/workspace-denali";

/**
 * MAP §8.3 migrateCanonical — Phase 6 executes Denali ACL path on controlled batch jobs only.
 * Write paths (POST/PATCH) must not import this module (DEC-091 / guard-migrate-canonical-placeholder).
 */
export type MigrateCanonicalHook = (schemaVersion: number, data: unknown) => CanonicalDocument;

/** Unsupported workspace types until a plugin supplies migrateCanonical. */
export const migrateCanonicalNotImplemented: MigrateCanonicalHook = () => {
  throw new Error("MIGRATE_CANONICAL_NOT_IMPLEMENTED");
};

export function resolveMigrateCanonicalHook(workspaceType: string): MigrateCanonicalHook {
  if (workspaceType === "denali") {
    return migrateDenaliCanonical;
  }
  return migrateCanonicalNotImplemented;
}
