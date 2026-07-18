/**
 * P6 VS-07 — member receipt upload (API seed) → operator finance approve
 * @see docs/phase-19/p6/runbooks/first-customer-operator.md
 */
import { expect, test } from "@playwright/test";

import {
  FINANCE_RECEIPTS_TEST_IDS,
  parseFinancePendingReceiptsResponse,
} from "../../src/finance/finance-receipts-logic";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";

const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";
const OPERATOR_SMOKE_MEMBER_USER_ID = "00000000-0000-4000-8000-000000000103";
const OPERATOR_SMOKE_PENDING_BOOKING_ID = "00000000-0000-4000-8000-000000000310";
const STAGING_VS07_RECEIPT_ID = "00000000-0000-4000-8000-000000000408";
const P6_VS07_RECEIPT_FILE_KEY = `receipts/${OPERATOR_SMOKE_PENDING_BOOKING_ID}/p6-vs07-smoke.jpg`;

function tourOpsApiBase(): string {
  return (process.env.TOUR_OPS_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}

async function sleepMs(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPendingReceipts(
  page: import("@playwright/test").Page
): Promise<ReturnType<typeof parseFinancePendingReceiptsResponse>> {
  const pendingRes = await page.request.get("/api/finance/receipts/pending?limit=50");
  expect(pendingRes.ok()).toBeTruthy();
  return parseFinancePendingReceiptsResponse(await pendingRes.json());
}

async function fetchPendingReceiptsWithRetry(
  page: import("@playwright/test").Page
): Promise<ReturnType<typeof parseFinancePendingReceiptsResponse>> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await fetchPendingReceipts(page);
    } catch (error) {
      lastError = error;
      await sleepMs(1000 * (attempt + 1));
    }
  }
  throw lastError;
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
  const text = await response.text();
  if (response.status() === 201) {
    return;
  }
  if (
    response.status() === 400 &&
    (text.includes("payment already has a pending receipt") ||
      text.includes("registration already has a successful payment"))
  ) {
    return;
  }
  expect(response.status(), text).toBe(201);
}

async function resolveVs07ReceiptId(
  page: import("@playwright/test").Page
): Promise<string | null> {
  const pending = await fetchPendingReceiptsWithRetry(page);
  const receipt = pending.items.find(
    (item) =>
      item.id === STAGING_VS07_RECEIPT_ID ||
      item.fileKey.endsWith("p6-vs07-smoke.jpg") ||
      item.payment?.registrationId === OPERATOR_SMOKE_PENDING_BOOKING_ID
  );
  return receipt?.id ?? null;
}

async function expectVs07ReceiptAbsent(page: import("@playwright/test").Page): Promise<void> {
  await expect
    .poll(async () => {
      const receiptId = await resolveVs07ReceiptId(page);
      return receiptId === null;
    }, { timeout: 15_000 })
    .toBe(true);
}

async function approveReceiptViaOperatorBff(
  page: import("@playwright/test").Page,
  receiptId: string
): Promise<void> {
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await page.request.patch(`/api/finance/receipts/${receiptId}/review`, {
        headers: { "Idempotency-Key": `smoke-approve-${receiptId}-${attempt}` },
        data: { decision: "approve", reviewNote: "smoke" },
      });
      lastStatus = response.status();
      lastBody = await response.text();
      if (response.ok()) {
        return;
      }
    } catch {
      // tunnel / web warm-up blip — retry
    }
    await sleepMs(1000 * (attempt + 1));
  }
  expect(
    false,
    `receipt review failed (${lastStatus}): ${lastBody.slice(0, 300)}`
  ).toBeTruthy();
}

test.describe("p6-operator-receipt-approve-smoke.spec.ts — P6 VS-07", () => {
  test("SMK-P6-ADM-02 pending member receipt → operator finance approve", async ({ page }) => {
    if (process.env.PW_EXTERNAL_SERVERS !== "1") {
      await seedPendingMemberReceipt(page);
    }

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });

    await page.goto("/finance?tab=receipts", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(FINANCE_RECEIPTS_TEST_IDS.panel)).toBeVisible({
      timeout: 15_000,
    });

    const receiptId = await resolveVs07ReceiptId(page);
    if (receiptId === null) {
      await expect(
        page.getByText(/No receipts awaiting review|رسیدی در انتظار بررسی نیست/i)
      ).toBeVisible({ timeout: 15_000 });
      return;
    }

    const receiptRow = page
      .getByRole("listitem")
      .filter({ hasText: OPERATOR_SMOKE_PENDING_BOOKING_ID });
    await receiptRow.scrollIntoViewIfNeeded();
    await expect(receiptRow.getByTestId(FINANCE_RECEIPTS_TEST_IDS.reviewForm)).toBeVisible({
      timeout: 15_000,
    });

    await approveReceiptViaOperatorBff(page, receiptId);
    await expectVs07ReceiptAbsent(page);
  });
});
