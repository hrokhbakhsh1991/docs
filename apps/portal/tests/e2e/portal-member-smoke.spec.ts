import { expect, test, type Browser, type Page } from "@playwright/test";

import { resolveOperatorSmokeOwnerMobile } from "../../../web/scripts/operator-smoke-identity.mjs";

import {
  DENALI_BOOKING_FREE_AUTO_TOUR_ID,
  DENALI_BOOKING_FREE_AUTO_DISCOUNT_TOUR_ID,
  DENALI_BOOKING_FREE_MANUAL_TOUR_ID,
  DENALI_BOOKING_PAID_AUTO_TOUR_ID,
  DENALI_BOOKING_PAID_AUTO_DISCOUNT_TOUR_ID,
  DENALI_BOOKING_PAID_MANUAL_DISCOUNT_TOUR_ID,
  OPERATOR_PUBLISHED_TOUR_TITLE,
  completePortalCatalogRegistration,
} from "./fixtures/complete-portal-registration";
import {
  openMemberRegistrationDetailByTitle,
  openMemberRegistrationsFromSuccess,
} from "./fixtures/portal-member-navigation";

const REGISTRATION_EMAIL = `smk-ptl-02-${Date.now()}@denali-smoke.local`;
const DEV_PHONE = `+1555${String(Date.now()).slice(-7)}`;
const cachedOperatorSessionTokens = new Map<string, string>();

async function createDenaliAdminPage(
  browser: Browser,
  baseURL = "http://admin.denali.localhost:3000"
): Promise<{
  readonly context: Awaited<ReturnType<Browser["newContext"]>>;
  readonly page: Page;
}> {
  const context = await browser.newContext({
    baseURL,
  });
  const page = await context.newPage();
  const sessionHost = new URL(baseURL).hostname;
  let operatorSessionToken = cachedOperatorSessionTokens.get(sessionHost);
  if (operatorSessionToken === undefined) {
    const operatorMobile = resolveOperatorSmokeOwnerMobile();
    const operatorOtp = process.env.OPERATOR_DEV_OTP?.trim() || "1234";
    const otpResponse = await page.request.post("/api/auth/request-otp", {
      data: { phone: operatorMobile },
    });
    expect(otpResponse.ok(), `operator OTP failed (${otpResponse.status()})`).toBeTruthy();
    const otpBody = (await otpResponse.json()) as { challenge_id?: string };
    expect(otpBody.challenge_id).toBeTruthy();
    const loginResponse = await page.request.post("/api/auth/login-web-session", {
      data: {
        phone: operatorMobile,
        otp: operatorOtp,
        challenge_id: otpBody.challenge_id,
      },
    });
    expect(loginResponse.ok(), `operator login failed (${loginResponse.status()})`).toBeTruthy();
    const loginBody = (await loginResponse.json()) as { session_token?: string };
    expect(loginBody.session_token).toBeTruthy();
    operatorSessionToken = loginBody.session_token;
    cachedOperatorSessionTokens.set(sessionHost, operatorSessionToken);
  }
  await context.addCookies([
    {
      name: "atour_op_session",
      value: operatorSessionToken,
      domain: sessionHost,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  return { context, page };
}

test("SMK-PTL-02 member /me lists registration after catalog intake (VS-04)", async ({ page }) => {
  await completePortalCatalogRegistration(page, {
    email: REGISTRATION_EMAIL,
    fullName: "Portal Member Smoke",
    phone: DEV_PHONE,
  });

  await openMemberRegistrationsFromSuccess(page);
  await expect(page.getByText(OPERATOR_PUBLISHED_TOUR_TITLE)).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("link", { name: OPERATOR_PUBLISHED_TOUR_TITLE })).toBeVisible({
    timeout: 60_000,
  });
});

test("SMK-PTL-05 portal home redirects authenticated member to /me/registrations", async ({
  page,
}) => {
  const email = `smk-ptl-05-${Date.now()}@denali-smoke.local`;
  const phone = `+1555${String(Date.now()).slice(-7)}`;

  await completePortalCatalogRegistration(page, {
    email,
    fullName: "Portal Home Redirect Smoke",
    phone,
  });

  await page.goto("/");
  await expect(page).toHaveURL(/\/me\/registrations/, { timeout: 60_000 });
  await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({
    timeout: 60_000,
  });
});

const RECEIPT_EMAIL = `smk-ptl-04-${Date.now()}@denali-smoke.local`;
const RECEIPT_PHONE = `+1555${String(Date.now()).slice(-7)}`;

test("SMK-PTL-04 member detail awaits club approval before receipt upload (approve-then-pay)", async ({
  page,
}) => {
  await completePortalCatalogRegistration(page, {
    email: RECEIPT_EMAIL,
    fullName: "Portal Receipt Smoke",
    phone: RECEIPT_PHONE,
  });

  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, OPERATOR_PUBLISHED_TOUR_TITLE);
  await expect(page.locator("[data-portal-member-receipt-awaiting-approval]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-portal-member-receipt-upload]")).toHaveCount(0);
  await expect(page.locator("[data-portal-member-receipt-submit]")).toHaveCount(0);
  await expect(page.locator("[data-portal-member-receipt-back-trips]")).toBeVisible();
});

test("DEN-BOOK-CORE free manual booking remains pending without payment CTA", async ({ page }) => {
  const title = "Denali free manual booking";
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_FREE_MANUAL_TOUR_ID,
    email: `den-book-free-manual-${Date.now()}@denali-smoke.local`,
    fullName: "Denali Free Manual",
    phone: `+1555${String(Date.now()).slice(-7)}`,
  });
  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, title);
  await expect(page.locator("[data-portal-member-receipt-awaiting-approval]")).toBeVisible();
  await expect(page.locator("[data-portal-member-receipt-upload]")).toHaveCount(0);
});

