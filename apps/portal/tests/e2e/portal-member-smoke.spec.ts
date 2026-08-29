import { expect, test } from "@playwright/test";

import {
  OPERATOR_PUBLISHED_TOUR_TITLE,
  completePortalCatalogRegistration,
} from "./fixtures/complete-portal-registration";

const REGISTRATION_EMAIL = `smk-ptl-02-${Date.now()}@denali-smoke.local`;
const DEV_PHONE = `+1555${String(Date.now()).slice(-7)}`;

test("SMK-PTL-02 member /me lists registration after catalog intake (VS-04)", async ({
  page,
}) => {
  await completePortalCatalogRegistration(page, {
    email: REGISTRATION_EMAIL,
    fullName: "Portal Member Smoke",
    phone: DEV_PHONE,
  });

  await page.locator('[data-public-registration-success] a[href*="/me"]').first().click();
  await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(OPERATOR_PUBLISHED_TOUR_TITLE)).toBeVisible();
  await expect(page.getByRole("link", { name: OPERATOR_PUBLISHED_TOUR_TITLE })).toBeVisible();
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

  await page.locator('[data-public-registration-success] a[href*="/me"]').first().click();
  await page.getByRole("link", { name: OPERATOR_PUBLISHED_TOUR_TITLE }).first().click();
  await expect(page.locator("[data-portal-member-receipt-awaiting-approval]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-portal-member-receipt-upload]")).toHaveCount(0);
  await expect(page.locator("[data-portal-member-receipt-submit]")).toHaveCount(0);
  await expect(page.locator("[data-portal-member-receipt-back-trips]")).toBeVisible();
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
      (res) =>
        res.request().method() === "POST" && res.url().includes("/api/public-auth/logout"),
      { timeout: 60_000 }
    ),
    logoutButton.first().click(),
  ]);
  expect(
    logoutResponse.ok(),
    `logout failed (${logoutResponse.status()})`
  ).toBeTruthy();

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

  await page.locator('[data-public-registration-success] a[href*="/me"]').first().click();
  await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({
    timeout: 60_000,
  });

  const entitlementsResponse = await page.request.get("/api/me/entitlements");
  expect(entitlementsResponse.ok(), "entitlements BFF must succeed for session").toBeTruthy();
  const entitlementsBody = (await entitlementsResponse.json()) as { granted?: string[] };
  expect(entitlementsBody.granted).toContain("member.module.home");
  expect(entitlementsBody.granted).toContain("member.module.trips");

  await expect(page.getByTestId("portal-shell-nav-home")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId("portal-shell-nav-trips")).toBeVisible();
  await expect(page.getByTestId("portal-shell-nav-profile")).toBeVisible();
});
