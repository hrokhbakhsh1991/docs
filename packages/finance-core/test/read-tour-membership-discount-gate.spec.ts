/**
 * CQ-2D — tour membership discount gate reader.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { readTourAllowMembershipDiscount } from "../src/domain/commercial-quote/read-tour-membership-discount-gate.ts";

describe("read-tour-membership-discount-gate.spec.ts — CQ-2D", () => {
  it("returns true when pricing.allowMembershipDiscount is true", () => {
    assert.equal(
      readTourAllowMembershipDiscount({
        data: { pricing: { allowMembershipDiscount: true, basePricePerPerson: 1_000_000 } },
      }),
      true
    );
  });

  it("returns false when gate is false", () => {
    assert.equal(
      readTourAllowMembershipDiscount({
        data: { pricing: { allowMembershipDiscount: false } },
      }),
      false
    );
  });

  it("fail closed when gate missing", () => {
    assert.equal(
      readTourAllowMembershipDiscount({
        data: { pricing: { basePricePerPerson: 1_000_000 } },
      }),
      false
    );
    assert.equal(readTourAllowMembershipDiscount(null), false);
    assert.equal(readTourAllowMembershipDiscount({}), false);
  });

  it("reads wizard pricingPayment alias", () => {
    assert.equal(
      readTourAllowMembershipDiscount({
        pricingPayment: { allowMembershipDiscount: true },
      }),
      true
    );
  });

  it("GATE-04: accepts wizard draft string true and rejects string false", () => {
    assert.equal(
      readTourAllowMembershipDiscount({
        data: { pricing: { allowMembershipDiscount: "true" } },
      }),
      true
    );
    assert.equal(
      readTourAllowMembershipDiscount({
        data: { pricing: { allowMembershipDiscount: "false" } },
      }),
      false
    );
  });
});
