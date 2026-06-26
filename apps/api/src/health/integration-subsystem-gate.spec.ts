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
        unappliedMigrations: [],
        expectedMigrationCount: 1,
        appliedMigrationCount: 1,
      })
    );
    assert.equal(isIntegrationSubsystemReady(), false);
  });

  it("forceIntegrationSubsystemReadyForTests bypasses gate in unit tests", () => {
    resetIntegrationSubsystemGateForTests();
    forceIntegrationSubsystemReadyForTests();
    assert.equal(isIntegrationSubsystemReady(), true);
  });
});
