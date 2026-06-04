import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");

describe("phase-5.contract (REQ-P5-024)", () => {
  it("DEL-P5-001 schema doc exists with DDL sections", () => {
    const doc = fs.readFileSync(
      path.join(REPO_ROOT, "docs/phase-5-canonical-schema.md"),
      "utf8",
    );
    assert.match(doc, /canonical_data/);
    assert.match(doc, /outbox_events/);
    assert.match(doc, /audit_events/);
    assert.match(doc, /withCanonicalTransaction/);
    assert.match(doc, /projection_derivation_map/);
  });

  it("infra/sql/002_phase5_data_layer.sql exists", () => {
    const sql = path.join(REPO_ROOT, "infra/sql/002_phase5_data_layer.sql");
    assert.ok(fs.existsSync(sql));
    const body = fs.readFileSync(sql, "utf8");
    assert.match(body, /outbox_events/);
    assert.match(body, /audit_events/);
    assert.match(body, /canonical_data/);
  });

  it("Prisma schema defines Tour canonical_data + OutboxEvent + AuditEvent", () => {
    const schema = fs.readFileSync(
      path.join(REPO_ROOT, "apps/api/prisma/schema.prisma"),
      "utf8",
    );
    assert.match(schema, /@map\("canonical_data"\)/);
    assert.match(schema, /model OutboxEvent/);
    assert.match(schema, /model AuditEvent/);
    assert.match(schema, /schema_version/);
  });

  it("withCanonicalTransaction exported from apps/api", async () => {
    const mod = await import("../src/db/with-canonical-transaction.ts");
    assert.equal(typeof mod.withCanonicalTransaction, "function");
  });
});
