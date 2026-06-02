import assert from "node:assert/strict";
import test from "node:test";
import { buildAuditExportManifest } from "./build-audit-export-manifest";

const policy = {
  policyId: "pol-1",
  tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  onlineRetentionDays: 90,
  nearlineRetentionDays: 365,
  maxRowsPerExportManifest: 50_000
};

const integrity = {
  schemaVersion: "2026.05.audit-manifest.v1",
  exportGeneration: "gen-001"
};

test("buildAuditExportManifest returns manifest with append-only source", () => {
  const m = buildAuditExportManifest({
    tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    window: { from: "2026-01-01T00:00:00.000Z", toExclusive: "2026-02-01T00:00:00.000Z" },
    approxRowCount: 12,
    retentionPolicy: policy,
    integrity
  });
  assert.equal(m.source, "tenant_audit_events_append_only");
  assert.equal(m.approxRowCount, 12);
  assert.equal(m.maxRowsPerExportManifest, 50_000);
  assert.equal(m.retentionPolicyId, "pol-1");
  assert.equal(m.integrity.exportGeneration, "gen-001");
  assert.match(m.manifestId, /^[0-9a-f-]{36}$/i);
});

test("buildAuditExportManifest throws on invalid window", () => {
  assert.throws(
    () =>
      buildAuditExportManifest({
        tenantId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        window: { from: "2026-02-01T00:00:00.000Z", toExclusive: "2026-01-01T00:00:00.000Z" },
        approxRowCount: 0,
        retentionPolicy: policy,
        integrity
      }),
    /AUDIT_EXPORT_MANIFEST_INVALID_WINDOW/
  );
});

test("buildAuditExportManifest throws when policy tenant mismatches", () => {
  assert.throws(
    () =>
      buildAuditExportManifest({
        tenantId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        window: { from: "2026-01-01T00:00:00.000Z", toExclusive: "2026-02-01T00:00:00.000Z" },
        approxRowCount: 0,
        retentionPolicy: policy,
        integrity
      }),
    /AUDIT_EXPORT_MANIFEST_TENANT_POLICY_MISMATCH/
  );
});
