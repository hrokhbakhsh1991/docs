/**
 * P6 VS-07 — member receipt upload (API seed) → operator finance approve
 * @see docs/phase-19/p6/runbooks/first-customer-operator.md
 */
import { expect, test } from "@playwright/test";

import { FINANCE_RECEIPTS_TEST_IDS } from "../../src/finance/finance-receipts-logic";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";

const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_SMOKE_MEMBER_USER_ID = "00000000-0000-4000-8000-000000000103";
const OPERATOR_SMOKE_PENDING_BOOKING_ID = "00000000-0000-4000-8000-000000000310";
const P6_VS07_RECEIPT_FILE_KEY = `receipts/${OPERATOR_SMOKE_PENDING_BOOKING_ID}/p6-vs07-smoke.jpg`;

function tourOpsApiBase(): string {
  return (process.env.TOUR_OPS_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}

async function seedPendingMemberReceipt(page: import("@playwright/test").Page): Promise<void> {
  const response = await page.request.post(
    `${tourOpsApiBase()}/bookings/${OPERATOR_SMOKE_PENDING_BOOKING_ID}/receipts`,
    {
      headers: {
        "x-tenant-id": OPERATOR_SMOKE_TENANT_ID,
        "x-authenticated-tenant-id": OPERATOR_SMOKE_TENANT_ID,
        "x-user-id": OPERATOR_SMOKE_MEMBER_USER_ID,
        "x-actor-role": "member",
        "x-membership-status": "ACTIVE",
        "x-workspace-id": "ws-operator-smoke-member",
        "content-type": "application/json",
      },
      data: { fileKey: P6_VS07_RECEIPT_FILE_KEY },
    }
  );
  expect(response.status(), await response.text()).toBe(201);
}

test.describe("p6-operator-receipt-approve-smoke.spec.ts — P6 VS-07", () => {
  test("SMK-P6-ADM-02 pending member receipt → operator finance approve", async ({ page }) => {
    await seedPendingMemberReceipt(page);

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });

    const reviewResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/finance/receipts/") &&
        response.url().includes("/review") &&
        response.request().method() === "PATCH" &&
        response.ok()
    );

    await page.goto("/finance?tab=receipts");
    await expect(page.getByTestId(FINANCE_RECEIPTS_TEST_IDS.panel)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId(FINANCE_RECEIPTS_TEST_IDS.list)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByTestId(FINANCE_RECEIPTS_TEST_IDS.reviewForm)).toBeVisible({
      timeout: 15_000,
    });

    await page
      .getByTestId(FINANCE_RECEIPTS_TEST_IDS.reviewForm)
      .getByRole("button", { name: /approve|تأیید/i })
      .click();
    await reviewResponse;

    await expect(page.getByText(/No receipts awaiting review|رسیدی در انتظار بررسی نیست/i)).toBeVisible(
      { timeout: 15_000 }
    );
  });
});
