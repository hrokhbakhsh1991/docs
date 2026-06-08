import { expect, test } from "@playwright/test";

import {
  URBAN_MEMBER_E2E_BASE_URL,
  URBAN_MEMBER_SETTINGS_PATH,
} from "./fixtures/urban-member-session";
import {
  URBAN_OWNER_E2E_BASE_URL,
  URBAN_OWNER_SETTINGS_PATH,
} from "./fixtures/urban-owner-session";

const URBAN_PUBLIC_BASE_URL = process.env.SMOKE_WEB_BASE_URL ?? "http://urban.localhost:3000";
const PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000410";
const PUBLISHED_TOUR_TITLE = "Berlin city highlights";
const REGISTRATION_EMAIL = `smk-p8-02-${Date.now()}@urban-smoke.local`;

test("SMK-P8-01 public catalog browse (anonymous)", async ({ page, context }) => {
  const cookies = await context.cookies();
  expect(cookies.some((c) => c.name.toLowerCase().includes("session"))).toBe(false);

  await page.goto(`${URBAN_PUBLIC_BASE_URL}/catalog`);
  await expect(page.locator("[data-urban-public-catalog]")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(PUBLISHED_TOUR_TITLE)).toBeVisible();
  await expect(page.locator("[data-workspace-wizard-forbidden]")).toHaveCount(0);
});

test("SMK-P8-02 public registration intake", async ({ page }) => {
  await page.goto(`${URBAN_PUBLIC_BASE_URL}/catalog/${PUBLISHED_TOUR_ID}/register`);
  await expect(page.locator("[data-urban-registration-form]")).toBeVisible({ timeout: 60_000 });

  await page.locator('input[name="email"]').fill(REGISTRATION_EMAIL);
  await page.locator('input[name="fullName"]').fill("Smoke Tester");
  await page.locator('input[name="partySize"]').fill("2");
  await page.locator("[data-urban-registration-form] button[type=submit]").click();

  await expect(page.locator("[data-urban-registration-success]")).toBeVisible({
    timeout: 60_000,
  });
});

test("SMK-P8-03 owner settings load", async ({ page }) => {
  await page.goto(`${URBAN_OWNER_E2E_BASE_URL}${URBAN_OWNER_SETTINGS_PATH}`);
  await expect(page.locator("[data-urban-owner-settings-panel]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("Catalog enabled")).toBeVisible();
  await expect(page.getByText("Registration policy")).toBeVisible();
  await expect(page.locator("[data-workspace-wizard-forbidden]")).toHaveCount(0);
});

test("SMK-P8-04 member denied settings", async ({ page }) => {
  await page.goto(`${URBAN_MEMBER_E2E_BASE_URL}${URBAN_MEMBER_SETTINGS_PATH}`);
  const denied = page.locator("[data-workspace-wizard-forbidden]");
  await expect(denied).toBeVisible({ timeout: 60_000 });
  await expect(denied).toHaveAttribute("data-status-code", "403");
});
