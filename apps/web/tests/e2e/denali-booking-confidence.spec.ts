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
  resolveChainSmokePublishedTourId,
  resolveChainSmokeTenantId,
  seedChainGuestRegistrationViaApi,
  tourOpsApiBase,
} from "../../test/fixtures/p6-chain-guest-api";
import { ensureTourHasApprovalCapacity } from "./fixtures/tour-workspace-smoke";

/** Align with packages/workspaces/denali DEFAULT_DENALI_CAPACITY_RULE.maxPartySize */
const DENALI_MAX_PARTY_SIZE = 20;
const DENALI_BOOKING_PAID_AUTO_TOUR_ID = "00000000-0000-4000-8000-000000000223";
const DENALI_BOOKING_FREE_MANUAL_TOUR_ID = "00000000-0000-4000-8000-000000000224";
const DENALI_BOOKING_FREE_AUTO_TOUR_ID = "00000000-0000-4000-8000-000000000225";
const DENALI_SMOKE_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000220";
const DENALI_BOOKING_PAID_AUTO_DISCOUNT_TOUR_ID = "00000000-0000-4000-8000-000000000226";
const DENALI_BOOKING_FREE_AUTO_DISCOUNT_TOUR_ID = "00000000-0000-4000-8000-000000000227";
const DENALI_BOOKING_PAID_MANUAL_DISCOUNT_TOUR_ID = "00000000-0000-4000-8000-000000000228";
const OPERATOR_SMOKE_MEMBER_USER_ID = "00000000-0000-4000-8000-000000000103";
const OPERATOR_SMOKE_MEMBER_WORKSPACE_ID = "ws-operator-smoke-member";
const DENALI_BOOKING_SCENARIO_TENANT_ID = "00000000-0000-4000-8000-000000000003";
const DENALI_BOOKING_SCENARIO_WORKSPACE_ID = "ws-denali-dev-member";
const isDenaliBrowserTarget = process.env.PLAYWRIGHT_BASE_URL?.includes("denali") === true;
const BOOKING_SCENARIO_TENANT_ID =
  process.env.DENALI_BOOKING_SCENARIO_TENANT_ID?.trim() ||
  (isDenaliBrowserTarget ? DENALI_BOOKING_SCENARIO_TENANT_ID : OPERATOR_SMOKE_TENANT_ID);
const BOOKING_SCENARIO_WORKSPACE_ID =
  process.env.DENALI_BOOKING_SCENARIO_WORKSPACE_ID?.trim() ||
  (isDenaliBrowserTarget
    ? DENALI_BOOKING_SCENARIO_WORKSPACE_ID
    : OPERATOR_SMOKE_MEMBER_WORKSPACE_ID);
const BOOKING_SCENARIO_CAPACITY_TOUR_ID =
  process.env.DENALI_BOOKING_SCENARIO_CAPACITY_TOUR_ID?.trim() ||
  (process.env.PLAYWRIGHT_BASE_URL?.includes("denali")
    ? DENALI_SMOKE_PUBLISHED_TOUR_ID
    : OPERATOR_SMOKE_PUBLISHED_TOUR_ID);
const BOOKING_SCENARIO_CHAIN_TOUR_ID =
  process.env.DENALI_BOOKING_SCENARIO_CHAIN_TOUR_ID?.trim() ||
  (process.env.PLAYWRIGHT_BASE_URL?.includes("denali")
    ? DENALI_BOOKING_FREE_MANUAL_TOUR_ID
    : undefined);

async function seedMemberRegistrationViaApi(
  request: import("@playwright/test").APIRequestContext,
  input: {
    readonly tourId: string;
    readonly guestName: string;
    readonly email: string;
    readonly phone: string;
  }
): Promise<{ readonly bookingId: string; readonly status: string }> {
  const response = await request.post(`${tourOpsApiBase()}/denali/registrations`, {
    headers: {
      "x-tenant-id": BOOKING_SCENARIO_TENANT_ID,
      "x-authenticated-tenant-id": BOOKING_SCENARIO_TENANT_ID,
      "x-user-id": OPERATOR_SMOKE_MEMBER_USER_ID,
      "x-actor-role": "member",
      "x-membership-status": "ACTIVE",
      "x-workspace-id": BOOKING_SCENARIO_WORKSPACE_ID,
      "content-type": "application/json",
    },
    data: {
      tourId: input.tourId,
      // Use an explicit other-guest target so the smoke remains rerunnable in
      // the long-lived in-memory operator server (self is unique per tour/user).
      registrantTarget: "other",
      contact: { fullName: input.guestName, email: input.email, phone: input.phone },
      partySize: 1,
    },
  });
  expect(response.status(), await response.text()).toBe(201);
  const body = (await response.json()) as { data?: { id?: string; status?: string } };
  expect(body.data?.id).toBeTruthy();
  expect(body.data?.status).toBeTruthy();
  return { bookingId: body.data!.id!, status: body.data!.status! };
}

