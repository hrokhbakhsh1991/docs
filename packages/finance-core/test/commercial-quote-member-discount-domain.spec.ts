/**
 * CQ-2A — member discount domain foundation.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyMemberDiscountToGross,
  buildMemberDiscountQuoteMetadata,
  normalizeMemberDiscountPercentage,
  tryApplyMemberDiscountReducer,
} from "../src/domain/commercial-quote/member-discount.ts";
import { COMMERCIAL_QUOTE_SOURCES } from "../src/domain/commercial-quote/types.ts";

const TENANT_A = "00000000-0000-4000-8000-0000000000aa";
const MEMBER_USER = "00000000-0000-4000-8000-000000000201";

describe("commercial-quote-member-discount-domain.spec.ts — CQ-2A", () => {
  it("CQ-DISC-DOMAIN-01: 10% calculation uses floor division", () => {
    const result = applyMemberDiscountToGross({
      grossMinor: "1000000",
      percentage: 10,
    });

    assert.equal(result.payableMinor, "900000");
    assert.equal(result.discountMinor, "100000");
    assert.equal(result.percentageApplied, 10);
  });

  it("CQ-DISC-DOMAIN-02: 100% gives zero payable", () => {
    const result = applyMemberDiscountToGross({
      grossMinor: "5000000",
      percentage: 100,
    });

    assert.equal(result.payableMinor, "0");
    assert.equal(result.discountMinor, "5000000");
  });

  it("CQ-DISC-DOMAIN-03: 0 and null skip reducer", () => {
    assert.equal(normalizeMemberDiscountPercentage(0), null);
    assert.equal(normalizeMemberDiscountPercentage(null), null);
    assert.equal(normalizeMemberDiscountPercentage(undefined), null);
    assert.equal(
      tryApplyMemberDiscountReducer({ grossMinor: "1000000", percentage: 0 }),
      null
    );
    assert.equal(
      tryApplyMemberDiscountReducer({ grossMinor: "1000000", percentage: null }),
      null
    );
  });

  it("CQ-DISC-DOMAIN-04: invalid percentage rejected", () => {
    for (const invalid of [-1, 101, 10.5, Number.NaN]) {
      assert.throws(
        () => normalizeMemberDiscountPercentage(invalid),
        /MEMBER_DISCOUNT_INVALID_PERCENTAGE/
      );
      assert.throws(
        () => tryApplyMemberDiscountReducer({ grossMinor: "1000000", percentage: invalid }),
        /MEMBER_DISCOUNT_INVALID_PERCENTAGE/
      );
    }
  });

  it("CQ-DISC-DOMAIN-05: tenant and user pass through metadata reference", () => {
    const reduced = applyMemberDiscountToGross({
      grossMinor: "1000000",
      percentage: 15,
    });
    const metadata = buildMemberDiscountQuoteMetadata({
      tenantId: TENANT_A,
      memberUserId: MEMBER_USER,
      percentageApplied: reduced.percentageApplied,
      discountMinor: reduced.discountMinor,
    });

    assert.equal(metadata.percentageApplied, 15);
    assert.equal(metadata.discountMinor, "150000");
    assert.equal(metadata.memberUserId, MEMBER_USER);
    assert.equal(metadata.membershipReference, `userTenant:${TENANT_A}:${MEMBER_USER}`);
  });

  it("COMMERCIAL_QUOTE_SOURCES includes member_discount", () => {
    assert.ok(COMMERCIAL_QUOTE_SOURCES.includes("member_discount"));
  });
});
