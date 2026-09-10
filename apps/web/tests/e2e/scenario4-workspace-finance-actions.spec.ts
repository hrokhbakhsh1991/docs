/**
 * Manual QA — Scenario 4: payment follow-up detail exposes action surfaces inside workspace.
 * Verifies registration-scoped payment actions without leaving the tour workspace.
 */
import { expect, test } from "@playwright/test";

import { FINANCE_PAYMENTS_TEST_IDS } from "../../src/finance/finance-payments-logic";
import { TOUR_WORKSPACE_FINANCE_TEST_IDS } from "../../src/features/tours/tour-workspace-finance-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "../../src/features/tours/tour-workspace-types";
import {
  OPERATOR_SMOKE_CHAIN_TOUR_ID,
  seedChainGuestRegistrationViaApi,
} from "../../test/fixtures/p6-chain-guest-api";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";

const TOUR_ID = process.env.QA_TOUR_ID?.trim() || OPERATOR_SMOKE_CHAIN_TOUR_ID;

function financeWorkspacePath(registrationId: string): string {
  return `/tours/${TOUR_ID}/workspace?tab=finance&focusRegistrationId=${encodeURIComponent(
    registrationId
  )}`;
}

test.describe("scenario-4 workspace finance action surfaces", () => {
  test("finance detail keeps payment actions inside workspace", async ({ page }) => {
    test.setTimeout(240_000);
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await ensureTourHasApprovalCapacity(page, { minFreePartySlots: 1 });

    const stamp = Date.now();
    const booking = await seedChainGuestRegistrationViaApi(page.request, {
      guestName: `Scenario4 Candidate ${stamp}`,
      guestEmail: `scenario4-${stamp}@denali-smoke.local`,
      mobile: `0912${String(stamp).slice(-7)}`,
    });
    const registrationId = booking.bookingId;
    const approveRes = await page.request.post(`/api/bookings/${registrationId}/approve`);
    expect(approveRes.ok(), await approveRes.text()).toBeTruthy();
    const overrideRes = await page.request.put(
      `/api/finance/registrations/${registrationId}/obligation-override`,
      {
        headers: { "Content-Type": "application/json" },
        data: {
          obligationMinor: "1000000",
          reason: "Scenario 4 workspace finance actions seed",
        },
      }
    );
    expect(overrideRes.ok(), await overrideRes.text()).toBeTruthy();

    await page.goto(financeWorkspacePath(registrationId), { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.financePanel)).toBeVisible({
      timeout: 90_000,
    });
    const detailPanel = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.detailPanel);
    await expect(detailPanel).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId(FINANCE_PAYMENTS_TEST_IDS.createForm)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("finance-submit-receipt-advanced")).toBeAttached({
      timeout: 30_000,
    });
    await expect(detailPanel.getByTestId(FINANCE_PAYMENTS_TEST_IDS.receiptForm)).toBeHidden({
      timeout: 30_000,
    });
  });
});
