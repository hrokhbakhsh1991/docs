/**
 * P1 EPIC H — Platform create club wizard E2E.
 */
import { expect, test } from "@playwright/test";

import {
  loginPlatformOps,
  PLATFORM_OPS_PHONE,
  uniquePlatformSubdomain,
} from "../fixtures/platform-ops-session";

test.describe("platform-create-club.spec.ts — P1 EPIC H", () => {
  test("4-step wizard then club in list", async ({ page }) => {
    const subdomain = uniquePlatformSubdomain("e2e");

    await loginPlatformOps(page);
    await page.goto("/platform/clubs/new", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-create-club-wizard]")).toBeVisible({ timeout: 60_000 });

    await page.locator("#club-subdomain").fill(subdomain);
    await page.locator("#club-workspace").selectOption({ index: 1 });
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator('[data-step="sites"]')).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator('[data-step="owner"]')).toBeVisible({ timeout: 15_000 });
    await page.locator("#club-owner-phone").fill(PLATFORM_OPS_PHONE);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.locator('[data-step="review"]')).toBeVisible({ timeout: 15_000 });

    await page.getByRole("button", { name: "Create club" }).click();
    await page.waitForURL(/\/platform\/clubs\/(?!new)[^/]+$/, { timeout: 120_000 });

    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 15_000 });
    await page.goto("/platform/clubs", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("link", { name: subdomain })).toBeVisible({ timeout: 30_000 });
  });
});
