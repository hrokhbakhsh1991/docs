/**
 * GAP-WALLET-01 — member wallet page journey (direct nav, not notification deeplink only).
 */
import { expect, test } from "@playwright/test";

import { authenticatePortalMemberForTickets } from "./fixtures/authenticate-portal-member-for-tickets";
import { captureBqcArtifact } from "./fixtures/capture-bqc-artifact";

const MEMBER_PHONE = "+15550001003";
const MEMBER_NAME = "Portal Smoke Member";

test("GAP-WALLET-01 member home CTA opens ready wallet page with balance", async ({ page }) => {
  await authenticatePortalMemberForTickets(page, { phone: MEMBER_PHONE, fullName: MEMBER_NAME });

  await page.goto("/me/home", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-portal-member-home]")).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("[data-portal-member-wallet-cta]")).toBeVisible({ timeout: 60_000 });

  await page.locator("[data-portal-member-wallet-cta]").click();
  await page.waitForURL(/\/me\/wallet/, { timeout: 60_000 });

  const walletProbe = await page.request.get("/api/me/wallet");
  expect(walletProbe.ok(), await walletProbe.text()).toBeTruthy();

  await expect(
    page.locator("[data-portal-member-wallet][data-portal-member-wallet-state='ready']"),
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("[data-portal-member-wallet-balance-amount]")).toContainText(
    /ریال|IRR/,
  );

  await captureBqcArtifact(page, "/opt/cursor/artifacts/gap-member-wallet-page.png");
});