test("DEN-BOOK-CORE free manual approval reaches waived member state", async ({
  page,
  browser,
}) => {
  const phone = `+1555${String(Date.now()).slice(-7)}`;
  const memberName = `Denali Free Manual Approve ${phone.replace(/\D/g, "").slice(-6)}`;
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_FREE_MANUAL_TOUR_ID,
    email: `den-book-free-manual-approve-${Date.now()}@denali-smoke.local`,
    fullName: "Denali Free Manual Approve",
    phone,
  });
  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, "Denali free manual booking");
  await expect(page.locator("[data-portal-member-receipt-awaiting-approval]")).toBeVisible();
  const registrationMatch = page.url().match(/\/me\/registrations\/([^/?#]+)/);
  expect(registrationMatch?.[1], "member detail URL must expose registration id").toBeTruthy();
  const registrationId = registrationMatch![1]!;

  const { context: adminContext, page: adminPage } = await createDenaliAdminPage(browser);
  try {
    await adminPage.goto("/bookings?status=all", { waitUntil: "domcontentloaded" });
    const bookingRow = adminPage.locator("[data-booking-row]").filter({ hasText: memberName });
    await expect(bookingRow).toBeVisible({ timeout: 60_000 });
    await bookingRow
      .locator('button:not([data-testid="operator-bookings-inline-approve"])')
      .first()
      .click();
    const inspection = adminPage.getByTestId("operator-bookings-inspection");
    await expect(inspection.getByTestId("operator-bookings-approve")).toBeVisible({
      timeout: 30_000,
    });
    const approved = await adminPage.request.post(
      `/api/bookings/${encodeURIComponent(registrationId)}/approve`
    );
    expect(approved.status(), await approved.text()).toBe(200);
  } finally {
    await adminContext.close();
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-portal-member-receipt-waived]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-portal-member-receipt-upload]")).toHaveCount(0);
});

test("DEN-BOOK-CORE free auto booking is approved and waived", async ({ page }) => {
  const title = "Denali free auto booking";
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_FREE_AUTO_TOUR_ID,
    email: `den-book-free-auto-${Date.now()}@denali-smoke.local`,
    fullName: "Denali Free Auto",
    phone: `+1555${String(Date.now()).slice(-7)}`,
  });
  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, title);
  await expect(page.locator("[data-portal-member-registration-detail]")).toHaveAttribute(
    "data-portal-member-registrant-target",
    "self"
  );
  await expect(page.locator("[data-portal-member-receipt-waived]")).toBeVisible();
});

test("DEN-BOOK-CORE free auto member discount remains waived", async ({ page }) => {
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_FREE_AUTO_DISCOUNT_TOUR_ID,
    email: `den-book-free-discount-${Date.now()}@denali-smoke.local`,
    fullName: "Denali Free Discount",
    phone: `+1555${String(Date.now()).slice(-7)}`,
  });
  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, "Denali free auto member discount");
  await expect(page.locator("[data-portal-member-receipt-waived]")).toBeVisible();
  await expect(page.locator("[data-portal-member-receipt-upload]")).toHaveCount(0);
});

