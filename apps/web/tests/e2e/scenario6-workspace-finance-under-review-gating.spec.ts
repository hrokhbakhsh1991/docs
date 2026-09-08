/**
 * Manual QA — Scenario 6: payment-under-review state should prioritize receipt review inside workspace.
 * Creates a pending manual payment + receipt first, then verifies the workspace switches to receipt-review-first gating.
 */
import { expect, test } from "@playwright/test";

import { FINANCE_PAYMENTS_TEST_IDS } from "../../src/finance/finance-payments-logic";
import {
  FINANCE_RECEIPTS_TEST_IDS,
  parseFinancePendingReceiptsResponse,
} from "../../src/finance/finance-receipts-logic";
import { TOUR_WORKSPACE_FINANCE_TEST_IDS } from "../../src/features/tours/tour-workspace-finance-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "../../src/features/tours/tour-workspace-types";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";
import {
  ensureTourHasApprovalCapacity,
  openFinanceWorkspaceGuest,
  seedApprovedUnpaidGuest,
} from "./fixtures/tour-workspace-smoke";

type PaymentRow = {
  readonly id?: string;
  readonly status?: string;
  readonly method?: string;
  readonly registrationId?: string;
  readonly amount?: string;
  readonly currency?: string;
};

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPendingReceiptForRegistration(
  page: import("@playwright/test").Page,
  registrationId: string
): Promise<void> {
  let lastCount = 0;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const pendingRes = await page.request.get(
      `/api/finance/receipts/pending?registrationId=${encodeURIComponent(registrationId)}&limit=20`
    );
    expect(pendingRes.ok(), await pendingRes.text()).toBeTruthy();
    const pendingBody = parseFinancePendingReceiptsResponse(await pendingRes.json());
    lastCount = pendingBody.items.filter(
      (row) => row.payment?.registrationId?.trim() === registrationId
    ).length;
    if (lastCount > 0) {
      return;
    }
    await sleepMs(1000 * (attempt + 1));
  }
  expect(
    lastCount,
    "pending receipt should become visible before workspace refresh"
  ).toBeGreaterThan(0);
}

test.describe("scenario-6 workspace finance under-review gating", () => {
  test("receipt-review CTA is prioritized when proof is already pending", async ({ page }) => {
    test.setTimeout(240_000);
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await ensureTourHasApprovalCapacity(page, { minFreePartySlots: 1 });

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { guestName, registrationId } = await seedApprovedUnpaidGuest(page, stamp);

    const createManualRes = await page.request.post("/api/finance/payments/manual", {
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `scenario6-manual-${registrationId}-${Date.now()}`,
      },
      data: {
        registrationId,
        amount: "1000000",
        currency: "IRR",
      },
    });
    expect(createManualRes.ok(), await createManualRes.text()).toBeTruthy();

    const paymentsRes = await page.request.get(
      `/api/finance/payments?registrationId=${encodeURIComponent(registrationId)}&limit=20`
    );
    expect(paymentsRes.ok(), await paymentsRes.text()).toBeTruthy();
    const paymentsBody = (await paymentsRes.json()) as { items?: PaymentRow[] };
    const pendingManual =
      paymentsBody.items?.find(
        (row) =>
          row.registrationId === registrationId &&
          row.status === "Pending" &&
          row.method === "Manual" &&
          row.amount === "1000000" &&
          row.currency === "IRR" &&
          typeof row.id === "string" &&
          row.id.length > 0
      ) ?? null;
    expect(pendingManual, "new pending manual payment should be visible").not.toBeNull();

    const submitReceiptRes = await page.request.post("/api/finance/receipts", {
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `scenario6-receipt-${registrationId}-${Date.now()}`,
      },
      data: {
        paymentId: pendingManual!.id!,
        fileKey: `receipts/${registrationId}/workspace-scenario6-${Date.now()}.jpg`,
      },
    });
    expect(submitReceiptRes.ok(), await submitReceiptRes.text()).toBeTruthy();
    await waitForPendingReceiptForRegistration(page, registrationId);

    await openFinanceWorkspaceGuest(page, { registrationId, guestName });
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.financePanel)).toBeVisible({
      timeout: 90_000,
    });

    const detailPanel = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.detailPanel);
    await expect(detailPanel).toBeVisible({
      timeout: 30_000,
    });
    await expect(
      detailPanel.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.inlineReceiptReview)
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(detailPanel.getByTestId(FINANCE_RECEIPTS_TEST_IDS.reviewForm)).toBeVisible({
      timeout: 30_000,
    });

    await expect(detailPanel.getByTestId(FINANCE_PAYMENTS_TEST_IDS.createForm)).toHaveCount(0);
    await expect(detailPanel.getByTestId(FINANCE_PAYMENTS_TEST_IDS.receiptForm)).toHaveCount(0);
  });
});
