import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { denaliRuleSet, readDenaliItineraryMatrixState } from "../src/rules/denaliRuleModel";

describe("denali-itinerary-matrix.spec.ts", () => {
  it("DN-MATRIX-01 event multi_day exposes required itinerary", () => {
    const state = readDenaliItineraryMatrixState("event", "multi_day");
    assert.notEqual(state, null);
    assert.equal(state?.hidden, false);
    assert.equal(state?.required, true);
  });

  it("DN-MATRIX-02 event multi_day hides outdoor hiking program fields", () => {
    const model = denaliRuleSet.event.multi_day;
    assert.notEqual(model, null);
    const difficulty = model?.fields.find((field) => field.path === "program.difficultyLevel");
    assert.equal(difficulty?.hidden, true);
  });

  it("DN-MATRIX-03 event single_day hides itinerary (use shortDescription instead)", () => {
    const state = readDenaliItineraryMatrixState("event", "single_day");
    assert.notEqual(state, null);
    assert.equal(state?.hidden, true);
    assert.equal(state?.required, false);
  });

  it("DN-MATRIX-04 mountain single_day hides itinerary", () => {
    const state = readDenaliItineraryMatrixState("mountain", "single_day");
    assert.equal(state?.hidden, true);
    assert.equal(state?.required, false);
  });

  it("DN-MATRIX-05 mountain multi_day requires itinerary", () => {
    const state = readDenaliItineraryMatrixState("mountain", "multi_day");
    assert.equal(state?.hidden, false);
    assert.equal(state?.required, true);
  });
});
