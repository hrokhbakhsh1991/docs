import { randomUUID } from "node:crypto";
import type { AuditIntegrityMetadata } from "./audit-integrity-metadata";
import type { AuditRetentionPolicy } from "./audit-retention-policy";

/**
 * **Export manifest** — declarative description of a bounded audit pull for SIEM / legal discovery.
 * **No file I/O** — produce JSON for callers to sign, upload, or attach to tickets.
 *
 * **Append-only source:** manifest references the append-only `tenant_audit_events` stream by name only.
 */
export type AuditExportManifest = {
  readonly manifestId: string;
  readonly tenantId: string;
  readonly createdAt: string;
  readonly window: { readonly from: string; readonly toExclusive: string };
  /** Uncapped estimate from caller (exporter still must page using `maxRowsPerExportManifest`). */
  readonly approxRowCount: number;
  readonly maxRowsPerExportManifest: number;
  readonly retentionPolicyId: string;
  readonly integrity: AuditIntegrityMetadata;
  readonly source: "tenant_audit_events_append_only";
};

export type BuildAuditExportManifestInput = {
  readonly tenantId: string;
  readonly window: { readonly from: string; readonly toExclusive: string };
  readonly approxRowCount: number;
  readonly retentionPolicy: AuditRetentionPolicy;
  readonly integrity: AuditIntegrityMetadata;
};

/**
 * Builds a versioned **export manifest** for an append-only audit slice. **Read-only** — does not query DB
 * or delete rows.
 *
 * @throws Error `AUDIT_EXPORT_MANIFEST_INVALID_WINDOW` when `from >= toExclusive` or unparsable instants.
 */
export function buildAuditExportManifest(input: BuildAuditExportManifestInput): AuditExportManifest {
  const fromMs = Date.parse(input.window.from);
  const toMs = Date.parse(input.window.toExclusive);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs) || fromMs >= toMs) {
    throw new Error("AUDIT_EXPORT_MANIFEST_INVALID_WINDOW");
  }

  if (input.retentionPolicy.tenantId.trim().toLowerCase() !== input.tenantId.trim().toLowerCase()) {
    throw new Error("AUDIT_EXPORT_MANIFEST_TENANT_POLICY_MISMATCH");
  }

  return {
    manifestId: randomUUID(),
    tenantId: input.tenantId.trim().toLowerCase(),
    createdAt: new Date().toISOString(),
    window: { ...input.window },
    approxRowCount: Math.max(0, Math.floor(input.approxRowCount)),
    maxRowsPerExportManifest: input.retentionPolicy.maxRowsPerExportManifest,
    retentionPolicyId: input.retentionPolicy.policyId,
    integrity: input.integrity,
    source: "tenant_audit_events_append_only"
  };
}