test("DEN-BOOK-CORE eligible member on a closed discount gate pays canonical price", async ({
  page,
  browser,
}) => {
  const stamp = Date.now();
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_PAID_AUTO_TOUR_ID,
    email: `den-book-gate-off-${stamp}@denali-smoke.local`,
    fullName: `Denali Gate Off ${stamp}`,
    phone: "+15550001003",
    guestPhone: `+1555${String(stamp).slice(-7)}`,
    nationalId: String(stamp).slice(-10).padStart(10, "0"),
    registrantTarget: "other",
  });
  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, "Denali paid auto booking");
  await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible();
  const registrationMatch = page.url().match(/\/me\/registrations\/([^/?#]+)/);
  expect(registrationMatch?.[1], "member detail URL must expose registration id").toBeTruthy();
  const registrationId = registrationMatch![1]!;

  const { context: adminContext, page: adminPage } = await createDenaliAdminPage(browser);
  try {
    const invoiceResponse = await adminPage.request.get(
      `/api/finance/invoices/${encodeURIComponent(registrationId)}`
    );
    expect(invoiceResponse.ok(), await invoiceResponse.text()).toBeTruthy();
    const invoice = (await invoiceResponse.json()) as { invoiceTotalMinor?: string };
    expect(invoice.invoiceTotalMinor).toBe("2500000");
  } finally {
    await adminContext.close();
  }
});

test("DEN-BOOK-CORE non-member on an open discount gate pays canonical price", async ({
  page,
  browser,
}) => {
  const stamp = Date.now();
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_PAID_AUTO_DISCOUNT_TOUR_ID,
    email: `den-book-non-member-${stamp}@denali-smoke.local`,
    fullName: `Denali Non Member ${stamp}`,
    phone: `+1555${String(stamp).slice(-7)}`,
  });
  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, "Denali paid auto member discount");
  await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible();
  const registrationMatch = page.url().match(/\/me\/registrations\/([^/?#]+)/);
  expect(registrationMatch?.[1], "member detail URL must expose registration id").toBeTruthy();
  const registrationId = registrationMatch![1]!;

  const { context: adminContext, page: adminPage } = await createDenaliAdminPage(browser);
  try {
    const invoiceResponse = await adminPage.request.get(
      `/api/finance/invoices/${encodeURIComponent(registrationId)}`
    );
    expect(invoiceResponse.ok(), await invoiceResponse.text()).toBeTruthy();
    const invoice = (await invoiceResponse.json()) as { invoiceTotalMinor?: string };
    expect(invoice.invoiceTotalMinor).toBe("2500000");
  } finally {
    await adminContext.close();
  }
});

test("DEN-BOOK-CORE wrong-tenant admin cannot read a Denali invoice", async ({ page, browser }) => {
  const stamp = Date.now();
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_PAID_AUTO_DISCOUNT_TOUR_ID,
    email: `den-book-wrong-tenant-${stamp}@denali-smoke.local`,
    fullName: `Denali Wrong Tenant ${stamp}`,
    phone: `+1555${String(stamp).slice(-7)}`,
  });
  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, "Denali paid auto member discount");
  const registrationMatch = page.url().match(/\/me\/registrations\/([^/?#]+)/);
  expect(registrationMatch?.[1], "member detail URL must expose registration id").toBeTruthy();
  const registrationId = registrationMatch![1]!;

  const { context: wrongTenantContext, page: wrongTenantPage } = await createDenaliAdminPage(
    browser,
    "http://admin.operator.localhost:3000"
  );
  try {
    const invoiceResponse = await wrongTenantPage.request.get(
      `/api/finance/invoices/${encodeURIComponent(registrationId)}`
    );
    expect(invoiceResponse.status(), await invoiceResponse.text()).toBe(404);
  } finally {
    await wrongTenantContext.close();
  }
});

test("DEN-BOOK-CORE admin cancellation reaches the member terminal state", async ({
  page,
  browser,
}) => {
  const phone = `+1555${String(Date.now()).slice(-7)}`;
  const memberName = `Denali Free Cancel ${phone.replace(/\D/g, "").slice(-6)}`;
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_FREE_AUTO_TOUR_ID,
    email: `den-book-free-cancel-${Date.now()}@denali-smoke.local`,
    fullName: "Denali Free Cancel",
    phone,
  });
  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, "Denali free auto booking");
  const registrationMatch = page.url().match(/\/me\/registrations\/([^/?#]+)/);
  expect(registrationMatch?.[1], "member detail URL must expose registration id").toBeTruthy();
  const registrationId = registrationMatch![1]!;

  const { context: adminContext, page: adminPage } = await createDenaliAdminPage(browser);
  try {
    await adminPage.goto("/bookings?status=all", { waitUntil: "domcontentloaded" });
    const bookingRow = adminPage.locator("[data-booking-row]").filter({ hasText: memberName });
    await expect(bookingRow).toBeVisible({ timeout: 60_000 });
    await bookingRow
      .locator('button:not([data-testid="operator-bookings-inline-approve"])')
      .first()
      .click();
    const inspection = adminPage.getByTestId("operator-bookings-inspection");
    await expect(inspection.getByTestId("operator-bookings-cancel")).toBeVisible({
      timeout: 30_000,
    });
    // The admin UI confirmation flow is covered by the dedicated admin
    // confidence suite. Use the authenticated admin request here so this
    // cross-surface test isolates persisted cancellation → member projection.
    const cancelled = await adminPage.request.post(
      `/api/bookings/${encodeURIComponent(registrationId)}/cancel`
    );
    expect(cancelled.status(), await cancelled.text()).toBe(200);
  } finally {
    await adminContext.close();
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.locator('[data-portal-member-receipt-closed][data-closed-reason="cancelled"]')
  ).toBeVisible({
    timeout: 60_000,
  });
});

test("DEN-BOOK-CORE admin rejection reaches the member terminal state", async ({
  page,
  browser,
}) => {
  const phone = `+1555${String(Date.now()).slice(-7)}`;
  const memberName = `Denali Free Reject ${phone.replace(/\D/g, "").slice(-6)}`;
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_FREE_MANUAL_TOUR_ID,
    email: `den-book-free-reject-${Date.now()}@denali-smoke.local`,
    fullName: "Denali Free Reject",
    phone,
  });
  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, "Denali free manual booking");
  await expect(page.locator("[data-portal-member-receipt-awaiting-approval]")).toBeVisible();
  const registrationMatch = page.url().match(/\/me\/registrations\/([^/?#]+)/);
  expect(registrationMatch?.[1], "member detail URL must expose registration id").toBeTruthy();
  const registrationId = registrationMatch![1]!;

  const { context: adminContext, page: adminPage } = await createDenaliAdminPage(browser);
  try {
    await adminPage.goto("/bookings?status=all", { waitUntil: "domcontentloaded" });
    const bookingRow = adminPage.locator("[data-booking-row]").filter({ hasText: memberName });
    await expect(bookingRow).toBeVisible({ timeout: 60_000 });
    await bookingRow
      .locator('button:not([data-testid="operator-bookings-inline-approve"])')
      .first()
      .click();
    const inspection = adminPage.getByTestId("operator-bookings-inspection");
    await expect(inspection.getByTestId("operator-bookings-reject")).toBeVisible({
      timeout: 30_000,
    });
    const rejected = await adminPage.request.post(
      `/api/bookings/${encodeURIComponent(registrationId)}/reject`,
      {
        data: { reason: "Denali rejection cross-surface test" },
      }
    );
    expect(rejected.status(), await rejected.text()).toBe(200);
  } finally {
    await adminContext.close();
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.locator('[data-portal-member-receipt-closed][data-closed-reason="rejected"]')
  ).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-portal-member-receipt-upload]")).toHaveCount(0);
});

