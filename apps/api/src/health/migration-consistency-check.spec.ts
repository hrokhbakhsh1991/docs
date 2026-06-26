import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMigrationConsistencyReport,
  computeUnappliedMigrations,
  REQUIRED_INTEGRATION_TABLES,
} from "./migration-consistency-check";

describe("migration-consistency-check", () => {
  it("buildMigrationConsistencyReport signals OK when schema and migrations align", () => {
    const report = buildMigrationConsistencyReport({
      missingTables: [],
      unappliedMigrations: [],
      expectedMigrationCount: 38,
      appliedMigrationCount: 38,
    });
    assert.equal(report.ok, true);
    assert.equal(report.signal, "CONSISTENCY_OK");
    assert.equal(report.service, "@apps/api");
  });

  it("buildMigrationConsistencyReport signals missing tables before migration drift", () => {
    const report = buildMigrationConsistencyReport({
      missingTables: ["integration_connections"],
      unappliedMigrations: ["20260626120000_integration_platform"],
      expectedMigrationCount: 38,
      appliedMigrationCount: 34,
    });
    assert.equal(report.ok, false);
    assert.equal(report.signal, "CONSISTENCY_MISSING_TABLES");
    assert.deepEqual(report.missingTables, ["integration_connections"]);
  });

  it("buildMigrationConsistencyReport signals migration drift when tables exist", () => {
    const report = buildMigrationConsistencyReport({
      missingTables: [],
      unappliedMigrations: ["20260626120000_integration_platform"],
      expectedMigrationCount: 38,
      appliedMigrationCount: 37,
    });
    assert.equal(report.ok, false);
    assert.equal(report.signal, "CONSISTENCY_MIGRATION_DRIFT");
  });

  it("computeUnappliedMigrations lists disk migrations absent from DB", () => {
    const applied = new Set(["20260604114237_phase4_schema"]);
    const unapplied = computeUnappliedMigrations(
      ["20260604114237_phase4_schema", "20260626120000_integration_platform"],
      applied
    );
    assert.deepEqual(unapplied, ["20260626120000_integration_platform"]);
  });

  it("REQUIRED_INTEGRATION_TABLES includes legacy and control-plane tables", () => {
    assert.ok(REQUIRED_INTEGRATION_TABLES.includes("workspace_telegram_bots"));
    assert.ok(REQUIRED_INTEGRATION_TABLES.includes("integration_connections"));
    assert.ok(REQUIRED_INTEGRATION_TABLES.includes("integration_delivery_jobs"));
    assert.ok(REQUIRED_INTEGRATION_TABLES.includes("integration_event_policies"));
    assert.ok(REQUIRED_INTEGRATION_TABLES.includes("integration_secrets"));
  });
});
