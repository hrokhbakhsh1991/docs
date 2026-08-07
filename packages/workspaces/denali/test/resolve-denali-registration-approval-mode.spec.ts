import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDenaliRegistrationApprovalMode } from "../src/booking/resolve-denali-registration-approval-mode.ts";

describe("resolveDenaliRegistrationApprovalMode", () => {
  it("defaults to manual when missing", () => {
    assert.equal(resolveDenaliRegistrationApprovalMode({ data: { title: "T" } }), "manual");
    assert.equal(resolveDenaliRegistrationApprovalMode(null), "manual");
    assert.equal(resolveDenaliRegistrationApprovalMode({}), "manual");
  });

  it("reads pricing.registrationApproval from full canonical or bare data", () => {
    assert.equal(
      resolveDenaliRegistrationApprovalMode({
        schemaVersion: 1,
        roots: [],
        data: { pricing: { registrationApproval: "auto" } },
      }),
      "auto"
    );
    assert.equal(
      resolveDenaliRegistrationApprovalMode({
        pricing: { registrationApproval: "AUTO" },
      }),
      "auto"
    );
    assert.equal(
      resolveDenaliRegistrationApprovalMode({
        data: { pricing: { registrationApproval: "manual" } },
      }),
      "manual"
    );
  });

  it("unknown values fail closed to manual", () => {
    assert.equal(
      resolveDenaliRegistrationApprovalMode({
        data: { pricing: { registrationApproval: "instant" } },
      }),
      "manual"
    );
  });
});