test.describe("denali-booking-confidence.spec.ts — Phase 3 E02/E03", () => {
  test("P3-E2E-E02 registration partySize over maxPartySize is rejected (API)", async ({
    request,
  }) => {
    const stamp = Date.now();
    const res = await request.post(`${tourOpsApiBase()}/denali/registrations`, {
      headers: {
        "x-tenant-id": BOOKING_SCENARIO_TENANT_ID,
        "content-type": "application/json",
      },
      data: {
        tourId: BOOKING_SCENARIO_CAPACITY_TOUR_ID,
        contact: {
          email: `p3-e02-${stamp}@denali-smoke.local`,
          fullName: `P3 E02 Overflow ${stamp}`,
          phone: `+1555${String(stamp).slice(-7)}`,
        },
        partySize: DENALI_MAX_PARTY_SIZE + 1,
      },
    });

    expect(res.status(), await res.text()).toBe(400);
    const body = (await res.json()) as {
      code?: string;
      error?: string | { code?: string; message?: string };
    };
    const code =
      body.code ??
      (typeof body.error === "string" ? body.error.split(":", 1)[0] : body.error?.code);
    const message =
      typeof body.error === "string" ? body.error : (body.error?.message ?? JSON.stringify(body));
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
      tenantId: BOOKING_SCENARIO_TENANT_ID,
      ...(BOOKING_SCENARIO_CHAIN_TOUR_ID ? { tourId: BOOKING_SCENARIO_CHAIN_TOUR_ID } : {}),
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
      tenantId: BOOKING_SCENARIO_TENANT_ID,
      ...(BOOKING_SCENARIO_CHAIN_TOUR_ID
        ? { tourId: DENALI_BOOKING_PAID_MANUAL_DISCOUNT_TOUR_ID }
        : {}),
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

  test("DEN-BOOK-X-SURFACE member auto booking appears approved/unpaid in admin reservations", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const guestName = `Denali member auto ${stamp}`;
    const booking = await seedMemberRegistrationViaApi(request, {
      tourId: DENALI_BOOKING_PAID_AUTO_TOUR_ID,
      guestName,
      email: `denali-member-auto-${stamp}@denali-smoke.local`,
      phone: `+1555${String(stamp).slice(-7)}`,
    });
    expect(booking.status).toBe("approved");

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto("/bookings?status=all", { waitUntil: "domcontentloaded", timeout: 180_000 });
    const row = page.locator("[data-booking-row]").filter({ hasText: guestName }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(
      row.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.paymentBadgeInbox)
    ).toHaveAttribute("data-payment-status", "unpaid");

    const detailButton = row
      .locator('button:not([data-testid="operator-bookings-inline-approve"])')
      .first();
    await detailButton.click();
    const inspection = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection);
    await expect(inspection).toBeVisible({ timeout: 15_000 });
    await expect(
      inspection.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.paymentBadgeInspection)
    ).toHaveAttribute("data-payment-status", "unpaid");
    await expect(inspection).toContainText(/approved|تأیید[\s‌]*شده/i);
  });

  test("DEN-BOOK-X-SURFACE free auto booking appears approved without debt in admin reservations", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const guestName = `Denali free auto ${stamp}`;
    const booking = await seedMemberRegistrationViaApi(request, {
      tourId: DENALI_BOOKING_FREE_AUTO_TOUR_ID,
      guestName,
      email: `denali-free-auto-${stamp}@denali-smoke.local`,
      phone: `+1555${String(stamp).slice(-7)}`,
    });
    expect(booking.status).toBe("approved");

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto("/bookings?status=all", { waitUntil: "domcontentloaded", timeout: 180_000 });
    const row = page.locator("[data-booking-row]").filter({ hasText: guestName }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(
      row.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.paymentBadgeInbox)
    ).toHaveAttribute("data-payment-status", "paid");
    await expect(
      row.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.paymentBadgeInbox)
    ).toHaveAttribute("data-financial-display-state", "WAIVED");
    await row
      .locator('button:not([data-testid="operator-bookings-inline-approve"])')
      .first()
      .click();
    const inspection = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection);
    await expect(inspection).toBeVisible({ timeout: 15_000 });
    await expect(inspection).toContainText(/approved|تأیید شده/i);
  });

  test("DEN-BOOK-X-SURFACE free manual booking transitions pending to waived in admin reservations", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const guestName = `Denali free manual ${stamp}`;
    const booking = await seedMemberRegistrationViaApi(request, {
      tourId: DENALI_BOOKING_FREE_MANUAL_TOUR_ID,
      guestName,
      email: `denali-free-manual-${stamp}@denali-smoke.local`,
      phone: `+1555${String(stamp).slice(-7)}`,
    });
    expect(booking.status).toBe("pending");

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto("/bookings?status=all", { waitUntil: "domcontentloaded", timeout: 180_000 });
    const row = page.locator("[data-booking-row]").filter({ hasText: guestName }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(
      row.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.paymentBadgeInbox)
    ).toHaveAttribute("data-payment-status", "unpaid");
    await expect(
      row.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.paymentBadgeInbox)
    ).not.toHaveAttribute("data-financial-display-state");
    await expect(row).toContainText(/pending|در انتظار/i);

    await row
      .locator('button:not([data-testid="operator-bookings-inline-approve"])')
      .first()
      .click();
    const inspection = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection);
    await expect(inspection).toBeVisible({ timeout: 15_000 });
    const approveResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/bookings/${booking.bookingId}/approve`) &&
        response.request().method() === "POST"
    );
    await inspection.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton).click();
    const approved = await approveResponse;
    expect(approved.status(), await approved.text()).toBe(200);

    await page.reload({ waitUntil: "domcontentloaded" });
    const approvedRow = page.locator("[data-booking-row]").filter({ hasText: guestName }).first();
    await expect(approvedRow).toBeVisible({ timeout: 30_000 });
    await expect(
      approvedRow.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.paymentBadgeInbox)
    ).toHaveAttribute("data-payment-status", "paid");
    await expect(
      approvedRow.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.paymentBadgeInbox)
    ).toHaveAttribute("data-financial-display-state", "WAIVED");
  });

  test("DEN-BOOK-X-SURFACE member discount is frozen in the Denali invoice", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const guestName = `Denali discounted member ${stamp}`;
    const booking = await seedMemberRegistrationViaApi(request, {
      tourId: DENALI_BOOKING_PAID_AUTO_DISCOUNT_TOUR_ID,
      guestName,
      email: `denali-discount-${stamp}@denali-smoke.local`,
      phone: `+1555${String(stamp).slice(-7)}`,
    });
    expect(booking.status).toBe("approved");

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    const invoiceResponse = await page.request.get(
      `/api/finance/invoices/${encodeURIComponent(booking.bookingId)}`
    );
    expect(invoiceResponse.ok(), await invoiceResponse.text()).toBeTruthy();
    const invoice = (await invoiceResponse.json()) as {
      invoiceTotalMinor?: string;
      balanceDueMinor?: string;
    };
    // 2,500,000/person × 1 seat − the seeded 20% Denali member discount.
    expect(invoice.invoiceTotalMinor).toBe("2000000");
    expect(invoice.balanceDueMinor).toBe("2000000");

    await page.goto("/bookings?status=all", { waitUntil: "domcontentloaded", timeout: 180_000 });
    const row = page.locator("[data-booking-row]").filter({ hasText: guestName }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row).toContainText(/approved|تأیید[\s‌]*شده/i);
  });

  test("DEN-BOOK-X-SURFACE free member discount keeps zero obligation", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const guestName = `Denali free discounted member ${stamp}`;
    const booking = await seedMemberRegistrationViaApi(request, {
      tourId: DENALI_BOOKING_FREE_AUTO_DISCOUNT_TOUR_ID,
      guestName,
      email: `denali-free-discount-${stamp}@denali-smoke.local`,
      phone: `+1555${String(stamp).slice(-7)}`,
    });
    expect(booking.status).toBe("approved");

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    const invoiceResponse = await page.request.get(
      `/api/finance/invoices/${encodeURIComponent(booking.bookingId)}`
    );
    expect(invoiceResponse.ok(), await invoiceResponse.text()).toBeTruthy();
    const invoice = (await invoiceResponse.json()) as {
      invoiceTotalMinor?: string;
      balanceDueMinor?: string;
    };
    expect(invoice.invoiceTotalMinor).toBe("0");
    expect(invoice.balanceDueMinor).toBe("0");

    await page.goto("/bookings?status=all", { waitUntil: "domcontentloaded", timeout: 180_000 });
    const row = page.locator("[data-booking-row]").filter({ hasText: guestName }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(
      row.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.paymentBadgeInbox)
    ).toHaveAttribute("data-payment-status", "paid");
    await expect(
      row.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.paymentBadgeInbox)
    ).toHaveAttribute("data-financial-display-state", "WAIVED");
    await expect(row).toContainText(/approved|تأیید[\s‌]*شده/i);
  });

  test("DEN-BOOK-X-SURFACE manual approval freezes the member discount", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const guestName = `Denali manual discounted member ${stamp}`;
    const booking = await seedMemberRegistrationViaApi(request, {
      tourId: DENALI_BOOKING_PAID_MANUAL_DISCOUNT_TOUR_ID,
      guestName,
      email: `denali-manual-discount-${stamp}@denali-smoke.local`,
      phone: `+1555${String(stamp).slice(-7)}`,
    });
    expect(booking.status).toBe("pending");

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto("/bookings?status=all", { waitUntil: "domcontentloaded", timeout: 180_000 });
    const row = page.locator("[data-booking-row]").filter({ hasText: guestName }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row
      .locator('button:not([data-testid="operator-bookings-inline-approve"])')
      .first()
      .click();
    const inspection = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection);
    const approveResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/bookings/${booking.bookingId}/approve`) &&
        response.request().method() === "POST"
    );
    await inspection.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton).click();
    const approveResult = await approveResponse;
    expect(approveResult.status(), await approveResult.text()).toBe(200);

    const invoiceResponse = await page.request.get(
      `/api/finance/invoices/${encodeURIComponent(booking.bookingId)}`
    );
    expect(invoiceResponse.ok(), await invoiceResponse.text()).toBeTruthy();
    const invoice = (await invoiceResponse.json()) as {
      invoiceTotalMinor?: string;
      balanceDueMinor?: string;
    };
    expect(invoice.invoiceTotalMinor).toBe("2000000");
    expect(invoice.balanceDueMinor).toBe("2000000");
  });

  test("DEN-BOOK-X-SURFACE free auto cancellation is terminal and survives admin reload", async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const guestName = `Denali free cancel ${stamp}`;
    const booking = await seedMemberRegistrationViaApi(request, {
      tourId: DENALI_BOOKING_FREE_AUTO_TOUR_ID,
      guestName,
      email: `denali-free-cancel-${stamp}@denali-smoke.local`,
      phone: `+1555${String(stamp).slice(-7)}`,
    });
    expect(booking.status).toBe("approved");

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await page.goto("/bookings?status=all", { waitUntil: "domcontentloaded", timeout: 180_000 });
    const row = page.locator("[data-booking-row]").filter({ hasText: guestName }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await row
      .locator('button:not([data-testid="operator-bookings-inline-approve"])')
      .first()
      .click();

    const inspection = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection);
    await expect(inspection).toBeVisible({ timeout: 15_000 });
    const cancelResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/bookings/${booking.bookingId}/cancel`) &&
        response.request().method() === "POST"
    );
    await inspection.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.cancelButton).click();
    const dialog = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.cancelConfirmDialog);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.cancelConfirmButton).click();
    expect((await cancelResponse).status()).toBe(200);

    await expect(row).toContainText(/cancelled|لغو\s*شده|لغوشده/i, { timeout: 15_000 });
    await expect(inspection.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.cancelButton)).toHaveCount(
      0
    );

    await page.reload({ waitUntil: "domcontentloaded" });
    const reloadedRow = page.locator("[data-booking-row]").filter({ hasText: guestName }).first();
    await expect(reloadedRow).toBeVisible({ timeout: 30_000 });
    await expect(reloadedRow).toContainText(/cancelled|لغو\s*شده|لغوشده/i);
  });
});
