/**
 * Cross-cutting **integrity** envelope for replication and **export manifests** (tamper-evidence design).
 * Callers attach this to `AuditExportManifest` rows; persistence of hashes is **not** implemented here.
 *
 * TODO: **Hash-chain integrity** — per-row `content_hash` chaining to `prev_hash` at append time.
 * TODO: **Signed exports** — CMS / JWS over manifest digest + wrapped content-encryption key.
 * TODO: **Legal hold workflows** — `holdCaseIds` driving export filters and retention freezes.
 */
export type AuditIntegrityMetadata = {
  readonly schemaVersion: string;
  /** Opaque monotonic / unique generation id for this export batch (UUID or ULID). */
  readonly exportGeneration: string;
  /** Future chain head digest (hex); unset until hash-chain lands. */
  readonly chainHeadPlaceholder?: string;
};
