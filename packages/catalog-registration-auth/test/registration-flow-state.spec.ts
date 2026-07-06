import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  CATALOG_REGISTRATION_FLOW_STATE_KEYS,
  assertCatalogRegistrationFlowState,
  createCatalogRegistrationFlowInitialData,
  createCatalogRegistrationFlowRuntimeState,
} from "../src/registration-flow-state.ts";

describe("catalog registration flow state (canonical-v1)", () => {
  it("initial data exposes the full canonical key set", () => {
    const data = createCatalogRegistrationFlowInitialData();
    assert.deepEqual(Object.keys(data).sort(), [...CATALOG_REGISTRATION_FLOW_STATE_KEYS].sort());
    assertCatalogRegistrationFlowState(data);
  });

  it("runtime state starts at phone with canonical data", () => {
    const state = createCatalogRegistrationFlowRuntimeState({ initialStep: "phone" });
    assert.equal(state.currentStep, "phone");
    assertCatalogRegistrationFlowState(state.data);
  });

  it("rejects drifted bags (schema snapshot)", () => {
    const data = createCatalogRegistrationFlowInitialData();
    const snapshot = JSON.stringify(data);
    assert.match(snapshot, /"displayName":""/);
    assert.match(snapshot, /"onboardingToken":""/);
    assert.match(snapshot, /"transportState":\{/);
    assert.throws(() => assertCatalogRegistrationFlowState({ phone: "x" }), /missing key/);
    assert.throws(
      () => assertCatalogRegistrationFlowState({ ...data, fullName: "x" }),
      /unexpected key "fullName"/
    );
  });
});