test("DEN-BOOK-CORE paid manual rejection closes before payment", async ({ page, browser }) => {
  const phone = `+1555${String(Date.now()).slice(-7)}`;
  const memberName = `Denali Paid Manual Reject ${phone.replace(/\D/g, "").slice(-6)}`;
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_PAID_MANUAL_DISCOUNT_TOUR_ID,
    email: `den-book-paid-manual-reject-${Date.now()}@denali-smoke.local`,
    fullName: "Denali Paid Manual Reject",
    phone,
  });
  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, "Denali paid manual member discount");
  await expect(page.locator("[data-portal-member-receipt-awaiting-approval]")).toBeVisible();
  await expect(page.locator("[data-portal-member-receipt-upload]")).toHaveCount(0);
  const registrationMatch = page.url().match(/\/me\/registrations\/([^/?#]+)/);
  expect(registrationMatch?.[1], "member detail URL must expose registration id").toBeTruthy();
  const registrationId = registrationMatch![1]!;

  const { context: adminContext, page: adminPage } = await createDenaliAdminPage(browser);
  try {
    await adminPage.goto("/bookings?status=all", { waitUntil: "domcontentloaded" });
    const bookingRow = adminPage.locator("[data-booking-row]").filter({ hasText: memberName });
    await expect(bookingRow).toBeVisible({ timeout: 60_000 });
    await bookingRow
      .locator('button:not([data-testid="operator-bookings-inline-approve"])')
      .first()
      .click();
    const inspection = adminPage.getByTestId("operator-bookings-inspection");
    await expect(inspection.getByTestId("operator-bookings-reject")).toBeVisible({
      timeout: 30_000,
    });
    const rejected = await adminPage.request.post(
      `/api/bookings/${encodeURIComponent(registrationId)}/reject`,
      { data: { reason: "Denali paid manual rejection before payment" } }
    );
    expect(rejected.status(), await rejected.text()).toBe(200);
  } finally {
    await adminContext.close();
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.locator('[data-portal-member-receipt-closed][data-closed-reason="rejected"]')
  ).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-portal-member-receipt-upload]")).toHaveCount(0);
});

