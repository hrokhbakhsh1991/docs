/**
 * WALLET-V1 — default Denali club dashboard wallet + engagement integration.
 */
import { expect, test } from "@playwright/test";

import { DENALI_DEFAULT_WALLET } from "../../../api/test/fixtures/denali-default-wallet-tenant";
import { loginDenaliDefaultWalletMember } from "./fixtures/denali-default-wallet-member-session";

test.describe("WALLET-DEFAULT-MEG dashboard integration", () => {
  test("WALLET-DEFAULT-MEG-01 dashboard shows points and wallet balance separately", async ({
    page,
  }) => {
    await loginDenaliDefaultWalletMember(page);
    await page.goto("/me/home", { waitUntil: "domcontentloaded" });

    await expect(page.locator("[data-portal-member-home]")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-portal-member-engagement-points]")).toBeVisible();
    await expect(page.locator("[data-portal-member-wallet-dashboard-balance]")).toBeVisible();
    await expect(page.locator("[data-portal-member-wallet-dashboard-balance]")).toContainText(
      /ریال|IRR/,
    );

    const pointsText = await page.locator("[data-portal-member-engagement-points]").innerText();
    expect(pointsText).not.toMatch(/ریال|تومان|\$/i);
    expect(pointsText).toMatch(/50/);

    await page.screenshot({
      path: "/opt/cursor/artifacts/denali-default-dashboard-wallet-engagement-desktop.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: "/opt/cursor/artifacts/denali-default-dashboard-wallet-engagement-mobile.png",
      fullPage: true,
    });
  });

  test("WALLET-DEFAULT-MEG-02 wallet hidden for denied member", async ({ page }) => {
    await loginDenaliDefaultWalletMember(page, DENALI_DEFAULT_WALLET.deniedMemberMobile);
    await page.goto("/me/home", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-dashboard-wallet]")).toHaveAttribute(
      "data-portal-member-wallet-state",
      "hidden",
    );
  });
});
