/**
 * WALLET-P3C — member portal wallet certification (Postgres E2E).
 */
import { expect, test } from "@playwright/test";

import { WALLET_WS1_CERTIFICATION } from "../../../api/test/fixtures/wallet-ws1-certification-tenant";
import {
  WALLET_WS1_MEMBER_WALLET_PATH,
  loginWalletWs1Member,
} from "./fixtures/wallet-ws1-member-session";

test("WALLET-CERT-M01 entitled member loads balance and history", async ({ page }) => {
  await loginWalletWs1Member(page);
  await page.goto(WALLET_WS1_MEMBER_WALLET_PATH);

  await expect(
    page.locator("[data-portal-member-wallet][data-portal-member-wallet-state='ready']")
  ).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.locator("[data-portal-member-wallet-balance-amount]")).toContainText(
    /\$|USD|40/
  );
  await expect(page.locator("[data-portal-member-wallet-transaction]").first()).toBeVisible({
    timeout: 60_000,
  });
});

test("WALLET-CERT-M02 pagination load-more fetches additional history", async ({ page }) => {
  await loginWalletWs1Member(page);

  const firstPage = await page.request.get("/api/me/wallet/transactions?limit=20");
  expect(firstPage.ok()).toBeTruthy();
  const firstBody = (await firstPage.json()) as {
    ok?: boolean;
    history?: { items?: unknown[]; hasMore?: boolean; nextCursor?: string | null };
  };
  expect(firstBody.ok).toBe(true);
  expect(firstBody.history?.items?.length).toBe(20);
  expect(firstBody.history?.hasMore).toBe(true);
  expect(typeof firstBody.history?.nextCursor).toBe("string");

  const secondPage = await page.request.get(
    `/api/me/wallet/transactions?limit=20&cursor=${encodeURIComponent(firstBody.history!.nextCursor!)}`
  );
  expect(secondPage.ok()).toBeTruthy();
  const secondBody = (await secondPage.json()) as {
    ok?: boolean;
    history?: { items?: unknown[]; hasMore?: boolean };
  };
  expect(secondBody.ok).toBe(true);
  expect(secondBody.history?.items?.length).toBeGreaterThan(0);
  expect(secondBody.history?.hasMore).toBe(false);

  await page.goto(WALLET_WS1_MEMBER_WALLET_PATH);
  await expect(
    page.locator("[data-portal-member-wallet][data-portal-member-wallet-state='ready']")
  ).toBeVisible({
    timeout: 90_000,
  });
  await expect(page.locator("[data-portal-member-wallet-load-more]")).toBeVisible({
    timeout: 30_000,
  });
});

test("WALLET-CERT-M03 non-entitled member denied at portal gate", async ({ page }) => {
  await loginWalletWs1Member(page, WALLET_WS1_CERTIFICATION.deniedMemberMobile);
  await page.goto(WALLET_WS1_MEMBER_WALLET_PATH);
  await expect(
    page.locator(
      "[data-portal-member-unauthorized][data-portal-member-unauthorized-module='wallet']"
    )
  ).toBeVisible({
    timeout: 90_000,
  });
});

test("WALLET-CERT-M04 unauthenticated user redirected from /me/wallet", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto(WALLET_WS1_MEMBER_WALLET_PATH);
  await expect(page).toHaveURL(/\/login/, { timeout: 60_000 });
});

test("WALLET-CERT-M05 forged tenant header cannot override host-bound authority", async ({
  page,
}) => {
  await loginWalletWs1Member(page);
  const trusted = await page.request.get("/api/me/wallet");
  expect(trusted.ok()).toBeTruthy();
  const trustedBody = (await trusted.json()) as {
    ok?: boolean;
    balance?: { balanceMinor?: string };
  };
  expect(trustedBody.ok).toBe(true);
  expect(trustedBody.balance?.balanceMinor).toMatch(/^\d+$/);

  const forged = await page.request.get("/api/me/wallet", {
    headers: { "x-tenant-id": "00000000-0000-4000-8000-000000000001" },
  });
  expect(forged.status()).toBe(200);
  const forgedBody = (await forged.json()) as {
    ok?: boolean;
    balance?: { balanceMinor?: string };
  };
  expect(forgedBody.ok).toBe(true);
  expect(forgedBody.balance?.balanceMinor).toBe(trustedBody.balance?.balanceMinor);
});
