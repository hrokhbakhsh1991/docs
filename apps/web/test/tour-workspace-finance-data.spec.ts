import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveTourWorkspaceFinanceLoadOutcome,
  shouldBlockTourFinancePanelSkeleton,
} from "../src/features/tours/use-tour-workspace-finance-data";

describe("tour-workspace-finance-data.spec.ts", () => {
  it("PAY-FIN-01 — blocks empty skeleton only when loading with no rows yet", () => {
    assert.equal(
      shouldBlockTourFinancePanelSkeleton({
        loading: true,
        outstandingCount: 0,
        receiptCount: 0,
      }),
      true
    );
    assert.equal(
      shouldBlockTourFinancePanelSkeleton({
        loading: true,
        outstandingCount: 0,
        receiptCount: 3,
      }),
      false
    );
    assert.equal(
      shouldBlockTourFinancePanelSkeleton({
        loading: true,
        outstandingCount: 1,
        receiptCount: 0,
      }),
      false
    );
    assert.equal(
      shouldBlockTourFinancePanelSkeleton({
        loading: false,
        outstandingCount: 0,
        receiptCount: 0,
      }),
      false
    );
  });

  it("keeps successful finance reads when one workspace read fails", () => {
    const outcome = resolveTourWorkspaceFinanceLoadOutcome({
      outstanding: {
        ok: true,
        value: {
          items: [
            {
              registrationId: "r-1",
              identity: { memberDisplayName: "Guest", tourTitle: "Tour", tourId: "tour-1" },
              invoice: {
                totalMinor: "1000",
                paidMinor: "200",
                remainingMinor: "800",
                currency: "IRR",
              },
              bookingPaymentStatus: "partial",
              occurredAt: "2026-08-13T00:00:00.000Z",
            },
          ],
          nextCursor: null,
          hasMore: false,
        },
      },
      tours: {
        ok: false,
        error: "TOUR_COLLECTIONS_FETCH_FAILED",
        value: {
          items: [],
          nextCursor: null,
          hasMore: false,
        },
      },
      receipts: {
        ok: true,
        value: {
          items: [
            {
              id: "rcpt-1",
              paymentId: "pay-1",
              fileKey: "proof.png",
              status: "pending",
              note: null,
              createdAt: "2026-08-13T00:00:00.000Z",
              payment: {
                id: "pay-1",
                registrationId: "r-1",
                amount: "200",
                currency: "IRR",
                method: "transfer",
                status: "pending",
              },
              registrationContext: {
                registrationId: "r-1",
                memberDisplayName: "Guest",
                tourId: "tour-1",
                tourTitle: "Tour",
              },
            },
          ],
          nextCursor: null,
          hasMore: true,
        },
      },
    });

    assert.equal(outcome.loadSucceeded, true);
    assert.equal(outcome.error, null);
    assert.deepEqual(outcome.degradedSections, ["tours"]);
    assert.equal(outcome.outstanding.length, 1);
    assert.equal(outcome.tours.length, 0);
    assert.equal(outcome.receipts.length, 1);
    assert.equal(outcome.receiptsHasMore, true);
  });

  it("surfaces an error only when all workspace finance reads fail", () => {
    const outcome = resolveTourWorkspaceFinanceLoadOutcome({
      outstanding: {
        ok: false,
        error: "OUTSTANDING_FETCH_FAILED",
        value: { items: [], nextCursor: null, hasMore: false },
      },
      tours: {
        ok: false,
        error: "TOUR_COLLECTIONS_FETCH_FAILED",
        value: { items: [], nextCursor: null, hasMore: false },
      },
      receipts: {
        ok: false,
        error: "RECEIPTS_FETCH_FAILED",
        value: { items: [], nextCursor: null, hasMore: false },
      },
    });

    assert.equal(outcome.loadSucceeded, false);
    assert.equal(outcome.error, "OUTSTANDING_FETCH_FAILED");
    assert.deepEqual(outcome.degradedSections, ["outstanding", "tours", "receipts"]);
    assert.equal(outcome.outstanding.length, 0);
    assert.equal(outcome.tours.length, 0);
    assert.equal(outcome.receipts.length, 0);
    assert.equal(outcome.receiptsHasMore, false);
  });
});