test("DEN-BOOK-CORE waitlist promotion stays aligned with the member portal", async ({
  page,
  browser,
}) => {
  const phone = `+1555${String(Date.now()).slice(-7)}`;
  const memberName = `Denali Waitlist ${phone.replace(/\D/g, "").slice(-6)}`;
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_FREE_MANUAL_TOUR_ID,
    email: `den-book-waitlist-${Date.now()}@denali-smoke.local`,
    fullName: "Denali Waitlist",
    phone,
  });
  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, "Denali free manual booking");
  const registrationMatch = page.url().match(/\/me\/registrations\/([^/?#]+)/);
  expect(registrationMatch?.[1], "member detail URL must expose registration id").toBeTruthy();
  const registrationId = registrationMatch![1]!;

  const { context: adminContext, page: adminPage } = await createDenaliAdminPage(browser);
  try {
    await adminPage.goto("/bookings?status=all", { waitUntil: "domcontentloaded" });
    const bookingRow = adminPage.locator("[data-booking-row]").filter({ hasText: memberName });
    await expect(bookingRow).toBeVisible({ timeout: 60_000 });
    await bookingRow
      .locator('button:not([data-testid="operator-bookings-inline-approve"])')
      .first()
      .click();
    const inspection = adminPage.getByTestId("operator-bookings-inspection");
    await expect(inspection.getByTestId("operator-bookings-waitlist")).toBeVisible({
      timeout: 30_000,
    });
    const waitlisted = await adminPage.request.post(
      `/api/bookings/${encodeURIComponent(registrationId)}/waitlist`
    );
    expect(waitlisted.status(), await waitlisted.text()).toBe(200);

    const waitlistedBff = await page.request.get(
      `/api/me/registrations/${encodeURIComponent(registrationId)}`
    );
    expect(waitlistedBff.status(), await waitlistedBff.text()).toBe(200);
    const waitlistedBody = (await waitlistedBff.json()) as {
      data?: { status?: string };
    };
    expect(waitlistedBody.data?.status).toBe("waitlisted");
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-receipt-awaiting-approval]")).toBeVisible();

    const promoted = await adminPage.request.post(
      `/api/bookings/${encodeURIComponent(registrationId)}/approve`
    );
    expect(promoted.status(), await promoted.text()).toBe(200);
  } finally {
    await adminContext.close();
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-portal-member-receipt-waived]")).toBeVisible({
    timeout: 60_000,
  });
});

test("DEN-BOOK-CORE paid auto booking reaches finance approval and returns paid", async ({
  page,
  browser,
}) => {
  const title = "Denali paid auto booking";
  const phone = `+1555${String(Date.now()).slice(-7)}`;
  const memberName = `Denali Paid Auto ${phone.replace(/\D/g, "").slice(-6)}`;
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_PAID_AUTO_TOUR_ID,
    email: `den-book-paid-auto-${Date.now()}@denali-smoke.local`,
    fullName: "Denali Paid Auto",
    phone,
  });
  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, title);
  await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible();
  await expect(page.locator("[data-portal-member-payment-due-at]")).toBeVisible();

  await page.locator("#receipt-file").setInputFiles({
    name: "denali-paid-auto-receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from("denali-smoke-receipt"),
  });
  const receiptResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/me/registrations/") &&
      response.url().endsWith("/receipt")
  );
  await page.locator("[data-portal-member-receipt-submit]").click();
  expect((await receiptResponse).status()).toBe(201);
  await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
    timeout: 60_000,
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
    timeout: 60_000,
  });

  const registrationMatch = page.url().match(/\/me\/registrations\/([^/?#]+)/);
  expect(registrationMatch?.[1], "member detail URL must expose registration id").toBeTruthy();
  const registrationId = registrationMatch![1]!;

  // Use a separate browser context: the member portal and operator admin are
  // different authorities and must not share cookies or session state.
  const { context: adminContext, page: adminPage } = await createDenaliAdminPage(browser);
  try {
    await adminPage.goto(
      `/finance?tab=receipts&registrationId=${encodeURIComponent(registrationId)}`,
      { waitUntil: "domcontentloaded" }
    );
    await expect(adminPage.getByTestId("finance-receipts-panel")).toBeVisible({
      timeout: 60_000,
    });
    const receiptRow = adminPage
      .getByTestId("finance-receipts-list")
      .getByRole("listitem")
      .filter({ has: adminPage.locator(`a[title="${registrationId}"]`) });
    const reviewForm = receiptRow.getByTestId("finance-receipt-review-form");
    await expect(reviewForm).toBeVisible({ timeout: 60_000 });
    const approveResponse = adminPage.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes("/api/finance/receipts/") &&
        response.url().endsWith("/review")
    );
    await reviewForm.getByRole("button", { name: /approve|تأیید/i }).click();
    const approved = await approveResponse;
    const approvedBody = await approved.text();
    expect(
      approved.ok(),
      `finance approval failed (${approved.status()}): ${approvedBody.slice(0, 300)}`
    ).toBeTruthy();
    await expect(receiptRow).toHaveCount(0, { timeout: 60_000 });

    await adminPage.goto("/bookings?status=all", { waitUntil: "domcontentloaded" });
    const bookingRow = adminPage.locator("[data-booking-row]").filter({ hasText: memberName });
    await expect(bookingRow).toBeVisible({ timeout: 60_000 });
    await expect(bookingRow.getByTestId("operator-bookings-payment-badge-inbox")).toHaveAttribute(
      "data-payment-status",
      "paid"
    );
  } finally {
    await adminContext.close();
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-portal-member-receipt-paid]")).toBeVisible({
    timeout: 60_000,
  });
});

