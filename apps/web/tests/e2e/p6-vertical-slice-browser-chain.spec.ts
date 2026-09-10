/**
 * P6 Bundle C — browser chain: API guest register → operator UI approve → receipt → finance
 * @see docs/phase-19/p6/appendices/SMOKE-SCENARIO-MAP-P6.md SMK-P6-VS-CHAIN-B01
 */
import { expect, test } from "@playwright/test";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../src/features/bookings/bookings-command-center-types";
import { FINANCE_RECEIPTS_TEST_IDS } from "../../src/finance/finance-receipts-logic";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";
import {
  seedChainGuestRegistrationViaApi,
  seedMemberReceiptViaApi,
} from "../../test/fixtures/p6-chain-guest-api";

test.describe("p6-vertical-slice-browser-chain.spec.ts — P6 VS-CHAIN browser", () => {
  // This chain warms bookings, auth, Denali plugin and finance routes in one
  // Next dev process; allow compilation time without weakening any assertion.
  test.setTimeout(300_000);

  async function gotoFinanceReceipts(
    page: import("@playwright/test").Page
  ): Promise<import("@playwright/test").Page> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await page.goto("/finance?tab=receipts", {
          waitUntil: "commit",
          timeout: 30_000,
        });
        await expect(page.getByTestId(FINANCE_RECEIPTS_TEST_IDS.panel)).toBeVisible({
          timeout: 30_000,
        });
        return page;
      } catch (error: unknown) {
        lastError = error;
      }
    }
    throw lastError;
  }

  test("P6-VS-CHAIN-B01 same bookingId through guest API · operator approve · finance UI", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const guestName = `P6 Chain Browser ${stamp}`;
    const chain = await seedChainGuestRegistrationViaApi(request, {
      guestName,
      email: `p6-chain-browser-${stamp}@denali-smoke.local`,
      mobile: `+1555${String(stamp).slice(-7)}`,
    });

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto("/bookings");
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 15_000,
    });

    await page
      .locator("[data-booking-row]")
      .filter({ hasText: guestName })
      .getByRole("button")
      .first()
      .click();
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton)).toBeVisible();
    const approveResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/bookings/") &&
        response.url().includes("/approve") &&
        response.request().method() === "POST"
    );
    await page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton).click();
    const approveResult = await approveResponse;
    const approveBody = await approveResult.text();
    expect(
      approveResult.ok(),
      `booking approval failed (${approveResult.status()}): ${approveBody.slice(0, 300)}`
    ).toBeTruthy();

    // The default command-center queue is pending + waitlisted, so a successful approval
    // intentionally removes the row and clears inspection. The HTTP response above is the
    // mutation proof; assert the queue projection instead of waiting for a non-existent panel.
    await expect(page.locator("[data-booking-row]").filter({ hasText: guestName })).toHaveCount(0, {
      timeout: 15_000,
    });

    const fileKey = `receipts/${chain.bookingId}/p6-chain-browser.jpg`;
    await seedMemberReceiptViaApi(request, {
      bookingId: chain.bookingId,
      memberUserId: chain.memberUserId,
      memberWorkspaceId: chain.memberWorkspaceId,
      fileKey,
    });

    // Start finance on a fresh page so the bookings route's refresh/HMR state
    // cannot detach the frame during the cross-surface transition.
    const financePage = await gotoFinanceReceipts(await page.context().newPage());
    const receiptRow = financePage
      .getByTestId(FINANCE_RECEIPTS_TEST_IDS.list)
      .getByRole("listitem")
      .filter({ has: financePage.locator(`a[title="${chain.bookingId}"]`) });
    const receiptReviewForm = receiptRow.getByTestId(FINANCE_RECEIPTS_TEST_IDS.reviewForm);
    await expect(receiptReviewForm).toBeVisible({
      timeout: 15_000,
    });
    const approveButton = receiptReviewForm.getByRole("button", { name: /approve|تأیید/i });
    await expect(approveButton).toBeEnabled({ timeout: 15_000 });

    const [reviewRes] = await Promise.all([
      financePage.waitForResponse(
        (response) =>
          response.url().includes("/api/finance/receipts/") &&
          response.url().includes("/review") &&
          response.request().method() === "PATCH"
      ),
      approveButton.click(),
    ]);
    const reviewBody = await reviewRes.text();
    expect(
      reviewRes.ok(),
      `receipt review failed (${reviewRes.status()}): ${reviewBody.slice(0, 300)}`
    ).toBeTruthy();

    // Other smoke receipts may legitimately remain in the inbox; only the chain's receipt
    // must disappear after approval.
    await expect(
      financePage
        .getByTestId(FINANCE_RECEIPTS_TEST_IDS.list)
        .getByRole("listitem")
        .filter({ has: financePage.locator(`a[title="${chain.bookingId}"]`) })
    ).toHaveCount(0, { timeout: 15_000 });
  });
});
