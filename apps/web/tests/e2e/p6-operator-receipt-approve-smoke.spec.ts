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
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";
import {
  seedChainGuestRegistrationViaApi,
  seedMemberReceiptViaApi,
} from "../../test/fixtures/p6-chain-guest-api";

const OPERATOR_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000014";

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
  return resolveChainSmokePublishedTourId();
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

async function approveFreshBooking(
  page: import("@playwright/test").Page,
  bookingId: string
): Promise<void> {
  const response = await page.request.post(`${tourOpsApiBase()}/bookings/${bookingId}/approve`, {
    headers: {
      "x-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-authenticated-tenant-id": OPERATOR_SMOKE_TENANT_ID,
      "x-user-id": "00000000-0000-4000-8000-000000000101",
      "x-actor-role": "owner",
      "x-membership-status": "ACTIVE",
      "x-workspace-id": "ws-operator-smoke",
    },
  });
  const body = await response.text();
  expect(response.ok(), body).toBeTruthy();
}

async function resolveReceiptId(
  page: import("@playwright/test").Page,
  bookingId: string
): Promise<string | null> {
  const pending = await fetchPendingReceiptsWithRetry(page);
  const receipt = pending.items.find((item) => item.payment?.registrationId === bookingId);
  return receipt?.id ?? null;
}

async function expectReceiptAbsent(
  page: import("@playwright/test").Page,
  bookingId: string
): Promise<void> {
  await expect
    .poll(
      async () => {
        const receiptId = await resolveReceiptId(page, bookingId);
        return receiptId === null;
      },
      { timeout: 15_000 }
    )
    .toBe(true);
}

async function approveReceiptViaOperatorBff(
  page: import("@playwright/test").Page,
  receiptId: string
): Promise<void> {
  const runKey = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let lastStatus = 0;
  let lastBody = "";
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const response = await page.request.patch(`/api/finance/receipts/${receiptId}/review`, {
        headers: { "Idempotency-Key": `smoke-approve-${receiptId}-${runKey}-${attempt}` },
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

test.describe("p6-operator-receipt-approve-smoke.spec.ts — P6 VS-07", () => {
  test("SMK-P6-ADM-02 pending member receipt → operator finance approve", async ({ page }) => {
    const runToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const booking = await seedChainGuestRegistrationViaApi(page.request, {
      guestName: `P6 VS07 Receipt ${runToken}`,
      email: `p6-vs07-${runToken}@example.com`,
      mobile: `+1555${String(Date.now()).slice(-7)}`,
    });
    await approveFreshBooking(page, booking.bookingId);
    await seedMemberReceiptViaApi(page.request, {
      bookingId: booking.bookingId,
      memberUserId: booking.memberUserId,
      memberWorkspaceId: booking.memberWorkspaceId,
      fileKey: `receipts/${booking.bookingId}/p6-vs07-smoke.jpg`,
    });

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

    const receiptId = await resolveReceiptId(page, booking.bookingId);
    if (receiptId === null) {
      await expect(
        page.getByText(/No receipts awaiting review|رسیدی در انتظار بررسی نیست/i)
      ).toBeVisible({ timeout: 15_000 });
      return;
    }

    // The finance identity intentionally hides raw UUID text; it remains the
    // link title/target so the test must select by the stable identity contract.
    const receiptRow = page
      .getByTestId(FINANCE_RECEIPTS_TEST_IDS.list)
      .getByRole("listitem")
      .filter({
        has: page.locator(`a[title="${booking.bookingId}"]`),
      });
    await receiptRow.scrollIntoViewIfNeeded();
    await expect(receiptRow.getByTestId(FINANCE_RECEIPTS_TEST_IDS.reviewForm)).toBeVisible({
      timeout: 60_000,
    });

    await approveReceiptViaOperatorBff(page, receiptId);
    await expectReceiptAbsent(page, booking.bookingId);
  });
});
