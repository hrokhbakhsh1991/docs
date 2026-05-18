import assert from "node:assert/strict";
import test from "node:test";

import { BadRequestException } from "@nestjs/common";

import {
  assertRequiresPaymentHasPositiveAmount,
  PAID_TOUR_REQUIRES_AMOUNT
} from "./assert-requires-payment-cost";

test("allows requiresPayment when totalCost is positive", () => {
  assert.doesNotThrow(() =>
    assertRequiresPaymentHasPositiveAmount({
      costContext: { requiresPayment: true, totalCost: 1_200_000, currency: "IRR" }
    })
  );
});

test("allows requiresPayment when listPriceMinor is set", () => {
  assert.doesNotThrow(() =>
    assertRequiresPaymentHasPositiveAmount({
      costContext: { requiresPayment: true },
      listPriceMinor: "120000000"
    })
  );
});

test("skips when requiresPayment is not true", () => {
  assert.doesNotThrow(() =>
    assertRequiresPaymentHasPositiveAmount({
      costContext: { totalCost: 0 }
    })
  );
});

test("rejects requiresPayment without amount for Open", () => {
  assert.throws(
    () =>
      assertRequiresPaymentHasPositiveAmount({
        costContext: { requiresPayment: true, currency: "IRR" }
      }),
    (err: unknown) => {
      assert.ok(err instanceof BadRequestException);
      const body = err.getResponse() as { error?: { code?: string } };
      assert.equal(body.error?.code, PAID_TOUR_REQUIRES_AMOUNT.error.code);
      return true;
    }
  );
});
