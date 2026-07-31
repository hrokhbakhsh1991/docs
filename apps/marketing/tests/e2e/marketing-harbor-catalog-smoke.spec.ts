import { expect, test } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  submitCatalogPhoneForOtp,
} from "./fixtures/catalog-registration-otp";

const HARBOR_PUBLISHED_TOUR_TITLE = "Harbor evening sail";
const HARBOR_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000521";
const HARBOR_PUBLISHED_TOUR_CITY = "bandar";
const REGISTRATION_EMAIL = `smk-mkt-harbor-${Date.now()}@harbor-smoke.local`;

test("SMK-MKT-HARBOR-01a harbor public catalog browse + city filter", async ({ page }) => {
  await page.goto("/tours");
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-marketing-header]")).toBeVisible();
  await expect(page.locator("body[data-workspace-plugin='harbor']")).toBeVisible();
  await expect(page.getByText(HARBOR_PUBLISHED_TOUR_TITLE)).toBeVisible();

  const cityInput = page.locator('input[name="city"]');
  await expect(cityInput).toBeVisible({ timeout: 15_000 });
  await cityInput.fill(HARBOR_PUBLISHED_TOUR_CITY);
  await page.locator('form[data-marketing-catalog-filters] button[type="submit"]').click();
  await expect(page.getByText(HARBOR_PUBLISHED_TOUR_TITLE)).toBeVisible({ timeout: 30_000 });
});

test("SMK-MKT-HARBOR-01b harbor tour detail shows policies + Event JSON-LD", async ({ page }) => {
  await page.goto("/tours", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(HARBOR_PUBLISHED_TOUR_TITLE)).toBeVisible({ timeout: 60_000 });
  await page.locator(`a[href="/tours/${HARBOR_PUBLISHED_TOUR_ID}"]`).first().click();
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-marketing-catalog-detail-policies]")).toBeVisible();
  await expect(page.locator("[data-marketing-register]").first()).toBeVisible();

  const raw = await page
    .locator("[data-marketing-catalog-jsonld-graph]")
    .evaluate((node) => node.textContent ?? "");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const graph = parsed["@graph"] as Array<Record<string, unknown>> | undefined;
  const eventNode =
    graph?.find((node) => node["@type"] === "Event") ??
    (parsed["@type"] === "Event" ? parsed : undefined);
  expect(eventNode?.["@type"]).toBe("Event");
  expect(eventNode?.name).toBe(HARBOR_PUBLISHED_TOUR_TITLE);
});

test("SMK-MKT-HARBOR-01c marketing register CTA completes OTP + harbor intake", async ({
  page,
}) => {
  const devPhone = `+1555${String(Date.now()).slice(-7)}`;
  await page.goto("/tours", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(HARBOR_PUBLISHED_TOUR_TITLE)).toBeVisible({ timeout: 60_000 });
  await page.locator(`a[href="/tours/${HARBOR_PUBLISHED_TOUR_ID}"]`).first().click();
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });

  const registerLink = page.locator("[data-marketing-register]").first();
  await expect(registerLink).toBeVisible();
  await Promise.all([
    page.waitForURL(/\/catalog\/[^/]+\/register/, { timeout: 60_000 }),
    registerLink.click(),
  ]);
  await page.waitForSelector("[data-public-registration-phone][data-registration-ready]", {
    timeout: 120_000,
  });

  await submitCatalogPhoneForOtp(page, devPhone);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);
  await expect(
    page.locator("[data-public-registration-profile], [data-public-registration-intake]"),
  ).toBeVisible({ timeout: 60_000 });

  await completeCatalogRegistrationIntake(page, {
    email: REGISTRATION_EMAIL,
    fullName: "Harbor Smoke Guest",
    partySize: "2",
  });

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-harbor-registration-success]")).toBeVisible();
});
