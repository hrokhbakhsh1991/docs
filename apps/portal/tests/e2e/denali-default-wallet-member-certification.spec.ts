/**
 * WALLET-V1 — Denali default club member portal certification (Postgres E2E).
 */
import { expect, test } from "@playwright/test";

import { DENALI_DEFAULT_WALLET } from "../../../api/test/fixtures/denali-default-wallet-tenant";
import { loginDenaliDefaultWalletMember } from "./fixtures/denali-default-wallet-member-session";

const MEMBER_WALLET_PATH = "/me/wallet" as const;

test("WALLET-DEFAULT-M01 entitled member loads IRR balance and history", async ({ page }) => {
  await loginDenaliDefaultWalletMember(page);
  await page.goto(MEMBER_WALLET_PATH);

  await expect(
    page.locator("[data-portal-member-wallet][data-portal-member-wallet-state='ready']"),
  ).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("[data-portal-member-wallet-balance-amount]")).toContainText(
    /ریال|IRR/,
  );
  await expect(page.locator("[data-portal-member-wallet-transaction]").first()).toBeVisible({
    timeout: 60_000,
  });
});

test("WALLET-DEFAULT-M02 non-entitled member denied at portal gate", async ({ page }) => {
  await loginDenaliDefaultWalletMember(page, DENALI_DEFAULT_WALLET.deniedMemberMobile);
  await page.goto(MEMBER_WALLET_PATH);
  await expect(
    page.locator(
      "[data-portal-member-unauthorized][data-portal-member-unauthorized-module='wallet']",
    ),
  ).toBeVisible({ timeout: 90_000 });
});
