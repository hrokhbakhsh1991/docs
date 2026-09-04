/**
 * WALLET-V1 — browser proof: operator credit → outbox relay → member notification bell.
 */
import { expect, test } from "@playwright/test";

import { DENALI_WALLET_PILOT } from "../../../api/test/fixtures/denali-wallet-pilot-tenant";
import { loginDenaliWalletPilotMember } from "./fixtures/denali-wallet-pilot-member-session";
import { relayWalletOutboxForTenant } from "./fixtures/relay-wallet-outbox";
import {
  DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH,
  loginDenaliWalletPilotOwner,
} from "../../../web/tests/e2e/fixtures/denali-wallet-pilot-owner-session";
import { WALLET_OPS_TEST_IDS } from "../../../web/src/wallet/wallet-ops-logic";

test("WALLET-NOTIF-01 operator credit surfaces wallet notification in portal bell", async ({
  browser,
}) => {
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
    const beforeUnreadRes = await memberPage.request.get("/api/me/notifications/unread-count");
    expect(beforeUnreadRes.ok()).toBeTruthy();
    const beforeUnread = (await beforeUnreadRes.json()) as { count?: number };
    const beforeCount = beforeUnread.count ?? 0;

    const engagementBefore = await memberPage.request.get("/api/me/engagement/summary");
    expect(engagementBefore.ok()).toBeTruthy();
    const engagementBody = (await engagementBefore.json()) as { totalPoints?: number };
    const pointsBefore = engagementBody.totalPoints ?? 0;

    await loginDenaliWalletPilotOwner(operatorPage);
    await operatorPage.goto(DENALI_WALLET_PILOT_OPERATOR_WALLET_PATH);
    await operatorPage
      .getByTestId(WALLET_OPS_TEST_IDS.searchInput)
      .fill(DENALI_WALLET_PILOT.entitledMemberUserId);
    await operatorPage.getByTestId(WALLET_OPS_TEST_IDS.searchSubmit).click();
    await operatorPage.getByTestId(WALLET_OPS_TEST_IDS.accountRow).first().click();
    await operatorPage.getByTestId(WALLET_OPS_TEST_IDS.creditButton).click();
    await operatorPage.getByTestId(WALLET_OPS_TEST_IDS.mutationAmount).fill("2500");
    await operatorPage
      .getByTestId(WALLET_OPS_TEST_IDS.mutationReason)
      .fill(`wallet-notif-e2e-${Date.now()}`);
    await operatorPage.getByTestId(WALLET_OPS_TEST_IDS.mutationConfirm).click();
    await expect(operatorPage.getByTestId(WALLET_OPS_TEST_IDS.mutationFeedback)).toBeVisible({
      timeout: 60_000,
    });

    relayWalletOutboxForTenant(DENALI_WALLET_PILOT.tenantId);

    await expect
      .poll(async () => {
        const res = await memberPage.request.get("/api/me/notifications/unread-count");
        if (!res.ok()) return beforeCount;
        const body = (await res.json()) as { count?: number };
        return body.count ?? 0;
      })
      .toBeGreaterThan(beforeCount);

    await memberPage.goto("/me/notifications", { waitUntil: "domcontentloaded" });
    await expect(
      memberPage.locator(
        "[data-portal-member-notifications][data-portal-member-notifications-state='ready']",
      ),
    ).toBeVisible({ timeout: 90_000 });
    await expect(
      memberPage.locator(
        "[data-portal-member-notification-item][data-portal-member-notification-source='wallet']",
      ).first(),
    ).toBeVisible({ timeout: 60_000 });

    const engagementAfter = await memberPage.request.get("/api/me/engagement/summary");
    expect(engagementAfter.ok()).toBeTruthy();
    const engagementAfterBody = (await engagementAfter.json()) as { totalPoints?: number };
    expect(engagementAfterBody.totalPoints ?? 0).toBe(pointsBefore);

    await memberPage.screenshot({
      path: "/opt/cursor/artifacts/denali-wallet-notification-inbox.png",
      fullPage: true,
    });
  } finally {
    await memberContext.close();
    await operatorContext.close();
  }
});
