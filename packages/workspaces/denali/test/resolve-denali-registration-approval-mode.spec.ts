import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyDenaliRegistrationApprovalFromOperatorFlag,
  denaliRegistrationApprovalFromManualFlag,
  resolveDenaliRegistrationApprovalMode,
} from "../src/booking/resolve-denali-registration-approval-mode.ts";

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
    assert.equal(
      resolveDenaliRegistrationApprovalMode({
        data: {
          pricing: { registrationApproval: "instant" },
          requiresManualAdminApproval: false,
        },
      }),
      "manual"
    );
  });

  it("checkbox off maps to auto when pricing path is absent", () => {
    assert.equal(
      resolveDenaliRegistrationApprovalMode({
        data: { requiresManualAdminApproval: false },
      }),
      "auto"
    );
    assert.equal(
      resolveDenaliRegistrationApprovalMode({
        data: { requiresManualAdminApproval: "false" },
      }),
      "auto"
    );
  });

  it("checkbox on maps to manual when pricing path is absent", () => {
    assert.equal(
      resolveDenaliRegistrationApprovalMode({
        data: { requiresManualAdminApproval: true },
      }),
      "manual"
    );
    assert.equal(
      resolveDenaliRegistrationApprovalMode({
        data: { requiresManualAdminApproval: "true" },
      }),
      "manual"
    );
  });

  it("explicit pricing.registrationApproval wins over the checkbox", () => {
    assert.equal(
      resolveDenaliRegistrationApprovalMode({
        data: {
          requiresManualAdminApproval: true,
          pricing: { registrationApproval: "auto" },
        },
      }),
      "auto"
    );
    assert.equal(
      resolveDenaliRegistrationApprovalMode({
        data: {
          requiresManualAdminApproval: false,
          pricing: { registrationApproval: "manual" },
        },
      }),
      "manual"
    );
  });
});

describe("denaliRegistrationApprovalFromManualFlag", () => {
  it("returns null when the flag was never saved", () => {
    assert.equal(denaliRegistrationApprovalFromManualFlag(undefined), null);
    assert.equal(denaliRegistrationApprovalFromManualFlag(null), null);
    assert.equal(denaliRegistrationApprovalFromManualFlag(""), null);
  });
});

describe("applyDenaliRegistrationApprovalFromOperatorFlag", () => {
  it("writes auto when the checkbox is off", () => {
    const data: Record<string, unknown> = {
      requiresManualAdminApproval: false,
      pricing: { basePricePerPerson: 1 },
    };
    applyDenaliRegistrationApprovalFromOperatorFlag(data);
    assert.deepEqual(data.pricing, {
      basePricePerPerson: 1,
      registrationApproval: "auto",
    });
  });

  it("writes manual when the checkbox is on", () => {
    const data: Record<string, unknown> = { requiresManualAdminApproval: true };
    applyDenaliRegistrationApprovalFromOperatorFlag(data);
    assert.deepEqual(data.pricing, { registrationApproval: "manual" });
  });

  it("leaves pricing alone when the flag is missing", () => {
    const data: Record<string, unknown> = { pricing: { basePricePerPerson: 1 } };
    applyDenaliRegistrationApprovalFromOperatorFlag(data);
    assert.deepEqual(data.pricing, { basePricePerPerson: 1 });
  });
});