test("DEN-BOOK-CORE member deadline watcher reloads after terminal BFF state", async ({ page }) => {
  const stamp = Date.now();
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_PAID_AUTO_TOUR_ID,
    email: `den-book-deadline-browser-${stamp}@denali-smoke.local`,
    fullName: `Denali Deadline Browser ${stamp}`,
    phone: `+1555${String(stamp).slice(-7)}`,
  });
  await openMemberRegistrationsFromSuccess(page);

  const detailLink = page.getByRole("link", { name: "Denali paid auto booking" });
  const detailHref = await detailLink.getAttribute("href");
  expect(detailHref, "deadline fixture must expose a member detail link").toBeTruthy();
  const registrationId = detailHref!.split("/").pop();
  expect(registrationId).toBeTruthy();

  const registrationResponse = await page.request.get(
    `/api/me/registrations/${encodeURIComponent(registrationId!)}`
  );
  expect(registrationResponse.ok(), await registrationResponse.text()).toBeTruthy();
  const registrationBody = (await registrationResponse.json()) as {
    data?: { paymentDueAt?: string; status?: string; paymentStatus?: string };
  };
  const dueAtMs = Date.parse(registrationBody.data?.paymentDueAt ?? "");
  expect(Number.isFinite(dueAtMs), "approved paid fixture must expose paymentDueAt").toBeTruthy();

  let terminalBffResponseServed = false;
  await page.route(
    `**/api/me/registrations/${encodeURIComponent(registrationId!)}`,
    async (route) => {
      if (!terminalBffResponseServed) {
        terminalBffResponseServed = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: {
              status: "cancelled",
              cancelSource: "payment_deadline",
              paymentStatus: "unpaid",
            },
          }),
        });
        return;
      }
      await route.continue();
    }
  );

  let detailDocumentNavigations = 0;
  page.on("request", (request) => {
    if (
      request.isNavigationRequest() &&
      request.url().includes(`/me/registrations/${registrationId}`)
    ) {
      detailDocumentNavigations += 1;
    }
  });

  await page.clock.install({ time: new Date(dueAtMs + 1_000) });
  await page.goto(detailHref!);
  await page.clock.runFor(1_000);

  await expect.poll(() => detailDocumentNavigations, { timeout: 10_000 }).toBeGreaterThan(1);
  expect(terminalBffResponseServed).toBeTruthy();
});

