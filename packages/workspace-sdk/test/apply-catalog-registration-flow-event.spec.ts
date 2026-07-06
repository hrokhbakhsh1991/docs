import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createCatalogRegistrationFlowRuntimeState } from "@app-tour/catalog-registration-auth";
import { applyCatalogRegistrationFlowEvent } from "@app-tour/workspace-sdk";

describe("applyCatalogRegistrationFlowEvent", () => {
  it("merges patch into data immutably", () => {
    const state = createCatalogRegistrationFlowRuntimeState({ initialStep: "auth.email" });
    const next = applyCatalogRegistrationFlowEvent(state, {
      type: "merge",
      patch: { intakeName: "Ada" },
    });
    assert.equal(next.currentStep, "auth.email");
    assert.equal(next.data.intakeName, "Ada");
    assert.notEqual(next.data, state.data);
  });

  it("transitions step without mutating data", () => {
    const state = createCatalogRegistrationFlowRuntimeState({ initialStep: "auth.email" });
    const next = applyCatalogRegistrationFlowEvent(state, {
      type: "transition",
      to: "intake.party",
    });
    assert.equal(next.currentStep, "intake.party");
    assert.equal(next.data, state.data);
  });
});
