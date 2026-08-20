/**
 * CQ-2D — Denali allowMembershipDiscount canonical reader.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveDenaliAllowMembershipDiscount } from "../src/finance/resolve-denali-allow-membership-discount.ts";

describe("resolveDenaliAllowMembershipDiscount — CQ-2D", () => {
  it("reads pricing.allowMembershipDiscount on canonical envelope", () => {
    assert.equal(
      resolveDenaliAllowMembershipDiscount({
        data: {
          pricing: {
            allowMembershipDiscount: true,
            basePricePerPerson: 2_500_000,
            paymentMode: "offline_receipt",
          },
        },
      }),
      true
    );
  });

  it("fail closed when field missing", () => {
    assert.equal(
      resolveDenaliAllowMembershipDiscount({
        data: { pricing: { basePricePerPerson: 2_500_000 } },
      }),
      false
    );
  });
});
