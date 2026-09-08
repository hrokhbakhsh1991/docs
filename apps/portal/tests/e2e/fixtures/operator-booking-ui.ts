/**
 * Operator bookings command-center UI helpers for cross-surface BOOK-BQC tests.
 * Requires @apps/web on operator.localhost:3000 (see smoke-portal-booking-e2e-servers.mjs).
 */
import { expect, type Browser, type Page } from "@playwright/test";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../../../web/src/features/bookings/bookings-command-center-types";
import { SESSION_TOKEN_COOKIE } from "../../../../web/src/auth/build-session-cookie";

const OPERATOR_WEB_BASE_URL =
  process.env.SMOKE_OPERATOR_WEB_BASE_URL ?? "http://operator.localhost:3000";
const OPERATOR_OWNER_MOBILE = "09174070937";
const DEV_OTP = "1234";

async function loginOperatorOwner(page: Page): Promise<void> {
  await page.context().clearCookies();

  const otpRes = await page.request.post("/api/auth/request-otp", {
    data: { phone: OPERATOR_OWNER_MOBILE },
    timeout: 120_000,
  });
  expect(otpRes.ok(), await otpRes.text()).toBeTruthy();
  const otpBody = (await otpRes.json()) as { challenge_id?: string };
  expect(typeof otpBody.challenge_id).toBe("string");

  const loginRes = await page.request.post("/api/auth/login-web-session", {
    data: {
      phone: OPERATOR_OWNER_MOBILE,
      otp: DEV_OTP,
      challenge_id: otpBody.challenge_id,
    },
    timeout: 120_000,
  });
  const loginText = await loginRes.text();
  expect(loginRes.ok(), loginText).toBeTruthy();
  const loginBody = JSON.parse(loginText) as { session_token?: string };
  expect(typeof loginBody.session_token).toBe("string");

  const cookieUrl = OPERATOR_WEB_BASE_URL.replace(/\/$/, "");
  await page.context().addCookies([
    {
      name: SESSION_TOKEN_COOKIE,
      value: loginBody.session_token!,
      url: cookieUrl,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

async function openOperatorBookingsInbox(page: Page): Promise<void> {
  await page.goto("/bookings", { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inbox)).toBeVisible({
    timeout: 60_000,
  });
}

async function selectBookingByGuestLabel(
  page: Page,
  guestLabel: string,
  bookingId: string,
): Promise<void> {
  const row = page.locator("[data-booking-row]").filter({ hasText: new RegExp(guestLabel, "i") }).first();
  await expect(row).toBeVisible({ timeout: 60_000 });
  const detailReady = page.waitForResponse(
    (response) => response.url().includes(`/api/bookings/${bookingId}`) && response.ok(),
  );
  await row.locator(`[data-testid^="${BOOKINGS_COMMAND_CENTER_TEST_IDS.inboxRow}-"]`).click();
  await detailReady;
  const inspection = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection);
  await expect(inspection).toBeVisible({ timeout: 30_000 });
  await expect(inspection).toContainText(guestLabel, { timeout: 15_000 });
}

async function confirmOverbookIfVisible(page: Page): Promise<void> {
  const overbook = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.overbookConfirmDialog);
  if (await overbook.isVisible().catch(() => false)) {
    await overbook.getByRole("button", { name: /باز هم تأیید|overbook/i }).click();
  }
}

export async function withOperatorBookingsUi(
  browser: Browser,
  run: (operatorPage: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({
    baseURL: OPERATOR_WEB_BASE_URL,
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();
  try {
    await loginOperatorOwner(page);
    await openOperatorBookingsInbox(page);
    await run(page);
  } finally {
    await context.close();
  }
}

export async function operatorApproveBookingViaUi(
  operatorPage: Page,
  input: { readonly guestLabel: string; readonly bookingId: string },
): Promise<void> {
  await selectBookingByGuestLabel(operatorPage, input.guestLabel, input.bookingId);
  const inspection = operatorPage.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection);
  const approveBtn = inspection.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.approveButton);
  await expect(approveBtn).toBeVisible({ timeout: 30_000 });
  const approveResponse = operatorPage.waitForResponse(
    (response) =>
      response.url().includes(`/api/bookings/${input.bookingId}/approve`) &&
      response.request().method() === "POST",
  );
  await approveBtn.click();
  await confirmOverbookIfVisible(operatorPage);
  const res = await approveResponse;
  expect(res.ok(), await res.text()).toBeTruthy();
  await expect(operatorPage.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNotice)).toBeVisible({
    timeout: 30_000,
  });
}

export async function operatorRejectBookingViaUi(
  operatorPage: Page,
  input: { readonly guestLabel: string; readonly bookingId: string },
): Promise<void> {
  await selectBookingByGuestLabel(operatorPage, input.guestLabel, input.bookingId);
  const inspection = operatorPage.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection);
  await inspection.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectButton).click();
  await expect(operatorPage.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectDialog)).toBeVisible({
    timeout: 15_000,
  });
  await operatorPage
    .getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.rejectDialog)
    .getByRole("button", { name: /تأیید رد|reject confirm/i })
    .click();
  await expect
    .poll(
      async () => {
        const res = await operatorPage.request.get(`/api/bookings/${input.bookingId}`);
        if (!res.ok()) {
          return null;
        }
        const body = (await res.json()) as { status?: string };
        return body.status ?? null;
      },
      { timeout: 60_000 },
    )
    .toBe("rejected");
  await expect(operatorPage.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.actionNotice)).toBeVisible({
    timeout: 30_000,
  });
}
