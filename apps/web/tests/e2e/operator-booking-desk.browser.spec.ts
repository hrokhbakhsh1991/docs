/**
 * TC-BOOK — Denali operator booking desk browser closure (W2).
 */
import { expect, test } from "@playwright/test";

import { OPERATOR_SEARCHABLE_SELECT_TEST_IDS } from "../../src/admin/patterns/operator-searchable-select";
import { BOOKINGS_CREATE_TEST_IDS } from "../../src/features/bookings/bookings-create-types";
import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../src/features/bookings/bookings-command-center-types";
import { TOUR_WORKSPACE_FINANCE_TEST_IDS } from "../../src/features/tours/tour-workspace-finance-logic";
import { TOUR_WORKSPACE_TEST_IDS } from "../../src/features/tours/tour-workspace-types";
import { FINANCE_PAYMENTS_TEST_IDS } from "../../src/finance/finance-payments-logic";
import {
  captureBookingDeskArtifact,
  clickApproveAndWait,
  clickApproveWithoutPaymentAndWait,
  clickRejectAndWait,
  DENALI_PUBLISHED_TOUR_ID,
  DENALI_PUBLISHED_TOUR_TITLE,
  loginDenaliBookings,
  openBookingsInbox,
  selectBookingByGuest,
  seedDenaliGuestRegistration,
} from "./fixtures/operator-booking-desk";

