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
import { OPERATOR_SMOKE_PUBLISHED_TOUR_ID } from "../../test/fixtures/p6-chain-guest-api";

const TOUR_ID = process.env.QA_TOUR_ID?.trim() || OPERATOR_SMOKE_PUBLISHED_TOUR_ID;

type OutstandingRow = {
  readonly registrationId?: string;
  readonly bookingPaymentStatus?: string;
};

type PaymentRow = {
  readonly id?: string;
  readonly status?: string;
  readonly method?: string;
  readonly registrationId?: string;
  readonly amount?: string;
  readonly currency?: string;
};

type BookingCreateResponse = {
  readonly id?: string;
  readonly status?: string;
};

type TourDetailResponse = {
  readonly projection?: {
    readonly title?: string | null;
    readonly departureAt?: string | null;
  };
};

function financeWorkspacePath(registrationId: string): string {
  return `/tours/${TOUR_ID}/workspace?tab=finance&focusRegistrationId=${encodeURIComponent(
    registrationId
  )}`;
}

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
  test("receipt-review CTA is prioritized when proof is already pending", async ({
    page,
    request,
  }) => {
    test.setTimeout(240_000);
    console.log("S6: login");
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });

    console.log("S6: fetch outstanding candidates");
    const outstandingRes = await page.request.get(
      `/api/finance/reports/outstanding-balances?tourId=${encodeURIComponent(TOUR_ID)}&limit=500`
    );
    expect(outstandingRes.ok(), await outstandingRes.text()).toBeTruthy();
    const outstandingBody = (await outstandingRes.json()) as { items?: OutstandingRow[] };
    const candidate =
      outstandingBody.items?.find(
        (row) =>
          (row.bookingPaymentStatus === "unpaid" || row.bookingPaymentStatus === "partial") &&
          typeof row.registrationId === "string" &&
          row.registrationId.trim().length > 0
      ) ?? null;

    let registrationId = candidate?.registrationId?.trim() ?? "";
    if (registrationId.length === 0) {
      const stamp = Date.now();
      const guestName = `Scenario6 Candidate ${stamp}`;
      console.log(`S6: create + approve fallback operator booking ${guestName}`);
      const tourRes = await page.request.get(`/api/tours/${encodeURIComponent(TOUR_ID)}`);
      expect(tourRes.ok(), await tourRes.text()).toBeTruthy();
      const tourBody = (await tourRes.json()) as TourDetailResponse;
      const tourTitle = tourBody.projection?.title?.trim() ?? "";
      const departureAt = tourBody.projection?.departureAt?.trim() ?? "";
      expect(tourTitle.length, "scenario6 fallback needs a tour title").toBeGreaterThan(0);
      expect(departureAt.length, "scenario6 fallback needs a tour departureAt").toBeGreaterThan(0);

      const createBookingRes = await page.request.post("/api/bookings", {
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          tourId: TOUR_ID,
          tourTitle,
          guestLabel: guestName,
          guestEmail: `scenario6-${stamp}@denali-smoke.local`,
          partySize: 2,
          departureAt,
        },
      });
      expect(createBookingRes.ok(), await createBookingRes.text()).toBeTruthy();
      const createdBooking = (await createBookingRes.json()) as BookingCreateResponse;
      const seededBookingId = createdBooking.id?.trim() ?? "";
      expect(
        seededBookingId.length,
        "scenario6 fallback should create a booking id"
      ).toBeGreaterThan(0);

      console.log(`S6: approve fallback guest via BFF ${seededBookingId}`);
      const approveRes = await page.request.post(`/api/bookings/${seededBookingId}/approve`);
      expect(approveRes.ok(), await approveRes.text()).toBeTruthy();
      console.log(`S6: set fallback obligation override ${seededBookingId}`);
      const overrideRes = await page.request.put(
        `/api/finance/registrations/${seededBookingId}/obligation-override`,
        {
          headers: {
            "Content-Type": "application/json",
          },
          data: {
            obligationMinor: "1000000",
            reason: "Scenario 6 workspace finance follow-up seed",
          },
        }
      );
      expect(overrideRes.ok(), await overrideRes.text()).toBeTruthy();
      registrationId = seededBookingId;
    }

    console.log(`S6: using registration ${registrationId}`);
    expect(
      registrationId.length > 0,
      "need at least one unpaid/partial candidate on smoke tour"
    ).toBeTruthy();

    console.log("S6: create manual payment via BFF");
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
    if (!createManualRes.ok()) {
      const createManualText = await createManualRes.text();
      expect(
        createManualText.includes("pending payment already exists for registration"),
        createManualText
      ).toBeTruthy();
    }

    console.log("S6: read manual payment");
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

    console.log(`S6: submit receipt for payment ${pendingManual!.id!}`);
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
    if (!submitReceiptRes.ok()) {
      const submitReceiptText = await submitReceiptRes.text();
      expect(
        submitReceiptText.includes("payment already has a pending receipt"),
        submitReceiptText
      ).toBeTruthy();
    }
    console.log("S6: wait for pending receipt visibility");
    await waitForPendingReceiptForRegistration(page, registrationId);

    console.log("S6: refresh workspace finance");
    await page.goto(financeWorkspacePath(registrationId), { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.detailPanel)).toBeVisible({
      timeout: 30_000,
    });

    console.log("S6: assert inline receipt review and hidden payment forms");
    await expect(
      page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.inlineReceiptReview)
    ).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId(FINANCE_RECEIPTS_TEST_IDS.reviewForm)).toBeVisible({
      timeout: 30_000,
    });

    await expect(page.getByTestId(FINANCE_PAYMENTS_TEST_IDS.createForm)).toHaveCount(0);
    await expect(page.getByTestId(FINANCE_PAYMENTS_TEST_IDS.receiptForm)).toHaveCount(0);
  });
});
