/**
 * P6 VS-07 — pending receipt → operator finance approve (Denali-aligned dynamic seed).
 * @see docs/phase-19/p6/runbooks/first-customer-operator.md
 */
import { expect, test } from "@playwright/test";

import { FINANCE_PAYMENTS_TEST_IDS } from "../../src/finance/finance-payments-logic";
import { parseFinanceReceiptCreateResponse } from "../../src/finance/finance-payments-logic";
import {
  FINANCE_RECEIPTS_TEST_IDS,
  parseFinancePendingReceiptsResponse,
} from "../../src/finance/finance-receipts-logic";
import { DENALI_SMOKE_PUBLISHED_TOUR_ID } from "../../test/fixtures/plp-pdp-field-visibility-fixture";
import { OPERATOR_SMOKE_PUBLISHED_TOUR_ID } from "../../test/fixtures/p6-chain-guest-api";
import { loginDenaliOperatorOwner } from "./fixtures/authenticate-denali-operator-for-engagement";

type PaymentRow = {
  readonly id?: string;
  readonly status?: string;
  readonly method?: string;
  readonly registrationId?: string;
};

type BookingCreateResponse = {
  readonly id?: string;
};

type TourDetailResponse = {
  readonly projection?: {
    readonly title?: string | null;
    readonly departureAt?: string | null;
  };
};

function resolveTourId(): string {
  const override = process.env.QA_TOUR_ID?.trim();
  if (override) {
    return override;
  }
  const base =
    process.env.PLAYWRIGHT_BASE_URL?.trim() ?? process.env.SMOKE_DENALI_WEB_BASE_URL?.trim() ?? "";
  return /denali/i.test(base) ? DENALI_SMOKE_PUBLISHED_TOUR_ID : OPERATOR_SMOKE_PUBLISHED_TOUR_ID;
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
  expect(false, `receipt review failed (${lastStatus}): ${lastBody.slice(0, 300)}`).toBeTruthy();
}

async function seedPendingReceiptForRegistration(
  page: import("@playwright/test").Page,
  input: {
    readonly tourId: string;
    readonly registrationId: string;
  }
): Promise<{ readonly receiptId: string; readonly fileKey: string }> {
  await page.goto(
    `/finance?tourId=${encodeURIComponent(input.tourId)}&tab=payments&registrationId=${encodeURIComponent(input.registrationId)}`,
    { waitUntil: "domcontentloaded" }
  );
  const createOpen = page.getByTestId(FINANCE_PAYMENTS_TEST_IDS.createOpen);
  if (await createOpen.isVisible().catch(() => false)) {
    await createOpen.click();
  } else {
    await page
      .getByTestId(FINANCE_PAYMENTS_TEST_IDS.createDetails)
      .getByText(/Show pending payment form|نمایش فرم پرداخت در انتظار/i)
      .click();
  }
  await expect(page.getByTestId(FINANCE_PAYMENTS_TEST_IDS.createForm)).toBeVisible({
    timeout: 30_000,
  });

  const amountInput = page.locator("#payment-amount");
  await expect(amountInput).toBeVisible({ timeout: 15_000 });
  if ((await amountInput.inputValue()).trim().length === 0) {
    await amountInput.fill("1000000");
  }
  const currencyInput = page.locator("#payment-currency");
  if ((await currencyInput.inputValue()).trim().length === 0) {
    await currencyInput.fill("IRR");
  }

  const createResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/finance/payments/manual") &&
      response.request().method() === "POST"
  );
  await page
    .getByTestId(FINANCE_PAYMENTS_TEST_IDS.createForm)
    .getByRole("button", { name: /Create pending manual payment|ثبت پرداخت دستی در انتظار/i })
    .click();
  const created = await createResponse;
  if (!created.ok()) {
    const createText = await created.text();
    expect(
      createText.includes("pending payment already exists for registration"),
      createText
    ).toBeTruthy();
  }

  const paymentsRes = await page.request.get(
    `/api/finance/payments?registrationId=${encodeURIComponent(input.registrationId)}&limit=20`
  );
  expect(paymentsRes.ok(), await paymentsRes.text()).toBeTruthy();
  const paymentsBody = (await paymentsRes.json()) as { items?: PaymentRow[] };
  const pendingManual =
    paymentsBody.items?.find(
      (row) =>
        row.registrationId === input.registrationId &&
        row.status === "Pending" &&
        row.method === "Manual" &&
        typeof row.id === "string" &&
        row.id.length > 0
    ) ?? null;
  expect(pendingManual, "pending manual payment required for receipt seed").not.toBeNull();

  const fileKey = `receipts/${input.registrationId}/p6-adm02-smoke-${Date.now()}.jpg`;
  const receiptRes = await page.request.post("/api/finance/receipts", {
    headers: { "Idempotency-Key": `p6-adm02-receipt-${input.registrationId}-${Date.now()}` },
    data: {
      paymentId: pendingManual!.id,
      fileKey,
    },
  });
  const receiptText = await receiptRes.text();
  expect(receiptRes.ok(), receiptText).toBeTruthy();
  const createdReceipt = parseFinanceReceiptCreateResponse(JSON.parse(receiptText));
  expect(createdReceipt?.id, receiptText).toBeTruthy();
  return { receiptId: createdReceipt!.id, fileKey };
}

