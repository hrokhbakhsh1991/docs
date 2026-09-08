/**
 * Manual QA — Scenario 4: payment follow-up detail exposes action surfaces inside workspace.
 * Verifies registration-scoped payment actions without leaving the tour workspace.
 */
import { expect, test } from "@playwright/test";

import { BOOKING_FINANCIAL_STRIP_TEST_IDS } from "../../src/finance/booking-financial-strip-logic";
import { FINANCE_PAYMENTS_TEST_IDS } from "../../src/finance/finance-payments-logic";
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

test.describe("scenario-4 workspace finance action surfaces", () => {
  test("finance detail keeps payment actions inside workspace", async ({ page }) => {
    test.setTimeout(240_000);
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await ensureTourHasApprovalCapacity(page, { minFreePartySlots: 1 });

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const { guestName, registrationId } = await seedApprovedUnpaidGuest(page, stamp);
    await openFinanceWorkspaceGuest(page, { registrationId, guestName });

    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.financePanel)).toBeVisible({
      timeout: 90_000,
    });
    const detailPanel = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.detailPanel);
    await expect(detailPanel).toBeVisible({
      timeout: 30_000,
    });
    await expect(detailPanel.getByTestId(FINANCE_PAYMENTS_TEST_IDS.createForm)).toBeVisible({
      timeout: 30_000,
    });

    const advancedToggle = detailPanel.locator("details summary").filter({
      hasText: /advanced|پیشرفته|more settings|تنظیمات بیشتر/i,
    });
    await expect(advancedToggle.first()).toBeVisible({ timeout: 15_000 });
    await advancedToggle.first().click();

    await expect(detailPanel.getByTestId(BOOKING_FINANCIAL_STRIP_TEST_IDS.strip)).toBeVisible({
      timeout: 30_000,
    });
    await expect(detailPanel.getByTestId("finance-submit-receipt-advanced")).toBeVisible({
      timeout: 30_000,
    });
    await expect(detailPanel.getByTestId(FINANCE_PAYMENTS_TEST_IDS.receiptForm)).toBeHidden({
      timeout: 30_000,
    });
  });
});
