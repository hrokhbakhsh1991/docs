/**
 * Owner-DB-1A — migration SQL shape validation (always-on).
 * Authority: docs/phase-9/appendices/owner-cardinality-db-hardening-1a.mdoc
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const migrationPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../prisma/migrations/20260820160000_user_tenants_one_active_owner/migration.sql"
);

describe("owner-cardinality-migration.spec.ts — OWN-DB-1A", () => {
  it("OWN-DB-MIG-01 migration defines partial unique index + multi-owner preflight", () => {
    const sql = fs.readFileSync(migrationPath, "utf8");
    assert.match(sql, /OWNER_CARDINALITY_AUDIT_FAILED/);
    assert.match(sql, /CREATE UNIQUE INDEX IF NOT EXISTS uq_user_tenants_one_active_owner/);
    assert.match(sql, /ON user_tenants \(tenant_id\)/);
    assert.match(sql, /WHERE role = 'owner'/);
    assert.match(sql, /AND status = 'ACTIVE'/);
    assert.doesNotMatch(sql, /CREATE TRIGGER/i);
    assert.doesNotMatch(sql, /CONCURRENTLY/);
  });

  it("OWN-DB-MIG-02 audit SQL and runner exist", () => {
    const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../scripts");
    assert.ok(fs.existsSync(path.join(scriptsDir, "audit-owner-cardinality.sql")));
    assert.ok(fs.existsSync(path.join(scriptsDir, "audit-owner-cardinality.ts")));
  });
});
