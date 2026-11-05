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

  it("accepts persisted four-digit state and legacy six-digit challenge metadata", () => {
    const { otpLength: _length, ...persisted } = createCatalogRegistrationFlowInitialData();
    assert.doesNotThrow(() => assertCatalogRegistrationFlowState(persisted));
    assert.doesNotThrow(() => assertCatalogRegistrationFlowState({ ...persisted, otpLength: 6 }));
    assert.throws(
      () => assertCatalogRegistrationFlowState({ ...persisted, otpLength: 5 }),
      /otpLength must be 4 or 6/
    );
  });

  it("accepts the mixed participant outcome for a multi-person registration", () => {
    const data = createCatalogRegistrationFlowInitialData();
    assertCatalogRegistrationFlowState({ ...data, submissionOutcome: "partial" });
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
