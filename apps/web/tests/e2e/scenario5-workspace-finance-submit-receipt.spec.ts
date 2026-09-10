/**
 * Manual QA — Scenario 5: create pending payment and submit receipt from the workspace finance detail.
 * Verifies that the operator can stay inside the tour workspace for the core unpaid/partial workflow.
 */
import { expect, test } from "@playwright/test";

import { FINANCE_PAYMENTS_TEST_IDS } from "../../src/finance/finance-payments-logic";
import { TOUR_WORKSPACE_FINANCE_TEST_IDS } from "../../src/features/tours/tour-workspace-finance-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "../../src/features/tours/tour-workspace-types";
import { OPERATOR_SMOKE_CHAIN_TOUR_ID } from "../../test/fixtures/p6-chain-guest-api";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";

const TOUR_ID = process.env.QA_TOUR_ID?.trim() || OPERATOR_SMOKE_CHAIN_TOUR_ID;

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

test.describe("scenario-5 workspace finance prepayment action", () => {
  test("operator can record a received amount without leaving workspace", async ({ page }) => {
    test.setTimeout(240_000);
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });

    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const guestName = `Scenario5 Candidate ${stamp}`;
    const tourRes = await page.request.get(`/api/tours/${encodeURIComponent(TOUR_ID)}`);
    expect(tourRes.ok(), await tourRes.text()).toBeTruthy();
    const tourBody = (await tourRes.json()) as TourDetailResponse;
    const tourTitle = tourBody.projection?.title?.trim() ?? "";
    const departureAt = tourBody.projection?.departureAt?.trim() ?? "";
    expect(tourTitle.length, "scenario5 seed needs a tour title").toBeGreaterThan(0);
    expect(departureAt.length, "scenario5 seed needs a tour departureAt").toBeGreaterThan(0);

    const createBookingRes = await page.request.post("/api/bookings", {
      headers: {
        "Content-Type": "application/json",
      },
      data: {
        tourId: TOUR_ID,
        tourTitle,
        guestLabel: guestName,
        guestEmail: `scenario5-${stamp}@denali-smoke.local`,
        guestPhone: `+1555${stamp.replace(/\D/g, "").slice(-10).padStart(10, "0")}`,
        partySize: 2,
        departureAt,
        registrationIntake: {
          registrantTarget: "other",
        },
      },
    });
    expect(createBookingRes.ok(), await createBookingRes.text()).toBeTruthy();
    const createdBooking = (await createBookingRes.json()) as BookingCreateResponse;
    const registrationId = createdBooking.id?.trim() ?? "";
    expect(registrationId.length, "scenario5 seed should create a booking id").toBeGreaterThan(0);

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
          reason: "Scenario 5 workspace finance receipt seed",
        },
      }
    );
    expect(overrideRes.ok(), await overrideRes.text()).toBeTruthy();

    await page.goto(financeWorkspacePath(registrationId), { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.financePanel)).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByTestId(FINANCE_PAYMENTS_TEST_IDS.createForm)).toBeVisible({
      timeout: 30_000,
    });

    const amountInput = page.locator(`#workspace-payment-amount-${registrationId}`);
    await expect(amountInput).toBeVisible({ timeout: 15_000 });
    await expect(amountInput).not.toHaveValue("", { timeout: 15_000 });

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/finance/prepayments") &&
        response.request().method() === "POST"
    );
    await page.getByRole("button", { name: /Record received amount|ثبت مبلغ واریزشده/i }).click();
    const created = await createResponse;
    expect(created.ok(), await created.text()).toBeTruthy();

    const actionBanner = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.paymentActionResult);
    await expect(actionBanner).toBeVisible({ timeout: 20_000 });
    await expect(actionBanner).toHaveAttribute("data-action-kind", "prepayment_recorded");
    await expect(page.getByTestId("finance-submit-receipt-advanced")).toHaveCount(0);
  });
});
