import assert from "node:assert/strict";
import test from "node:test";

import { resolvePaymentDueAtForProjection } from "./resolve-payment-due-at-projection";

const dueAt = "2026-09-28T12:00:00.000Z";

test("keeps an open deadline for an approved unsettled registration", () => {
  assert.equal(
    resolvePaymentDueAtForProjection({
      status: "approved",
      paymentStatus: "unpaid",
      paymentDueAt: dueAt,
    }),
    dueAt
  );
});

test("drops stale deadlines after paid or waived projection", () => {
  assert.equal(
    resolvePaymentDueAtForProjection({
      status: "approved",
      paymentStatus: "paid",
      paymentDueAt: dueAt,
    }),
    undefined
  );
  assert.equal(
    resolvePaymentDueAtForProjection({
      status: "approved",
      paymentStatus: "unpaid",
      financialDisplayState: "WAIVED",
      paymentDueAt: dueAt,
    }),
    undefined
  );
});

test("does not expose deadlines for non-approved registrations", () => {
  assert.equal(
    resolvePaymentDueAtForProjection({
      status: "pending",
      paymentStatus: "unpaid",
      paymentDueAt: dueAt,
    }),
    undefined
  );
});
