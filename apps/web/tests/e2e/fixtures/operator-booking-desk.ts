/**
 * Operator booking desk helpers — TC-BOOK-* (Denali postgres smoke).
 */
import { expect, type Page } from "@playwright/test";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../../src/features/bookings/bookings-command-center-types";
import { loginDenaliOperatorOwner } from "./authenticate-denali-operator-for-engagement";

export const DENALI_SMOKE_TENANT_ID = "00000000-0000-4000-8000-000000000003";
export const DENALI_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000220";
export const DENALI_PUBLISHED_TOUR_TITLE = "North Ridge Trek";

export function tourOpsApiBase(): string {
  return (process.env.TOUR_OPS_API_URL ?? "http://127.0.0.1:3001").replace(/\/$/, "");
}

export async function captureBookingDeskArtifact(
  page: Page,
  path: string,
): Promise<void> {
  try {
    await page.screenshot({ path, fullPage: true });
  } catch (error) {
    console.warn(`Booking desk artifact skipped (${path}):`, error);
  }
}

export async function loginDenaliBookings(page: Page): Promise<void> {
  await loginDenaliOperatorOwner(page);
}

export async function openBookingsInbox(page: Page): Promise<void> {
  await page.goto("/bookings", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inbox)).toBeVisible({
    timeout: 30_000,
  });
}

export async function selectBookingByGuest(
  page: Page,
  guestLabel: string,
  bookingId?: string,
): Promise<void> {
  const row = page
    .locator("[data-booking-row]")
    .filter({ hasText: new RegExp(guestLabel, "i") })
    .first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  const detailReady =
    bookingId !== undefined && bookingId.length > 0
      ? page.waitForResponse(
          (response) => response.url().includes(`/api/bookings/${bookingId}`) && response.ok(),
        )
      : null;
  await row.locator(`[data-testid^="${BOOKINGS_COMMAND_CENTER_TEST_IDS.inboxRow}-"]`).click();
  if (detailReady !== null) {
    await detailReady;
  }
  const inspection = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection);
  await expect(inspection).toBeVisible({ timeout: 15_000 });
  await expect(inspection).toContainText(guestLabel, { timeout: 10_000 });
  await expect(
    inspection.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton),
  ).toBeVisible({ timeout: 15_000 });
}

export async function confirmOverbookIfVisible(page: Page): Promise<void> {
  const overbook = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.overbookConfirmDialog);
  if (await overbook.isVisible().catch(() => false)) {
    await overbook.getByRole("button", { name: /باز هم تأیید|overbook/i }).click();
  }
}

export async function clickApproveAndWait(page: Page, bookingId: string): Promise<void> {
  const inspection = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection);
  const approveBtn = inspection.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton);
  await expect(approveBtn).toBeVisible({ timeout: 15_000 });
  const approveResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/bookings/${bookingId}/approve`) &&
      response.request().method() === "POST",
  );
  await approveBtn.click();
  await confirmOverbookIfVisible(page);
  const res = await approveResponse;
  expect(res.ok(), await res.text()).toBeTruthy();
  await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNotice)).toBeVisible({
    timeout: 30_000,
  });
}

export async function clickApproveWithoutPaymentAndWait(
  page: Page,
  bookingId: string,
): Promise<void> {
  const inspection = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection);
  const approveBtn = inspection.getByTestId(
    BOOKINGS_COMMAND_CENTER_TEST_IDS.approveWithoutPaymentButton,
  );
  await expect(approveBtn).toBeVisible({ timeout: 15_000 });
  const approveResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/bookings/${bookingId}/approve`) &&
      response.request().method() === "POST",
  );
  const overrideResponse = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/finance/registrations/${bookingId}/obligation-override`) &&
      response.request().method() === "PUT",
  );
  await approveBtn.click();
  await confirmOverbookIfVisible(page);
  const approveRes = await approveResponse;
  expect(approveRes.ok(), await approveRes.text()).toBeTruthy();
  const overrideRes = await overrideResponse;
  expect(overrideRes.ok(), await overrideRes.text()).toBeTruthy();
  await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNotice)).toBeVisible({
    timeout: 30_000,
  });
}

export async function clickRejectAndWait(page: Page, bookingId: string): Promise<void> {
  const inspection = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection);
  await inspection.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectButton).click();
  await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectDialog)).toBeVisible({
    timeout: 10_000,
  });
  await page
    .getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectDialog)
    .getByRole("button", { name: /تأیید رد|reject confirm/i })
    .click();
  await expect
    .poll(
      async () => {
        const res = await page.request.get(`/api/bookings/${bookingId}`);
        if (!res.ok()) {
          return null;
        }
        const body = (await res.json()) as { status?: string };
        return body.status ?? null;
      },
      { timeout: 60_000 },
    )
    .toBe("rejected");
  await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNotice)).toBeVisible({
    timeout: 30_000,
  });
}

export async function seedDenaliGuestRegistration(
  page: Page,
  input: { guestName: string; email: string; partySize?: number; tourId?: string },
): Promise<string> {
  const res = await page.request.post(`${tourOpsApiBase()}/denali/registrations`, {
    headers: {
      "x-tenant-id": DENALI_SMOKE_TENANT_ID,
      "content-type": "application/json",
    },
    data: {
      tourId: input.tourId ?? DENALI_PUBLISHED_TOUR_ID,
      contact: { email: input.email, fullName: input.guestName },
      partySize: input.partySize ?? 2,
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  const body = (await res.json()) as { data?: { id?: string } };
  const bookingId = body.data?.id?.trim() ?? "";
  expect(bookingId.length).toBeGreaterThan(0);
  return bookingId;
}
