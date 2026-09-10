/**
 * Phase 3 — Journey E booking confidence (browser + public API seams).
 *
 * E01 approve happy path already covered by P6-VS-CHAIN-B01 / SMK-P9-04 — not duplicated.
 * E02: maxPartySize gate via public registration API (tour occupancy SoT is host/package).
 * E03: guest seed → operator reject → terminal rejected.
 *
 * @see TEMP/DENALI_PHASE_3_WAVE2_BOOKING_E2E_DESIGN.md
 * @see TEMP/DENALI_PHASE_3_JOURNEY_INVENTORY.md (P3-E2E-E01–E03)
 */
import { expect, test } from "@playwright/test";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../src/features/bookings/bookings-command-center-types";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";
import {
  OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
  OPERATOR_SMOKE_TENANT_ID,
  seedChainGuestRegistrationViaApi,
  tourOpsApiBase,
} from "../../test/fixtures/p6-chain-guest-api";

/** Align with packages/workspaces/denali DEFAULT_DENALI_CAPACITY_RULE.maxPartySize */
const DENALI_MAX_PARTY_SIZE = 20;

test.describe("denali-booking-confidence.spec.ts — Phase 3 E02/E03", () => {
  test("P3-E2E-E02 registration partySize over maxPartySize is rejected (API)", async ({
    request,
  }) => {
    const stamp = Date.now();
    const res = await request.post(`${tourOpsApiBase()}/denali/registrations`, {
      headers: {
        "x-tenant-id": OPERATOR_SMOKE_TENANT_ID,
        "content-type": "application/json",
      },
      data: {
        tourId: OPERATOR_SMOKE_PUBLISHED_TOUR_ID,
        contact: {
          email: `p3-e02-${stamp}@denali-smoke.local`,
          fullName: `P3 E02 Overflow ${stamp}`,
        },
        partySize: DENALI_MAX_PARTY_SIZE + 1,
      },
    });

    expect(res.status(), await res.text()).toBe(400);
    const body = (await res.json()) as {
      error?: { code?: string; message?: string };
    };
    const code = body.error?.code ?? "";
    const message = body.error?.message ?? JSON.stringify(body);
    expect(
      code === "BOOKING_VALIDATION_REJECTED" ||
        /BOOKING_VALIDATION_REJECTED|partySize must be <=/i.test(message)
    ).toBeTruthy();
  });

  test("P3-E2E-E03 guest register → operator reject → terminal rejected", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const guestName = `P3 E03 Reject ${stamp}`;
    const booking = await seedChainGuestRegistrationViaApi(request, {
      guestName,
      email: `p3-e03-${stamp}@denali-smoke.local`,
      mobile: `+1555${String(stamp).slice(-7)}`,
    });

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto("/bookings", { waitUntil: "domcontentloaded", timeout: 180_000 });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 15_000,
    });

    // The row may also render an inline-approve button with the guest name in its aria-label.
    // Select the row's primary inspection button explicitly so strict mode cannot click the
    // action affordance by accident.
    const selectedRow = page.locator("[data-booking-row]").filter({ hasText: guestName }).first();
    const detailResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/bookings/${booking.bookingId}`) &&
        response.request().method() === "GET"
    );
    await selectedRow
      .locator('button:not([data-testid="operator-bookings-inline-approve"])')
      .first()
      .click();
    await expect(selectedRow).toHaveAttribute("aria-selected", "true", { timeout: 15_000 });
    expect((await detailResponse).status()).toBe(200);
    const inspection = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection);
    const rejectButton = inspection.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectButton);
    await expect(rejectButton).toBeVisible({ timeout: 15_000 });
    await expect(rejectButton).toBeEnabled({ timeout: 15_000 });

    const rejectResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/bookings/") &&
        response.url().includes("/reject") &&
        response.request().method() === "POST"
    );
    await rejectButton.click();
    const rejectDialog = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectDialog);
    await expect(rejectDialog).toBeVisible({ timeout: 15_000 });
    // The active Denali manifest requires a rejection reason; fill it explicitly so the
    // confirm action is valid under both required and optional-reason configurations.
    await rejectDialog.locator("input").fill("P3 E03 test rejection");
    await rejectDialog.getByRole("button", { name: /reject|رد/i }).click();
    const rejectResult = await rejectResponse;
    expect(rejectResult.ok(), await rejectResult.text()).toBeTruthy();

    // The default queue excludes terminal rejected rows; assert removal from the active queue.
    await expect(page.locator("[data-booking-row]").filter({ hasText: guestName })).toHaveCount(0, {
      timeout: 15_000,
    });
  });

  test("P3-E2E-E04 operator waitlists a booking and approves it from the queue", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const guestName = `P3 E04 Waitlist ${stamp}`;
    const booking = await seedChainGuestRegistrationViaApi(request, {
      guestName,
      email: `p3-e04-${stamp}@denali-smoke.local`,
      mobile: `+1555${String(stamp).slice(-7)}`,
    });

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto("/bookings", { waitUntil: "domcontentloaded", timeout: 180_000 });
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
      timeout: 15_000,
    });

    const row = page
      .locator('[data-booking-row] button:not([data-testid="operator-bookings-inline-approve"])')
      .filter({ hasText: guestName })
      .first();
    const detailResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/bookings/${booking.bookingId}`) &&
        response.request().method() === "GET"
    );
    await row.click();
    await expect(row.locator("xpath=ancestor::*[@data-booking-row][1]")).toHaveAttribute(
      "aria-selected",
      "true",
      {
        timeout: 15_000,
      }
    );
    expect((await detailResponse).status()).toBe(200);
    const waitlistResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/bookings/") &&
        response.url().includes("/waitlist") &&
        response.request().method() === "POST"
    );
    const inspection = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection);
    const waitlistButton = inspection.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.waitlistButton);
    await expect(waitlistButton).toBeVisible({ timeout: 15_000 });
    await expect(waitlistButton).toBeEnabled({ timeout: 15_000 });
    await waitlistButton.click();
    const waitlistResult = await waitlistResponse;
    expect(waitlistResult.url()).toContain(`/api/bookings/${booking.bookingId}/waitlist`);
    expect(waitlistResult.status(), await waitlistResult.text()).toBe(200);

    await expect(row).toBeVisible({ timeout: 15_000 });
    await row.click();
    const approveResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/bookings/") &&
        response.url().includes("/approve") &&
        response.request().method() === "POST"
    );
    const approveButton = inspection.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton);
    await expect(approveButton).toBeVisible({ timeout: 15_000 });
    await expect(approveButton).toBeEnabled({ timeout: 15_000 });
    await approveButton.click();
    const approveResult = await approveResponse;
    expect(approveResult.url()).toContain(`/api/bookings/${booking.bookingId}/approve`);
    expect(approveResult.status(), await approveResult.text()).toBe(200);
  });
});
