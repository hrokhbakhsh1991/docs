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

    await page.getByRole("button", { name: new RegExp(guestName, "i") }).click();
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton)).toBeVisible();
    const approveResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/bookings/") &&
        response.url().includes("/approve") &&
        response.request().method() === "POST" &&
        response.ok()
    );
    await page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton).click();
    await approveResponse;

    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection)).toContainText(
      /approved|تأییدشده/i,
      { timeout: 15_000 }
    );

    const fileKey = `receipts/${chain.bookingId}/p6-chain-browser.jpg`;
    await seedMemberReceiptViaApi(request, {
      bookingId: chain.bookingId,
      memberUserId: chain.memberUserId,
      memberWorkspaceId: chain.memberWorkspaceId,
      fileKey,
    });

    await page.goto("/finance?tab=receipts", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(FINANCE_RECEIPTS_TEST_IDS.panel)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId(FINANCE_RECEIPTS_TEST_IDS.reviewForm)).toBeVisible({
      timeout: 15_000,
    });
    const approveButton = page
      .getByTestId(FINANCE_RECEIPTS_TEST_IDS.reviewForm)
      .getByRole("button", { name: /approve|تأیید/i });
    await expect(approveButton).toBeEnabled({ timeout: 15_000 });

    const [reviewRes] = await Promise.all([
      page.waitForResponse(
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

    await expect(page.getByText(/No receipts awaiting review|رسیدی در انتظار بررسی نیست/i)).toBeVisible(
      { timeout: 15_000 }
    );
  });
});