test.describe("operator booking desk — TC-BOOK", () => {
  test.setTimeout(180_000);

  test("TC-BOOK-01 manual create → pending unpaid", async ({ page }) => {
    const guestLabel = `BQC Manual ${Date.now()}`;
    await loginDenaliBookings(page);
    const toursReady = page.waitForResponse(
      (response) => response.url().includes("/api/tours") && response.ok(),
    );
    await page.goto("/bookings/new", { waitUntil: "domcontentloaded" });
    await toursReady;
    await expect(page.getByTestId(BOOKINGS_CREATE_TEST_IDS.page)).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId(BOOKINGS_CREATE_TEST_IDS.tourSelect)).toBeVisible({
      timeout: 60_000,
    });

    await page.getByTestId(OPERATOR_SEARCHABLE_SELECT_TEST_IDS.trigger).click();
    await page.getByTestId(OPERATOR_SEARCHABLE_SELECT_TEST_IDS.search).fill("North Ridge");
    await page.getByRole("option", { name: new RegExp(DENALI_PUBLISHED_TOUR_TITLE, "i") }).click();
    await page.getByTestId(BOOKINGS_CREATE_TEST_IDS.guestInput).fill(guestLabel);
    await page.getByTestId(BOOKINGS_CREATE_TEST_IDS.submitButton).click();

    await expect(page).toHaveURL(/\/bookings/, { timeout: 30_000 });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inbox)).toContainText(
      guestLabel,
    );
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inbox)).toContainText(
      /pending|در انتظار/i,
    );
    await captureBookingDeskArtifact(page, "/opt/cursor/artifacts/booking-01-manual-pending.png");
  });

  test("TC-BOOK-02 guest register → approve (payment required)", async ({ page }) => {
    const stamp = Date.now();
    const guestName = `BQC Approve ${stamp}`;
    await loginDenaliBookings(page);
    const bookingId = await seedDenaliGuestRegistration(page, {
      guestName,
      email: `bqc-approve-${stamp}@denali.local`,
    });

    await page.goto("/bookings", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 60_000,
    });
    await selectBookingByGuest(page, guestName, bookingId);
    await clickApproveAndWait(page, bookingId);

    const bookingRes = await page.request.get(`/api/bookings/${bookingId}`);
    expect(bookingRes.ok(), await bookingRes.text()).toBeTruthy();
    const bookingBody = (await bookingRes.json()) as { status?: string; paymentStatus?: string };
    expect(bookingBody.status).toBe("approved");
    expect(bookingBody.paymentStatus).toBe("unpaid");
    await expect(
      page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.paymentBadgeInspection),
    ).toHaveAttribute("data-payment-status", "unpaid");
    await captureBookingDeskArtifact(page, "/opt/cursor/artifacts/booking-02-approved-unpaid.png");
  });

  test("TC-BOOK-03 guest register → reject", async ({ page }) => {
    const stamp = Date.now();
    const guestName = `BQC Reject ${stamp}`;
    await loginDenaliBookings(page);
    const bookingId = await seedDenaliGuestRegistration(page, {
      guestName,
      email: `bqc-reject-${stamp}@denali.local`,
    });

    await page.goto("/bookings", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 60_000,
    });
    await selectBookingByGuest(page, guestName, bookingId);
    await clickRejectAndWait(page, bookingId);
    await captureBookingDeskArtifact(page, "/opt/cursor/artifacts/booking-03-rejected.png");
  });

  test("TC-BOOK-04 guest register → approve without payment", async ({ page }) => {
    const stamp = Date.now();
    const guestName = `BQC Free ${stamp}`;
    await loginDenaliBookings(page);
    const bookingId = await seedDenaliGuestRegistration(page, {
      guestName,
      email: `bqc-free-${stamp}@denali.local`,
    });

    await page.goto("/bookings", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 60_000,
    });
    await selectBookingByGuest(page, guestName, bookingId);
    await clickApproveWithoutPaymentAndWait(page, bookingId);

    const bookingRes = await page.request.get(`/api/bookings/${bookingId}`);
    expect(bookingRes.ok(), await bookingRes.text()).toBeTruthy();
    const bookingBody = (await bookingRes.json()) as { status?: string; paymentStatus?: string };
    expect(bookingBody.status).toBe("approved");
    expect(bookingBody.paymentStatus).toBe("paid");
    await captureBookingDeskArtifact(
      page,
      "/opt/cursor/artifacts/booking-04-approved-without-payment.png",
    );
  });

  test("TC-BOOK-05 approved booking → manual payment in workspace finance", async ({ page }) => {
    const stamp = Date.now();
    const guestName = `BQC Payment ${stamp}`;
    await loginDenaliBookings(page);

    const tourRes = await page.request.get(
      `/api/tours/${encodeURIComponent(DENALI_PUBLISHED_TOUR_ID)}`,
    );
    expect(tourRes.ok(), await tourRes.text()).toBeTruthy();
    const tourBody = (await tourRes.json()) as {
      projection?: { title?: string; departureAt?: string };
    };
    const tourTitle = tourBody.projection?.title?.trim() ?? DENALI_PUBLISHED_TOUR_TITLE;
    const departureAt = tourBody.projection?.departureAt?.trim() ?? "2026-12-25T08:00:00.000Z";

    const createRes = await page.request.post("/api/bookings", {
      headers: { "content-type": "application/json" },
      data: {
        tourId: DENALI_PUBLISHED_TOUR_ID,
        tourTitle,
        guestLabel: guestName,
        guestEmail: `bqc-pay-${stamp}@denali.local`,
        guestPhone: `+1555${String(stamp).slice(-10)}`,
        partySize: 2,
        departureAt,
        registrationIntake: { registrantTarget: "other" },
      },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const registrationId = ((await createRes.json()) as { id?: string }).id?.trim() ?? "";
    expect(registrationId.length).toBeGreaterThan(0);

    const approveRes = await page.request.post(`/api/bookings/${registrationId}/approve`);
    expect(approveRes.ok(), await approveRes.text()).toBeTruthy();

    const overrideRes = await page.request.put(
      `/api/finance/registrations/${registrationId}/obligation-override`,
      {
        headers: { "content-type": "application/json" },
        data: {
          obligationMinor: "500000",
          reason: "BQC booking payment seed",
        },
      },
    );
    expect(overrideRes.ok(), await overrideRes.text()).toBeTruthy();

    await page.goto(
      `/tours/${encodeURIComponent(DENALI_PUBLISHED_TOUR_ID)}/workspace?tab=finance&focusRegistrationId=${encodeURIComponent(registrationId)}`,
      { waitUntil: "domcontentloaded" },
    );
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.financePanel)).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByTestId(FINANCE_PAYMENTS_TEST_IDS.createForm)).toBeVisible({
      timeout: 30_000,
    });

    const amountInput = page.locator(`#workspace-payment-amount-${registrationId}`);
    await expect(amountInput).toBeVisible({ timeout: 15_000 });
    await expect(amountInput).not.toHaveValue("", { timeout: 30_000 });

    const createResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/finance/prepayments") &&
        response.request().method() === "POST",
      { timeout: 60_000 },
    );
    const submitBtn = page
      .getByTestId(FINANCE_PAYMENTS_TEST_IDS.createForm)
      .getByRole("button", { name: /Record received payment|ثبت مبلغ واریزشده/i });
    await expect(submitBtn).toBeVisible({ timeout: 15_000 });
    await submitBtn.click();
    const created = await createResponse;
    expect(created.ok(), await created.text()).toBeTruthy();
    const actionBanner = page.getByTestId(TOUR_WORKSPACE_FINANCE_TEST_IDS.paymentActionResult);
    await expect(actionBanner).toBeVisible({ timeout: 30_000 });
    await expect(actionBanner).toHaveAttribute("data-action-kind", "prepayment_recorded");

    const prepaymentsRes = await page.request.get(
      `/api/finance/prepayments?registrationId=${encodeURIComponent(registrationId)}&limit=20`,
    );
    expect(prepaymentsRes.ok(), await prepaymentsRes.text()).toBeTruthy();
    const prepayments = (await prepaymentsRes.json()) as {
      items?: Array<{ amountMinor?: string; registrationId?: string }>;
    };
    expect((prepayments.items ?? []).length).toBeGreaterThan(0);
    const recorded = prepayments.items?.find((row) => row.registrationId === registrationId);
    expect(recorded?.amountMinor).toBe("500000");

    const bookingAfterRes = await page.request.get(`/api/bookings/${registrationId}`);
    expect(bookingAfterRes.ok(), await bookingAfterRes.text()).toBeTruthy();
    const bookingAfter = (await bookingAfterRes.json()) as { paymentStatus?: string };
    expect(bookingAfter.paymentStatus).toBe("partial");

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByTestId(TOUR_WORKSPACE_TEST_IDS.financePanel)).toBeVisible({
      timeout: 60_000,
    });
    await captureBookingDeskArtifact(
      page,
      "/opt/cursor/artifacts/booking-05-manual-payment-created.png",
    );
  });

  test("TC-BOOK-06 inbox shows pending row after guest seed", async ({ page }) => {
    const stamp = Date.now();
    const guestName = `BQC Pending ${stamp}`;
    await loginDenaliBookings(page);
    await seedDenaliGuestRegistration(page, {
      guestName,
      email: `bqc-pending-${stamp}@denali.local`,
    });

    await openBookingsInbox(page);
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inboxColumnHeader)).toBeVisible();
    const row = page
      .locator("[data-booking-row]")
      .filter({ hasText: new RegExp(guestName, "i") })
      .first();
    await expect(row).toBeVisible({ timeout: 15_000 });
    await expect(row.locator("[data-operator-booking-row-status]")).toContainText(
      /pending|در انتظار/i,
    );
    await captureBookingDeskArtifact(page, "/opt/cursor/artifacts/booking-06-inbox-pending-row.png");
  });
});
