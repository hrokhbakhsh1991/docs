/**
 * Env-var feature flags for the draft-engine module (rollout / rollback).
 * Mirrors `apps/api/src/modules/tours/tours-feature-flags.ts`.
 */

function envFlagEnabled(raw: string | undefined, defaultWhenUnset: boolean): boolean {
  if (raw === undefined || raw.trim() === "") {
    return defaultWhenUnset;
  }
  const v = raw.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

/**
 * When true (default), Facade uses migrator + storage port (MAP: `DRAFT_ENGINE_V2_ENABLED`).
 * When false, Facade reads/writes Postgres only (no read-time migration).
 */
export function isDraftEngineV2Enabled(): boolean {
  const explicitV2 = process.env.DRAFT_ENGINE_V2_ENABLED;
  if (explicitV2 !== undefined && explicitV2.trim() !== "") {
    return envFlagEnabled(explicitV2, true);
  }
  return envFlagEnabled(process.env.DRAFT_ENGINE_FACADE_ENABLED, true);
}

/** @alias {@link isDraftEngineV2Enabled} */
export function isDraftEngineFacadeEnabled(): boolean {
  return isDraftEngineV2Enabled();
}

/**
 * When true, GET-time schema migration is persisted via {@link DraftStoragePort.upgradeSchemaInPlace}
 * without bumping OCC version.
 */
export function shouldPersistDraftSchemaMigrationOnRead(): boolean {
  return envFlagEnabled(process.env.DRAFT_ENGINE_PERSIST_SCHEMA_MIGRATION_ON_READ, false);
}
