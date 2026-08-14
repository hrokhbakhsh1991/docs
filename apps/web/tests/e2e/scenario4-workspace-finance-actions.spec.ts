/**
 * Manual QA — Scenario 4: payment follow-up detail exposes action surfaces inside workspace.
 * Verifies registration-scoped payment actions without leaving the tour workspace.
 */
import { expect, test } from "@playwright/test";

import { BOOKING_FINANCIAL_STRIP_TEST_IDS } from "../../src/finance/booking-financial-strip-logic";
import { FINANCE_PAYMENTS_TEST_IDS } from "../../src/finance/finance-payments-logic";
import { TOUR_WORKSPACE_FINANCE_TEST_IDS } from "../../src/features/tours/tour-workspace-finance-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "../../src/features/tours/tour-workspace-types";
import { OPERATOR_SMOKE_PUBLISHED_TOUR_ID } from "../../test/fixtures/p6-chain-guest-api";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";

const TOUR_ID = process.env.QA_TOUR_ID?.trim() || OPERATOR_SMOKE_PUBLISHED_TOUR_ID;

type OutstandingRow = {
  readonly registrationId?: string;
  readonly bookingPaymentStatus?: string;
};

type PendingReceiptRow = {
  readonly payment?: {
    readonly registrationId?: string;
  } | null;
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

function financeWorkspacePath(registrationId: string): string {
  return `/tours/${TOUR_ID}/workspace?tab=finance&focusRegistrationId=${encodeURIComponent(
    registrationId
  )}`;
}

test.describe("scenario-4 workspace finance action surfaces", () => {
  test("finance detail keeps payment actions inside workspace", async ({ page }) => {
    test.setTimeout(240_000);
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });

    const outstandingRes = await page.request.get(
      `/api/finance/reports/outstanding-balances?tourId=${encodeURIComponent(TOUR_ID)}&limit=50`
    );
    expect(outstandingRes.ok(), await outstandingRes.text()).toBeTruthy();
    const pendingReceiptsRes = await page.request.get(
      `/api/finance/receipts/pending?tourId=${encodeURIComponent(TOUR_ID)}&limit=50`
    );
    expect(pendingReceiptsRes.ok(), await pendingReceiptsRes.text()).toBeTruthy();
    const outstandingBody = (await outstandingRes.json()) as { items?: OutstandingRow[] };
    const pendingReceiptsBody = (await pendingReceiptsRes.json()) as {
      items?: PendingReceiptRow[];
    };
    const receiptBlockedRegistrationIds = new Set(
      (pendingReceiptsBody.items ?? [])
        .map((row) => row.payment?.registrationId?.trim() ?? "")
        .filter((registrationId) => registrationId.length > 0)
    );
    const outstandingCandidate =
      outstandingBody.items?.find(
        (row) =>
          (row.bookingPaymentStatus === "unpaid" || row.bookingPaymentStatus === "partial") &&
          typeof row.registrationId === "string" &&
          row.registrationId.trim().length > 0 &&
          !receiptBlockedRegistrationIds.has(row.registrationId.trim())
      ) ?? null;

    let registrationId = outstandingCandidate?.registrationId?.trim() ?? "";
    if (registrationId.length === 0) {
      const stamp = Date.now();
      const guestName = `Scenario4 Candidate ${stamp}`;
      const tourRes = await page.request.get(`/api/tours/${encodeURIComponent(TOUR_ID)}`);
      expect(tourRes.ok(), await tourRes.text()).toBeTruthy();
      const tourBody = (await tourRes.json()) as TourDetailResponse;
      const tourTitle = tourBody.projection?.title?.trim() ?? "";
      const departureAt = tourBody.projection?.departureAt?.trim() ?? "";
      expect(tourTitle.length, "scenario4 fallback needs a tour title").toBeGreaterThan(0);
      expect(departureAt.length, "scenario4 fallback needs a tour departureAt").toBeGreaterThan(0);

      const createBookingRes = await page.request.post("/api/bookings", {
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          tourId: TOUR_ID,
          tourTitle,
          guestLabel: guestName,
          guestEmail: `scenario4-${stamp}@denali-smoke.local`,
          partySize: 2,
          departureAt,
        },
      });
      expect(createBookingRes.ok(), await createBookingRes.text()).toBeTruthy();
      const createdBooking = (await createBookingRes.json()) as BookingCreateResponse;
      registrationId = createdBooking.id?.trim() ?? "";
      expect(
        registrationId.length,
        "scenario4 fallback should create a booking id"
      ).toBeGreaterThan(0);

      const approveRes = await page.request.post(`/api/bookings/${registrationId}/approve`);
      expect(approveRes.ok(), await approveRes.text()).toBeTruthy();
      const overrideRes = await page.request.put(
        `/api/finance/registrations/${registrationId}/obligation-override`,
        {
          headers: {
            "Content-Type": "application/json",
          },
          data: {
            obligationMinor: "1000000",
            reason: "Scenario 4 workspace finance actions seed",
          },
        }
      );
      expect(overrideRes.ok(), await overrideRes.text()).toBeTruthy();
    }

    expect(
      registrationId.length > 0,
      "need at least one unpaid/partial candidate on QA tour without a pending receipt"
    ).toBeTruthy();

    await page.goto(financeWorkspacePath(registrationId), { waitUntil: "domcontentloaded" });

    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.financePanel)).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.detailPanel)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId(BOOKING_FINANCIAL_STRIP_TEST_IDS.strip)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId(FINANCE_PAYMENTS_TEST_IDS.createForm)).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId("finance-submit-receipt-advanced")).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByTestId(FINANCE_PAYMENTS_TEST_IDS.receiptForm)).toBeHidden({
      timeout: 30_000,
    });
  });
});
