import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMigrationConsistencyReport,
  computeUnappliedMigrations,
  isFieldExposureConsistencyGateFatalEnabled,
  REQUIRED_EXPOSURE_TABLES,
  REQUIRED_INTEGRATION_TABLES,
} from "./migration-consistency-check";

describe("migration-consistency-check", () => {
  it("buildMigrationConsistencyReport signals OK when schema and migrations align", () => {
    const report = buildMigrationConsistencyReport({
      missingTables: [],
      missingExposureTables: [],
      unappliedMigrations: [],
      expectedMigrationCount: 38,
      appliedMigrationCount: 38,
      tourPublishedPolicyDriftCount: 0,
    });
    assert.equal(report.ok, true);
    assert.equal(report.signal, "CONSISTENCY_OK");
    assert.equal(report.service, "@apps/api");
    assert.deepEqual(report.missingExposureTables, []);
  });

  it("buildMigrationConsistencyReport signals missing tables before migration drift", () => {
    const report = buildMigrationConsistencyReport({
      missingTables: ["integration_connections"],
      missingExposureTables: [],
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
      missingExposureTables: [],
      unappliedMigrations: ["20260626120000_integration_platform"],
      expectedMigrationCount: 38,
      appliedMigrationCount: 37,
    });
    assert.equal(report.ok, false);
    assert.equal(report.signal, "CONSISTENCY_MIGRATION_DRIFT");
  });

  it("warn-only when exposure tables missing and fatal gate is disabled (9.1a)", () => {
    const report = buildMigrationConsistencyReport({
      missingTables: [],
      missingExposureTables: ["exposure_intents"],
      unappliedMigrations: [],
      expectedMigrationCount: 38,
      appliedMigrationCount: 38,
      exposureTablesGateFatal: false,
    });
    assert.equal(report.ok, true);
    assert.equal(report.signal, "CONSISTENCY_OK");
    assert.deepEqual(report.missingExposureTables, ["exposure_intents"]);
  });

  it("blocks when exposure tables missing and fatal gate is enabled (9.1b)", () => {
    const report = buildMigrationConsistencyReport({
      missingTables: [],
      missingExposureTables: ["exposure_profiles"],
      unappliedMigrations: [],
      expectedMigrationCount: 38,
      appliedMigrationCount: 38,
      exposureTablesGateFatal: true,
    });
    assert.equal(report.ok, false);
    assert.equal(report.signal, "CONSISTENCY_MISSING_TABLES");
  });

  it("blocks when tour published policy drift and rollout fatal gate is enabled", () => {
    const report = buildMigrationConsistencyReport({
      missingTables: [],
      missingExposureTables: [],
      unappliedMigrations: [],
      expectedMigrationCount: 38,
      appliedMigrationCount: 38,
      tourPublishedPolicyDriftCount: 2,
      tourPublishedRolloutGateFatal: true,
    });
    assert.equal(report.ok, false);
    assert.equal(report.signal, "CONSISTENCY_TOUR_PUBLISHED_POLICY_DRIFT");
    assert.equal(report.tourPublishedPolicyDriftCount, 2);
  });

  it("warn-only when tour published policy drift and fatal gate is disabled", () => {
    const report = buildMigrationConsistencyReport({
      missingTables: [],
      missingExposureTables: [],
      unappliedMigrations: [],
      expectedMigrationCount: 38,
      appliedMigrationCount: 38,
      tourPublishedPolicyDriftCount: 1,
      tourPublishedRolloutGateFatal: false,
    });
    assert.equal(report.ok, true);
    assert.equal(report.signal, "CONSISTENCY_OK");
    assert.equal(report.tourPublishedPolicyDriftCount, 1);
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

  it("REQUIRED_EXPOSURE_TABLES includes native intent and reminder ledger", () => {
    assert.ok(REQUIRED_EXPOSURE_TABLES.includes("exposure_intents"));
    assert.ok(REQUIRED_EXPOSURE_TABLES.includes("exposure_profiles"));
    assert.ok(REQUIRED_EXPOSURE_TABLES.includes("denali_exposure_reminder_activations"));
  });

  it("isFieldExposureConsistencyGateFatalEnabled is false by default", () => {
    const previous = process.env.FIELD_EXPOSURE_CONSISTENCY_GATE_FATAL;
    delete process.env.FIELD_EXPOSURE_CONSISTENCY_GATE_FATAL;
    assert.equal(isFieldExposureConsistencyGateFatalEnabled(), false);
    process.env.FIELD_EXPOSURE_CONSISTENCY_GATE_FATAL = "true";
    assert.equal(isFieldExposureConsistencyGateFatalEnabled(), true);
    if (previous === undefined) {
      delete process.env.FIELD_EXPOSURE_CONSISTENCY_GATE_FATAL;
    } else {
      process.env.FIELD_EXPOSURE_CONSISTENCY_GATE_FATAL = previous;
    }
  });
});