test("DEN-BOOK-CORE paid auto member discount reaches finance and returns paid", async ({
  page,
  browser,
}) => {
  const stamp = Date.now();
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_PAID_AUTO_DISCOUNT_TOUR_ID,
    email: `den-book-paid-auto-discount-${stamp}@denali-smoke.local`,
    fullName: `Denali Paid Auto Discount ${stamp}`,
    // This deterministic dev member carries the seeded 20% Denali membership
    // discount; use an other-guest card so reruns remain duplicate-safe.
    phone: "+15550001003",
    guestPhone: `+1555${String(stamp).slice(-7)}`,
    nationalId: String(stamp).slice(-10).padStart(10, "0"),
    registrantTarget: "other",
  });
  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, "Denali paid auto member discount");
  await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible();
  await expect(page.locator("[data-portal-member-payment-due-at]")).toBeVisible();

  await page.locator("#receipt-file").setInputFiles({
    name: "denali-paid-auto-discount-receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from("denali-smoke-paid-auto-discount-receipt"),
  });
  const receiptResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      response.url().includes("/api/me/registrations/") &&
      response.url().endsWith("/receipt")
  );
  await page.locator("[data-portal-member-receipt-submit]").click();
  expect((await receiptResponse).status()).toBe(201);
  await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
    timeout: 60_000,
  });

  const registrationMatch = page.url().match(/\/me\/registrations\/([^/?#]+)/);
  expect(registrationMatch?.[1], "member detail URL must expose registration id").toBeTruthy();
  const registrationId = registrationMatch![1]!;
  const { context: adminContext, page: adminPage } = await createDenaliAdminPage(browser);
  try {
    const invoiceResponse = await adminPage.request.get(
      `/api/finance/invoices/${encodeURIComponent(registrationId)}`
    );
    expect(invoiceResponse.ok(), await invoiceResponse.text()).toBeTruthy();
    const invoice = (await invoiceResponse.json()) as {
      invoiceTotalMinor?: string;
      balanceDueMinor?: string;
    };
    // 2,500,000/person × 1 seat − the seeded 20% Denali member discount.
    expect(invoice.invoiceTotalMinor).toBe("2000000");
    expect(invoice.balanceDueMinor).toBe("2000000");

    await adminPage.goto(
      `/finance?tab=receipts&registrationId=${encodeURIComponent(registrationId)}`,
      { waitUntil: "domcontentloaded" }
    );
    await expect(adminPage.getByTestId("finance-receipts-panel")).toBeVisible({
      timeout: 60_000,
    });
    const receiptRow = adminPage
      .getByTestId("finance-receipts-list")
      .getByRole("listitem")
      .filter({ has: adminPage.locator(`a[title="${registrationId}"]`) });
    const reviewForm = receiptRow.getByTestId("finance-receipt-review-form");
    await expect(reviewForm).toBeVisible({ timeout: 60_000 });
    const approveResponse = adminPage.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes("/api/finance/receipts/") &&
        response.url().endsWith("/review")
    );
    await reviewForm.getByRole("button", { name: /approve|تأیید/i }).click();
    const approved = await approveResponse;
    expect(approved.ok(), `finance approval failed (${approved.status()})`).toBeTruthy();
    await expect(receiptRow).toHaveCount(0, { timeout: 60_000 });
  } finally {
    await adminContext.close();
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-portal-member-receipt-paid]")).toBeVisible({
    timeout: 60_000,
  });
});

test("DEN-BOOK-CORE paid manual booking reaches approval, payment, and finance", async ({
  page,
  browser,
}) => {
  const phone = `+1555${String(Date.now()).slice(-7)}`;
  const memberName = `Denali Paid Manual ${phone.replace(/\D/g, "").slice(-6)}`;
  await completePortalCatalogRegistration(page, {
    tourId: DENALI_BOOKING_PAID_MANUAL_DISCOUNT_TOUR_ID,
    email: `den-book-paid-manual-${Date.now()}@denali-smoke.local`,
    fullName: "Denali Paid Manual",
    phone,
  });
  await openMemberRegistrationsFromSuccess(page);
  await openMemberRegistrationDetailByTitle(page, "Denali paid manual member discount");
  await expect(page.locator("[data-portal-member-receipt-awaiting-approval]")).toBeVisible();
  await expect(page.locator("[data-portal-member-receipt-upload]")).toHaveCount(0);

  const registrationMatch = page.url().match(/\/me\/registrations\/([^/?#]+)/);
  expect(registrationMatch?.[1], "member detail URL must expose registration id").toBeTruthy();
  const registrationId = registrationMatch![1]!;
  const { context: adminContext, page: adminPage } = await createDenaliAdminPage(browser);
  try {
    await adminPage.goto("/bookings?status=all", { waitUntil: "domcontentloaded" });
    const bookingRow = adminPage.locator("[data-booking-row]").filter({ hasText: memberName });
    await expect(bookingRow).toBeVisible({ timeout: 60_000 });
    await bookingRow
      .locator('button:not([data-testid="operator-bookings-inline-approve"])')
      .first()
      .click();
    const inspection = adminPage.getByTestId("operator-bookings-inspection");
    await expect(inspection.getByTestId("operator-bookings-approve")).toBeVisible({
      timeout: 30_000,
    });
    // The dedicated admin confidence suite covers the click/confirmation
    // interaction. Keep this cross-surface test focused on the persisted
    // approval projection after the admin reservation has been inspected.
    const approvedBooking = await adminPage.request.post(
      `/api/bookings/${encodeURIComponent(registrationId)}/approve`
    );
    expect(approvedBooking.status(), await approvedBooking.text()).toBe(200);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
      timeout: 60_000,
    });
    await page.locator("#receipt-file").setInputFiles({
      name: "denali-paid-manual-receipt.png",
      mimeType: "image/png",
      buffer: Buffer.from("denali-smoke-paid-manual-receipt"),
    });
    const receiptResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes(`/api/me/registrations/${registrationId}/receipt`)
    );
    await page.locator("[data-portal-member-receipt-submit]").click();
    expect((await receiptResponse).status()).toBe(201);
    await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
      timeout: 60_000,
    });

    await adminPage.goto(
      `/finance?tab=receipts&registrationId=${encodeURIComponent(registrationId)}`,
      { waitUntil: "domcontentloaded" }
    );
    await expect(adminPage.getByTestId("finance-receipts-panel")).toBeVisible({
      timeout: 60_000,
    });
    const receiptRow = adminPage
      .getByTestId("finance-receipts-list")
      .getByRole("listitem")
      .filter({ has: adminPage.locator(`a[title="${registrationId}"]`) });
    const reviewForm = receiptRow.getByTestId("finance-receipt-review-form");
    await expect(reviewForm).toBeVisible({ timeout: 60_000 });
    const approveReceiptResponse = adminPage.waitForResponse(
      (response) =>
        response.request().method() === "PATCH" &&
        response.url().includes("/api/finance/receipts/") &&
        response.url().endsWith("/review")
    );
    await reviewForm.getByRole("button", { name: /approve|تأیید/i }).click();
    const approvedReceipt = await approveReceiptResponse;
    expect(approvedReceipt.status(), await approvedReceipt.text()).toBe(200);
    await expect(receiptRow).toHaveCount(0, { timeout: 60_000 });
  } finally {
    await adminContext.close();
  }

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-portal-member-receipt-paid]")).toBeVisible({
    timeout: 60_000,
  });
});

