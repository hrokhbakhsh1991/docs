import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  exposureIntentScopeHash,
  normalizeExposureIntentScope,
} from "./exposure-intent.repository";
import { createExposureIntentRepository } from "./create-exposure-intent-repository";

describe("ExposureIntent repository helpers", () => {
  it("normalizes missing scope to an empty object", () => {
    assert.deepEqual(normalizeExposureIntentScope(undefined), {});
    assert.equal(exposureIntentScopeHash(undefined), "{}");
  });

  it("produces stable hashes independent of object key order", () => {
    const left = {
      connectionId: "conn-1",
      eventType: "TourCreated",
      nested: { z: "last", a: "first" },
    };
    const right = {
      nested: { a: "first", z: "last" },
      eventType: "TourCreated",
      connectionId: "conn-1",
    };

    assert.deepEqual(normalizeExposureIntentScope(left), normalizeExposureIntentScope(right));
    assert.equal(exposureIntentScopeHash(left), exposureIntentScopeHash(right));
  });

  it("constructs the exposure intent repository for the active storage driver", () => {
    assert.ok(createExposureIntentRepository());
  });
});
