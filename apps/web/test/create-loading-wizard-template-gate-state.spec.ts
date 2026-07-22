import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createLoadingWizardTemplateGateState,
  createUnpublishedWizardTemplateGateState,
} from "../src/tours/wizard-template-gate-logic";

describe("wizard template gate placeholders", () => {
  it("createLoadingWizardTemplateGateState returns a loading unpublished gate", () => {
    const gate = createLoadingWizardTemplateGateState("mountain_outdoor");
    assert.equal(gate.loading, true);
    assert.equal(gate.published, false);
    assert.equal(gate.workspaceFormProfile, "mountain_outdoor");
    assert.equal(gate.templateSteps.length, 0);
    assert.equal(gate.allowedCanonicalPaths.length, 0);
    assert.equal(gate.fieldOverlays.size, 0);
  });

  it("createUnpublishedWizardTemplateGateState clears loading only", () => {
    const gate = createUnpublishedWizardTemplateGateState("mountain_outdoor");
    assert.equal(gate.loading, false);
    assert.equal(gate.published, false);
    assert.equal(gate.workspaceFormProfile, "mountain_outdoor");
    assert.equal(gate.templateSteps.length, 0);
    assert.equal(gate.allowedCanonicalPaths.length, 0);
    assert.equal(gate.fieldOverlays.size, 0);
    assert.equal(gate.seedLabel, "");
  });
});