test.describe("p6-operator-receipt-approve-smoke.spec.ts — P6 VS-07", () => {
  test("SMK-P6-ADM-02 pending member receipt → operator finance approve", async ({ page }) => {
    test.setTimeout(240_000);
    const tourId = resolveTourId();

    await loginDenaliOperatorOwner(page);

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const guestName = `P6 ADM02 ${stamp}`;
    const tourRes = await page.request.get(`/api/tours/${encodeURIComponent(tourId)}`);
    expect(tourRes.ok(), await tourRes.text()).toBeTruthy();
    const tourBody = (await tourRes.json()) as TourDetailResponse;
    const tourTitle = tourBody.projection?.title?.trim() ?? "";
    const departureAt = tourBody.projection?.departureAt?.trim() ?? "";
    expect(tourTitle.length, "published tour title required").toBeGreaterThan(0);
    expect(departureAt.length, "published tour departureAt required").toBeGreaterThan(0);

    const createBookingRes = await page.request.post("/api/bookings", {
      headers: { "Content-Type": "application/json" },
      data: {
        tourId,
        tourTitle,
        guestLabel: guestName,
        guestEmail: `p6-adm02-${stamp}@denali-smoke.local`,
        guestPhone: `+1555${stamp.replace(/\D/g, "").slice(-10).padStart(10, "0")}`,
        partySize: 2,
        departureAt,
        registrationIntake: { registrantTarget: "other" },
      },
    });
    expect(createBookingRes.ok(), await createBookingRes.text()).toBeTruthy();
    const createdBooking = (await createBookingRes.json()) as BookingCreateResponse;
    const registrationId = createdBooking.id?.trim() ?? "";
    expect(registrationId.length).toBeGreaterThan(0);

    const approveRes = await page.request.post(`/api/bookings/${registrationId}/approve`);
    expect(approveRes.ok(), await approveRes.text()).toBeTruthy();

    const overrideRes = await page.request.put(
      `/api/finance/registrations/${registrationId}/obligation-override`,
      {
        headers: { "Content-Type": "application/json" },
        data: {
          obligationMinor: "1000000",
          reason: "P6 ADM-02 finance receipt approve smoke",
        },
      }
    );
    expect(overrideRes.ok(), await overrideRes.text()).toBeTruthy();

    const { receiptId, fileKey } = await seedPendingReceiptForRegistration(page, {
      tourId,
      registrationId,
    });

    await expect
      .poll(
        async () => {
          const pending = await fetchPendingReceipts(page);
          return pending.items.some((item) => item.id === receiptId);
        },
        { timeout: 30_000 }
      )
      .toBe(true);

    await page.goto("/finance?tab=receipts", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(FINANCE_RECEIPTS_TEST_IDS.panel)).toBeVisible({
      timeout: 60_000,
    });

    const receiptRow = page.getByRole("listitem").filter({ hasText: guestName });
    await expect(receiptRow.getByTestId(FINANCE_RECEIPTS_TEST_IDS.reviewForm)).toBeVisible({
      timeout: 60_000,
    });

    await approveReceiptViaOperatorBff(page, receiptId);
    await expect
      .poll(
        async () => {
          const pending = await fetchPendingReceipts(page);
          return !pending.items.some((item) => item.id === receiptId || item.fileKey === fileKey);
        },
        { timeout: 15_000 }
      )
      .toBe(true);

    await page.screenshot({
      path: "/opt/cursor/artifacts/bqc-p6-adm02-receipt-approved.png",
      fullPage: true,
    });
  });
});
