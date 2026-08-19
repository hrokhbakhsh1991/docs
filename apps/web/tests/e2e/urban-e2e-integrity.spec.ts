import { expect, test } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  submitCatalogPhoneForOtp,
} from "./fixtures/catalog-registration-otp";
import {
  URBAN_MEMBER_E2E_BASE_URL,
  URBAN_MEMBER_SETTINGS_PATH,
} from "./fixtures/urban-member-session";
import {
  URBAN_OWNER_E2E_BASE_URL,
  URBAN_OWNER_SETTINGS_PATH,
} from "./fixtures/urban-owner-session";

const URBAN_PUBLIC_BASE_URL = process.env.SMOKE_WEB_BASE_URL ?? "http://urban.localhost:3000";
const URBAN_PORTAL_BASE_URL = process.env.SMOKE_PORTAL_BASE_URL ?? "http://urban.localhost:3003";
const URBAN_MARKETING_BASE_URL =
  process.env.SMOKE_MARKETING_BASE_URL ?? "http://urban.localhost:3002";
const PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000410";
const PUBLISHED_TOUR_TITLE = "Berlin city highlights";
const REGISTRATION_EMAIL = `smk-p8-02-${Date.now()}@urban-smoke.local`;
const DEV_PHONE = `+1555${String(Date.now()).slice(-7)}`;

test("SMK-P8-01 public catalog browse (anonymous)", async ({ page, context }) => {
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name.toLowerCase().includes("session"))).toBe(false);

  await page.goto(`${URBAN_MARKETING_BASE_URL}/tours`);
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(PUBLISHED_TOUR_TITLE)).toBeVisible();
  await expect(page.locator("[data-workspace-wizard-forbidden]")).toHaveCount(0);
});

test("SMK-P8-02 public registration intake (OTP + tour intake)", async ({ page }) => {
  await page.goto(`${URBAN_PORTAL_BASE_URL}/catalog/${PUBLISHED_TOUR_ID}/register`);
  // PCMS-UX-MODAL-04 — guest register auto-opens OTP modal; phone lives inside dialog[open].
  // Do not toBeVisible the <dialog> node (Preflight 0×0 until L2 flex frame).
  await expect(
    page.locator(
      "dialog[open][data-portal-login-modal-open='true'] [data-public-registration-phone][data-registration-ready]"
    )
  ).toBeVisible({ timeout: 60_000 });

  await submitCatalogPhoneForOtp(page, DEV_PHONE);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);

  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]")
  ).toBeVisible({ timeout: 60_000 });

  await completeCatalogRegistrationIntake(page, {
    email: REGISTRATION_EMAIL,
    fullName: "Smoke Tester",
    partySize: "2",
  });

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 60_000,
  });
});

test("SMK-P8-03 owner settings load", async ({ page }) => {
  await page.goto(`${URBAN_OWNER_E2E_BASE_URL}${URBAN_OWNER_SETTINGS_PATH}`);
  await expect(page.locator("[data-urban-owner-settings-panel]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText(/Catalog enabled|کاتالوگ فعال/i)).toBeVisible();
  await expect(page.getByText(/Registration policy|سیاست ثبت‌نام/i)).toBeVisible();
  await expect(page.locator("[data-workspace-wizard-forbidden]")).toHaveCount(0);
});

test("SMK-P8-04 member denied settings", async ({ page }) => {
  await page.goto(`${URBAN_MEMBER_E2E_BASE_URL}${URBAN_MEMBER_SETTINGS_PATH}`);
  const denied = page.locator("[data-workspace-wizard-forbidden]");
  await expect(denied).toBeVisible({ timeout: 60_000 });
  await expect(denied).toHaveAttribute("data-status-code", "403");
});
