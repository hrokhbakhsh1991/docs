import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  decodeJwtCapabilitySnapshot,
  encodeJwtCapabilitySnapshot,
} from "./jwt-capability-snapshot";

describe("jwt-capability-snapshot", () => {
  test("round-trips registered capabilities sorted", () => {
    const encoded = encodeJwtCapabilitySnapshot([
      "tour.read",
      "tour.update.core",
      "tour.read",
    ]);
    assert.equal(encoded, "tour.read,tour.update.core");
    assert.deepEqual(decodeJwtCapabilitySnapshot(encoded), ["tour.read", "tour.update.core"]);
  });

  test("normalizes product aliases", () => {
    const encoded = encodeJwtCapabilitySnapshot(["tour.form.architect"]);
    assert.equal(encoded, "tour.update.tripDetails");
  });
});