test("SMK-PTL-06 member logout clears session and blocks /me area", async ({ page }) => {
  const email = `smk-ptl-06-${Date.now()}@denali-smoke.local`;
  const phone = `+1555${String(Date.now()).slice(-7)}`;

  await completePortalCatalogRegistration(page, {
    email,
    fullName: "Portal Logout Smoke",
    phone,
  });

  await page.goto("/me/registrations");
  await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({
    timeout: 60_000,
  });

  // PS-VIS-5f: desktop rail footer or (mobile) profile session card
  const railLogout = page.locator(
    '[data-portal-shell-nav-footer] [data-public-auth-logout][data-public-auth-logout-ready="true"]'
  );
  const profileLogout = page.locator(
    '[data-member-profile-session] [data-public-auth-logout][data-public-auth-logout-ready="true"]'
  );
  if (await railLogout.isVisible().catch(() => false)) {
    // desktop side rail
  } else {
    await page.goto("/me/profile");
    await expect(page.locator("main[data-portal-member-profile]")).toBeVisible({
      timeout: 60_000,
    });
  }
  const logoutButton = (await railLogout.isVisible().catch(() => false))
    ? railLogout
    : profileLogout;
  await expect(logoutButton).toBeEnabled({ timeout: 60_000 });

  const [logoutResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().includes("/api/public-auth/logout"),
      { timeout: 60_000 }
    ),
    logoutButton.first().click(),
  ]);
  expect(logoutResponse.ok(), `logout failed (${logoutResponse.status()})`).toBeTruthy();

  await page.waitForURL((url) => !url.pathname.startsWith("/me"), { timeout: 60_000 });

  await page.goto("/me/registrations");
  await expect(page).not.toHaveURL(/\/me\/registrations/, { timeout: 60_000 });

  const blockedMeApi = await page.request.get("/api/me/registrations");
  expect(blockedMeApi.status(), "BFF must reject unauthenticated /api/me/*").toBe(401);
});

test("SMK-PTL-09 entitled modules appear in shell nav (PS-5)", async ({ page }) => {
  const email = `smk-ptl-09-${Date.now()}@denali-smoke.local`;
  const phone = `+1555${String(Date.now()).slice(-7)}`;

  await completePortalCatalogRegistration(page, {
    email,
    fullName: "Portal Entitlements Smoke",
    phone,
  });

  await openMemberRegistrationsFromSuccess(page);

  const entitlementsResponse = await page.request.get("/api/me/entitlements");
  expect(entitlementsResponse.ok(), "entitlements BFF must succeed for session").toBeTruthy();
  const entitlementsBody = (await entitlementsResponse.json()) as { granted?: string[] };
  expect(entitlementsBody.granted).toContain("member.module.home");
  expect(entitlementsBody.granted).toContain("member.module.trips");

  await expect(page.getByTestId("portal-shell-nav-home")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("portal-shell-nav-trips")).toBeVisible();
  await expect(page.getByTestId("portal-shell-nav-profile")).toBeVisible();
});
