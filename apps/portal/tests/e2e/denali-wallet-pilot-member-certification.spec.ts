/**
 * Phase 2 — Denali Wallet pilot member portal certification (Postgres E2E).
 */
import { expect, test } from "@playwright/test";

import { DENALI_WALLET_PILOT } from "../../../api/test/fixtures/denali-wallet-pilot-tenant";
import {
  DENALI_WALLET_PILOT_MEMBER_WALLET_PATH,
  loginDenaliWalletPilotMember,
} from "./fixtures/denali-wallet-pilot-member-session";

test("WALLET-PILOT-M01 entitled member loads IRR balance and history", async ({ page }) => {
  await loginDenaliWalletPilotMember(page);
  await page.goto(DENALI_WALLET_PILOT_MEMBER_WALLET_PATH);

  await expect(
    page.locator("[data-portal-member-wallet][data-portal-member-wallet-state='ready']")
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("[data-portal-member-wallet-balance-amount]")).toContainText(
    /ریال|IRR/
  );
  await expect(page.locator("[data-portal-member-wallet-currency]")).toContainText(/IRR|ریال/);
  await expect(page.locator("[data-portal-member-wallet-transaction]").first()).toBeVisible({
    timeout: 60_000,
  });
});

test("WALLET-PILOT-M02 non-entitled member denied at portal gate", async ({ page }) => {
  await loginDenaliWalletPilotMember(page, DENALI_WALLET_PILOT.deniedMemberMobile);
  await page.goto(DENALI_WALLET_PILOT_MEMBER_WALLET_PATH);
  await expect(
    page.locator(
      "[data-portal-member-unauthorized][data-portal-member-unauthorized-module='wallet']"
    )
  ).toBeVisible({ timeout: 90_000 });
});
