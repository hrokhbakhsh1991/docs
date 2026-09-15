/**
 * WALLET-P3C — Denali wallet + engagement dashboard integration (Postgres E2E).
 */
import { expect, test } from "@playwright/test";

import { DENALI_WALLET_PILOT } from "../../../api/test/fixtures/denali-wallet-pilot-tenant";
import { loginDenaliWalletPilotMember } from "./fixtures/denali-wallet-pilot-member-session";

test.describe("WALLET-MEG dashboard integration", () => {
  test("WALLET-MEG-01 dashboard shows engagement points and wallet balance separately", async ({
    page,
  }) => {
    await loginDenaliWalletPilotMember(page);
    await page.goto("/me/home", { waitUntil: "domcontentloaded" });

    await expect(page.locator("[data-portal-member-home]")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-portal-member-dashboard-engagement]")).toBeVisible();
    await expect(page.locator("[data-portal-member-engagement-points]")).toBeVisible();
    await expect(page.locator("[data-portal-member-dashboard-wallet]")).toBeVisible();
    await expect(page.locator("[data-portal-member-wallet-dashboard-balance]")).toBeVisible();
    await expect(page.locator("[data-portal-member-wallet-dashboard-balance]")).toContainText(
      /ریال|IRR/,
    );

    const pointsText = await page.locator("[data-portal-member-engagement-points]").innerText();
    expect(pointsText).not.toMatch(/ریال|تومان|\$/i);
    expect(pointsText).toMatch(/50/);

    await page.screenshot({
      path: "/opt/cursor/artifacts/denali-dashboard-wallet-engagement-desktop.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("[data-portal-member-dashboard-grid]")).toBeVisible();
    await page.screenshot({
      path: "/opt/cursor/artifacts/denali-dashboard-wallet-engagement-mobile.png",
      fullPage: true,
    });
  });

  test("WALLET-MEG-02 wallet CTA opens dedicated wallet page", async ({ page }) => {
    await loginDenaliWalletPilotMember(page);
    await page.goto("/me/home", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-wallet-cta]")).toBeVisible({ timeout: 90_000 });
    await page.locator("[data-portal-member-wallet-cta]").click();
    await expect(page.locator("[data-portal-member-wallet][data-portal-member-wallet-state='ready']")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-portal-member-wallet-balance-amount]")).toContainText(
      /ریال|IRR/,
    );
  });

  test("WALLET-MEG-03 wallet hidden when module disabled tenant would deny", async ({ page }) => {
    await loginDenaliWalletPilotMember(page, DENALI_WALLET_PILOT.deniedMemberMobile);
    await page.goto("/me/home", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-home]")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-portal-member-dashboard-wallet]")).toHaveAttribute(
      "data-portal-member-wallet-state",
      "hidden",
    );
  });
});
