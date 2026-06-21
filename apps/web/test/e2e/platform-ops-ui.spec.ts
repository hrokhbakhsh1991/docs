/**
 * P1 §J internal — platform ops UI E2E (audit, overview, sites, domains, suspend, settings).
 */
import { expect, test } from "@playwright/test";

import {
  createPlatformClubViaBff,
  openPlatformClubDetail,
  openPlatformClubDomainsTab,
  upgradePlatformClubToEnterprise,
} from "../fixtures/platform-e2e-helpers";
import {
  loginPlatformOps,
  PLATFORM_OPS_PHONE,
} from "../fixtures/platform-ops-session";

test.describe("platform-ops-ui.spec.ts — P1 §J internal", () => {
  test.describe.configure({ mode: "serial" });
  test.setTimeout(240_000);

  test("settings placeholder loads", async ({ page }) => {
    await loginPlatformOps(page);
    await page.goto("/platform/settings", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("platform-settings-page")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });

  test("audit lists tenant created", async ({ page }) => {
    await loginPlatformOps(page);
    await createPlatformClubViaBff(page);

    await page.goto("/platform/audit", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("platform-audit-page")).toBeVisible({ timeout: 30_000 });

    const auditRow = page.getByTestId("audit-row").filter({ hasText: "TENANT_CREATED" }).first();
    await expect(auditRow).toBeVisible({ timeout: 30_000 });
    await expect(auditRow).toContainText(PLATFORM_OPS_PHONE);
  });

  test("overview stats after provision", async ({ page }) => {
    await loginPlatformOps(page);
    await createPlatformClubViaBff(page);

    await page.goto("/platform", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-platform-overview]")).toBeVisible({ timeout: 30_000 });
    const totalText = await page.getByTestId("data-stat-total").locator("div").last().textContent();
    const total = Number.parseInt(totalText?.trim() ?? "0", 10);
    expect(total).toBeGreaterThanOrEqual(1);

    await expect(page.getByTestId("data-stat-unhealthy")).toBeVisible();
    const unhealthyText = await page
      .getByTestId("data-stat-unhealthy")
      .locator("div")
      .last()
      .textContent();
    const unhealthy = Number.parseInt(unhealthyText?.trim() ?? "-1", 10);
    expect(unhealthy).toBeGreaterThanOrEqual(0);
  });

  test("sites health check actionable", async ({ page }) => {
    await loginPlatformOps(page);
    const { tenantId } = await createPlatformClubViaBff(page);
    await openPlatformClubDetail(page, tenantId);

    await page.getByRole("button", { name: "Sites", exact: true }).click();
    await expect(page.getByTestId("sites-check-health")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("sites-check-health").click();
    await expect(page.getByTestId("sites-health-results")).toBeVisible({ timeout: 60_000 });
    const healthRows = page.getByTestId("sites-health-results").locator("li");
    await expect(healthRows).toHaveCount(3);
    const downSurfaceCount = await healthRows.filter({ hasText: "down" }).count();

    await page.goto("/platform", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("data-stat-unhealthy")).toBeVisible({ timeout: 30_000 });
    const unhealthyAfterCheckText = await page
      .getByTestId("data-stat-unhealthy")
      .locator("div")
      .last()
      .textContent();
    const unhealthyAfterCheck = Number.parseInt(unhealthyAfterCheckText?.trim() ?? "-1", 10);
    expect(unhealthyAfterCheck).toBeGreaterThanOrEqual(0);
    if (downSurfaceCount > 0) {
      expect(unhealthyAfterCheck).toBeGreaterThanOrEqual(1);
    }
  });

  test("domains add custom hostname", async ({ page }) => {
    await loginPlatformOps(page);
    const { tenantId } = await createPlatformClubViaBff(page);
    await upgradePlatformClubToEnterprise(page, tenantId);
    await openPlatformClubDetail(page, tenantId);

    const hostname = `custom-${Date.now().toString(36)}.example.test`;
    const domainsPanel = await openPlatformClubDomainsTab(page, tenantId);
    await domainsPanel.locator("input").fill(hostname);
    await domainsPanel.getByRole("button", { name: "Add" }).click();
    await expect(domainsPanel.filter({ hasText: hostname })).toBeVisible({
      timeout: 30_000,
    });
  });

  test("suspend via actions tab", async ({ page }) => {
    await loginPlatformOps(page);
    const { tenantId } = await createPlatformClubViaBff(page);
    await openPlatformClubDetail(page, tenantId);

    await page.getByRole("button", { name: "Actions", exact: true }).click();
    await page.locator("[data-action-suspend]").click();
    await expect(page.locator("[data-platform-club-detail] [data-status=suspended]")).toBeVisible({
      timeout: 30_000,
    });
  });
});
