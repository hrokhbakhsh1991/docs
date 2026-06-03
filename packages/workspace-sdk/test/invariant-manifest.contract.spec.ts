import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FOUNDATION_INVARIANTS } from "./lib/foundation-invariants.js";

import "./invariants/canonical-ingress.contract.js";
import "./invariants/storage-immutability.contract.js";
import "./invariants/theme-ingress.contract.js";
import "./invariants/auth-sealing.contract.js";
import "./invariants/plugin-binding.contract.js";

describe("foundation invariant manifest (H-03 / H-13)", () => {
  it("declares exactly five critical behavioral invariants", () => {
    assert.equal(FOUNDATION_INVARIANTS.length, 5);
    assert.deepEqual(
      FOUNDATION_INVARIANTS.map((invariant) => invariant.id),
      [
        "canonical-ingress",
        "storage-immutability",
        "theme-ingress",
        "auth-sealing",
        "plugin-binding",
      ],
    );
  });
});
