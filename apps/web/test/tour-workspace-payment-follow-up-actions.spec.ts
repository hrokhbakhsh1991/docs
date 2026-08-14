import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { PaymentScheduleItem } from "../src/finance/finance-installments-logic";
import {
  hasActiveTourWorkspacePaymentSchedule,
  resolveTourWorkspaceDetailActionMode,
  resolveTourWorkspaceDetailActionRecommendation,
} from "../src/features/tours/tour-workspace-payment-follow-up-actions";

function scheduleItem(overrides: Partial<PaymentScheduleItem> = {}): PaymentScheduleItem {
  return {
    id: "sch-1",
    registrationId: "00000000-0000-4000-8000-000000000111",
    sequence: 1,
    label: "Deposit",
    dueAt: "2026-08-20T00:00:00.000Z",
    amountMinor: "40",
    paidMinor: "0",
    status: "due",
    registrationContext: null,
    ...overrides,
  };
}

describe("tour-workspace-payment-follow-up-actions.spec.ts", () => {
  it("detects whether an active payment schedule still exists", () => {
    assert.equal(hasActiveTourWorkspacePaymentSchedule([]), false);
    assert.equal(hasActiveTourWorkspacePaymentSchedule([scheduleItem({ status: "paid" })]), false);
    assert.equal(
      hasActiveTourWorkspacePaymentSchedule([scheduleItem({ status: "waived" })]),
      false
    );
    assert.equal(
      hasActiveTourWorkspacePaymentSchedule([scheduleItem({ status: "partial" })]),
      true
    );
  });

  it("maps payment states to safe action modes", () => {
    assert.equal(resolveTourWorkspaceDetailActionMode("payment_under_review"), "review_receipt");
    assert.equal(resolveTourWorkspaceDetailActionMode("paid_in_full"), "read_only");
    assert.equal(resolveTourWorkspaceDetailActionMode("no_payment_required"), "read_only");
    assert.equal(resolveTourWorkspaceDetailActionMode("credit_balance"), "read_only");
    assert.equal(resolveTourWorkspaceDetailActionMode("needs_payment"), "active");
    assert.equal(resolveTourWorkspaceDetailActionMode("overdue"), "active");
  });

  it("prioritizes recommendation copy in the right order", () => {
    assert.deepEqual(
      resolveTourWorkspaceDetailActionRecommendation({
        status: "payment_under_review",
        hasActiveSchedule: true,
      }),
      {
        titleKey: "detailRecommendationReviewReceiptTitle",
        bodyKey: "detailRecommendationReviewReceiptBody",
      }
    );

    assert.deepEqual(
      resolveTourWorkspaceDetailActionRecommendation({
        status: "paid_in_full",
        hasActiveSchedule: true,
      }),
      {
        titleKey: "detailRecommendationSettledTitle",
        bodyKey: "detailRecommendationSettledBody",
      }
    );

    assert.deepEqual(
      resolveTourWorkspaceDetailActionRecommendation({
        status: "needs_payment",
        hasActiveSchedule: true,
      }),
      {
        titleKey: "detailRecommendationScheduleTitle",
        bodyKey: "detailRecommendationScheduleBody",
      }
    );

    assert.deepEqual(
      resolveTourWorkspaceDetailActionRecommendation({
        status: "needs_payment",
        hasActiveSchedule: false,
      }),
      {
        titleKey: "detailRecommendationCollectTitle",
        bodyKey: "detailRecommendationCollectBody",
      }
    );
  });
});
