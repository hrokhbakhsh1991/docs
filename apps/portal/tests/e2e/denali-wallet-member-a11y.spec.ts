/**
 * WALLET-A11Y — Denali member portal wallet accessibility (axe + keyboard).
 */
import { expect, test } from "@playwright/test";

import { DENALI_WALLET_PILOT } from "../../../api/test/fixtures/denali-wallet-pilot-tenant";
import { loginDenaliWalletPilotMember } from "./fixtures/denali-wallet-pilot-member-session";
import { relayWalletOutboxForTenant } from "./fixtures/relay-wallet-outbox";
import {
  assertCurrencyReadable,
  assertHeadingHierarchy,
  assertKeyboardReachable,
  assertNoSeriousA11yViolations,
  assertTransactionSemantics,
  assertVisibleFocusRing,
} from "./fixtures/wallet-a11y-helpers";
import {
  DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH,
  loginDenaliWalletPilotOwner,
} from "../../../web/tests/e2e/fixtures/denali-wallet-pilot-owner-session";
import { WALLET_OPS_TEST_IDS } from "../../../web/src/wallet/wallet-ops-logic";

test.describe("WALLET-A11Y member portal", () => {
  test.setTimeout(300_000);

  test("WALLET-A11Y-M01 dashboard wallet summary positive balance (desktop)", async ({
    page,
  }) => {
    await loginDenaliWalletPilotMember(page);
    await page.goto("/me/home", { waitUntil: "domcontentloaded" });
    const walletSection = page.locator("[data-portal-member-dashboard-wallet]");
    await expect(walletSection).toHaveAttribute("data-portal-member-wallet-state", "ready", {
      timeout: 90_000,
    });
    await assertCurrencyReadable(page.locator("[data-portal-member-wallet-dashboard-balance]"));
    await assertHeadingHierarchy(walletSection);
    await assertNoSeriousA11yViolations(
      page,
      "[data-portal-member-dashboard-wallet]",
      "dashboard wallet positive balance",
    );
    await assertKeyboardReachable(page, page.locator("[data-portal-member-wallet-cta]"));
    await assertVisibleFocusRing(page, page.locator("[data-portal-member-wallet-cta]"));
  });

  test("WALLET-A11Y-M02 dashboard wallet summary positive balance (mobile RTL)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginDenaliWalletPilotMember(page);
    await page.goto("/me/home", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-dashboard-wallet]")).toHaveAttribute(
      "data-portal-member-wallet-state",
      "ready",
      { timeout: 90_000 },
    );
    await assertNoSeriousA11yViolations(
      page,
      "[data-portal-member-dashboard-wallet]",
      "dashboard wallet mobile RTL",
    );
  });

  test("WALLET-A11Y-M03 dashboard wallet summary zero balance", async ({ page }) => {
    await loginDenaliWalletPilotMember(page, DENALI_WALLET_PILOT.zeroBalanceMemberMobile);
    await page.goto("/me/home", { waitUntil: "domcontentloaded" });
    const walletSection = page.locator("[data-portal-member-dashboard-wallet]");
    await expect(walletSection).toHaveAttribute("data-portal-member-wallet-state", "ready", {
      timeout: 90_000,
    });
    await expect(page.locator("[data-portal-member-wallet-dashboard-balance]")).toContainText(
      /۰|0|ریال/,
    );
    await expect(page.locator("[data-portal-member-wallet-empty-history]")).toBeVisible();
    await assertNoSeriousA11yViolations(
      page,
      "[data-portal-member-dashboard-wallet]",
      "dashboard wallet zero balance",
    );
  });

  test("WALLET-A11Y-M04 wallet page balance and transaction history", async ({ page }) => {
    await loginDenaliWalletPilotMember(page);
    await page.goto("/me/wallet", { waitUntil: "domcontentloaded" });
    const walletMain = page.locator(
      "[data-portal-member-wallet][data-portal-member-wallet-state='ready']",
    );
    await expect(walletMain).toBeVisible({ timeout: 90_000 });
    await assertHeadingHierarchy(walletMain);
    await assertCurrencyReadable(page.locator("[data-portal-member-wallet-balance-amount]"));
    await assertTransactionSemantics(page);
    await assertNoSeriousA11yViolations(page, "[data-portal-member-wallet]", "wallet page ready");
  });

  test("WALLET-A11Y-M05 wallet page empty history state", async ({ page }) => {
    await loginDenaliWalletPilotMember(page, DENALI_WALLET_PILOT.zeroBalanceMemberMobile);
    await page.goto("/me/wallet", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-portal-member-wallet][data-portal-member-wallet-state='ready']"),
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-portal-member-wallet-empty]")).toBeVisible();
    await assertNoSeriousA11yViolations(
      page,
      "[data-portal-member-wallet-empty]",
      "wallet empty history",
    );
  });

  test("WALLET-A11Y-M06 wallet entitlement denied state", async ({ page }) => {
    await loginDenaliWalletPilotMember(page, DENALI_WALLET_PILOT.deniedMemberMobile);
    await page.goto("/me/wallet", { waitUntil: "domcontentloaded" });
    const denied = page.locator(
      "[data-portal-member-unauthorized][data-portal-member-unauthorized-module='wallet']",
    );
    await expect(denied).toBeVisible({ timeout: 90_000 });
    await assertNoSeriousA11yViolations(
      page,
      "[data-portal-member-unauthorized][data-portal-member-unauthorized-module='wallet']",
      "wallet denied",
    );
    await assertKeyboardReachable(page, page.locator("[data-portal-member-status-actions] a"));
  });

  test("WALLET-A11Y-M07 wallet notification in shared inbox", async ({ browser }) => {
    const memberContext = await browser.newContext({
      baseURL: "http://portal.denali-wallet-pilot.localhost:3003",
    });
    const operatorContext = await browser.newContext({
      baseURL: "http://admin.denali-wallet-pilot.localhost:3000",
    });
    const memberPage = await memberContext.newPage();
    const operatorPage = await operatorContext.newPage();

    try {
      await loginDenaliWalletPilotMember(memberPage);
      await loginDenaliWalletPilotOwner(operatorPage);
      await operatorPage.goto(DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH);
      await operatorPage
        .getByTestId(WALLET_OPS_TEST_IDS.searchInput)
        .fill(DENALI_WALLET_PILOT.entitledMemberUserId);
      await operatorPage.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();
      await operatorPage.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first().click();
      await operatorPage.getByTestId(WALLET_OPS_TEST_IDS.creditButton).click();
      await operatorPage.getByTestId(WALLET_OPS_TEST_IDS.mutationAmount).fill("1500");
      await operatorPage
        .getByTestId(WALLET_OPS_TEST_IDS.mutationReason)
        .fill(`wallet-a11y-notif-${Date.now()}`);
      await operatorPage.getByTestId(WALLET_OPS_TEST_IDS.mutationConfirm).click();
      await expect(operatorPage.getByTestId(WALLET_OPS_TEST_IDS.mutationFeedback)).toBeVisible({
        timeout: 60_000,
      });

      relayWalletOutboxForTenant(DENALI_WALLET_PILOT.tenantId);

      await memberPage.goto("/me/notifications", { waitUntil: "domcontentloaded" });
      const inbox = memberPage.locator(
        "[data-portal-member-notifications][data-portal-member-notifications-state='ready']",
      );
      await expect(inbox).toBeVisible({ timeout: 90_000 });
      const walletItem = memberPage
        .locator(
          "[data-portal-member-notification-item][data-portal-member-notification-source='wallet']",
        )
        .first();
      await expect(walletItem).toBeVisible({ timeout: 60_000 });
      await assertNoSeriousA11yViolations(
        memberPage,
        "[data-portal-member-notifications][data-portal-member-notifications-state='ready']",
        "wallet notification inbox",
      );
      await assertKeyboardReachable(memberPage, walletItem.locator("a").first());
    } finally {
      await memberContext.close();
      await operatorContext.close();
    }
  });

  test("WALLET-A11Y-M09 wallet transaction history error state", async ({ page }) => {
    await loginDenaliWalletPilotMember(page);
    await page.goto("/me/wallet", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-portal-member-wallet][data-portal-member-wallet-state='ready']"),
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-portal-member-wallet-transaction]")).toHaveCount(20, {
      timeout: 60_000,
    });
    const probe = await page.request.get("/api/me/wallet/transactions?limit=20");
    expect(probe.ok()).toBeTruthy();
    const probeBody = (await probe.json()) as {
      ok?: boolean;
      history?: { nextCursor?: string | null; hasMore?: boolean };
    };
    expect(probeBody.ok).toBe(true);
    expect(probeBody.history?.hasMore).toBe(true);
    expect(typeof probeBody.history?.nextCursor).toBe("string");

    const loadMore = page.getByRole("button", { name: /نمایش بیشتر|load more/i });
    await expect(loadMore).toBeVisible({ timeout: 60_000 });
    await page.route("**/api/me/wallet/transactions**", async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, code: "WALLET_HISTORY_FAILED" }),
      });
    });
    const historyRequest = page.waitForRequest((request) =>
      request.url().includes("/api/me/wallet/transactions"),
    );
    await loadMore.click();
    await historyRequest;
    await expect(page.locator("[data-portal-member-wallet-history-error]")).toBeVisible({
      timeout: 30_000,
    });
    await assertNoSeriousA11yViolations(
      page,
      "[data-portal-member-wallet-transactions]",
      "wallet history error",
    );
  });

  test("WALLET-A11Y-M08 wallet history load-more keyboard and focus", async ({ page }) => {
    await loginDenaliWalletPilotMember(page);
    await page.goto("/me/wallet", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator("[data-portal-member-wallet][data-portal-member-wallet-state='ready']"),
    ).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-portal-member-wallet-transaction]")).toHaveCount(20, {
      timeout: 60_000,
    });
    const loadMore = page.getByRole("button", { name: /نمایش بیشتر|load more/i });
    await expect(loadMore).toBeVisible({ timeout: 60_000 });
    await assertKeyboardReachable(page, loadMore);
    await assertVisibleFocusRing(page, loadMore);
    await assertNoSeriousA11yViolations(
      page,
      "[data-portal-member-wallet-transactions]",
      "wallet history load-more control",
    );
  });
});
