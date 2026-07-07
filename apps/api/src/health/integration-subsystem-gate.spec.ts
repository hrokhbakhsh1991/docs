import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyMigrationConsistencyGate,
  forceIntegrationSubsystemReadyForTests,
  isIntegrationSubsystemReady,
  resetIntegrationSubsystemGateForTests,
} from "./integration-subsystem-gate";
import { buildMigrationConsistencyReport } from "./migration-consistency-check";

describe("integration-subsystem-gate", () => {
  it("arms subsystem when consistency report is OK", () => {
    resetIntegrationSubsystemGateForTests();
    applyMigrationConsistencyGate(
      buildMigrationConsistencyReport({
        missingTables: [],
        missingExposureTables: [],
        unappliedMigrations: [],
        expectedMigrationCount: 1,
        appliedMigrationCount: 1,
      })
    );
    assert.equal(isIntegrationSubsystemReady(), true);
  });

  it("blocks subsystem when integration tables are missing", () => {
    resetIntegrationSubsystemGateForTests();
    applyMigrationConsistencyGate(
      buildMigrationConsistencyReport({
        missingTables: ["integration_connections"],
        missingExposureTables: [],
        unappliedMigrations: [],
        expectedMigrationCount: 1,
        appliedMigrationCount: 1,
      })
    );
    assert.equal(isIntegrationSubsystemReady(), false);
  });

  it("blocks subsystem when exposure tables missing and fatal gate is enabled", () => {
    resetIntegrationSubsystemGateForTests();
    applyMigrationConsistencyGate(
      buildMigrationConsistencyReport({
        missingTables: [],
        missingExposureTables: ["exposure_intents"],
        unappliedMigrations: [],
        expectedMigrationCount: 1,
        appliedMigrationCount: 1,
        exposureTablesGateFatal: true,
      })
    );
    assert.equal(isIntegrationSubsystemReady(), false);
  });

  it("arms subsystem when exposure tables missing but fatal gate is disabled", () => {
    resetIntegrationSubsystemGateForTests();
    applyMigrationConsistencyGate(
      buildMigrationConsistencyReport({
        missingTables: [],
        missingExposureTables: ["exposure_intents"],
        unappliedMigrations: [],
        expectedMigrationCount: 1,
        appliedMigrationCount: 1,
        exposureTablesGateFatal: false,
      })
    );
    assert.equal(isIntegrationSubsystemReady(), true);
  });

  it("blocks subsystem when tour published policy drift and rollout fatal gate is enabled", () => {
    resetIntegrationSubsystemGateForTests();
    applyMigrationConsistencyGate(
      buildMigrationConsistencyReport({
        missingTables: [],
        missingExposureTables: [],
        unappliedMigrations: [],
        expectedMigrationCount: 1,
        appliedMigrationCount: 1,
        tourPublishedPolicyDriftCount: 1,
        tourPublishedRolloutGateFatal: true,
      }),
    );
    assert.equal(isIntegrationSubsystemReady(), false);
  });

  it("forceIntegrationSubsystemReadyForTests bypasses gate in unit tests", () => {
    resetIntegrationSubsystemGateForTests();
    forceIntegrationSubsystemReadyForTests();
    assert.equal(isIntegrationSubsystemReady(), true);
  });
});
