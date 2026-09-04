/**
 * MEG-001 — Denali operator engagement overview smoke.
 */
import { expect, test } from "@playwright/test";

import {
  loginDenaliOperatorOwner,
  loginDenaliOperatorViewer,
} from "./fixtures/authenticate-denali-operator-for-engagement";

test.describe("MEG-001 Denali operator engagement", () => {
  test("SMK-MEG-OP-01 overview loads with recent points separate from wallet", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });

    await loginDenaliOperatorOwner(page);

    const overviewRes = await page.request.get("/api/engagement/overview");
    expect(overviewRes.ok(), await overviewRes.text()).toBeTruthy();
    const overviewPayload = (await overviewRes.json()) as {
      recentPointEvents?: readonly { pointsDelta: number; sourceEventType: string }[];
    };
    expect(Array.isArray(overviewPayload.recentPointEvents)).toBeTruthy();
    expect(overviewPayload.recentPointEvents!.length).toBeGreaterThan(0);

    await page.goto("/engagement", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-operator-engagement-page]")).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("[data-operator-engagement-recent-points]")).toBeVisible();
    await expect(page.locator("[data-operator-engagement-recent-badges]")).toBeVisible();

    const lede = await page.locator("[data-operator-page-header-description]").innerText();
    expect(lede).toMatch(/wallet|کیف پول/i);
    expect(lede).not.toMatch(/ریال|تومان|\$/);

    const pointsSection = await page
      .locator("[data-operator-engagement-recent-points]")
      .innerText();
    expect(pointsSection).toMatch(/profile|پروفایل/i);
    expect(pointsSection).not.toMatch(/profile\.completed/);
    expect(pointsSection).not.toMatch(/ریال|تومان|\$/);

    const walletNav = page.getByRole("link", { name: /wallet|کیف پول/i });
    if ((await walletNav.count()) > 0) {
      expect(pointsSection).not.toEqual(await walletNav.first().innerText());
    }

    expect(
      consoleErrors.filter(
        (line) => !line.includes("favicon") && !line.includes("Download the React DevTools"),
      ),
    ).toEqual([]);

    await page.screenshot({
      path: "/opt/cursor/artifacts/operator-engagement-desktop.png",
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("[data-operator-engagement-page]")).toBeVisible();
    const dir = await page.locator("html").getAttribute("dir");
    expect(dir === "rtl" || dir === "ltr").toBeTruthy();
    await page.screenshot({
      path: "/opt/cursor/artifacts/operator-engagement-mobile.png",
      fullPage: true,
    });
  });

  test("SMK-MEG-OP-02 loading and error states", async ({ page }) => {
    await loginDenaliOperatorOwner(page);

    await page.route("**/api/engagement/overview", async (route) => {
      await route.fulfill({ status: 500, body: JSON.stringify({ error: "forced" }) });
    });
    await page.goto("/engagement", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-operator-engagement-error]")).toBeVisible({ timeout: 60_000 });
  });

  test("SMK-MEG-OP-03 viewer receives permission denied from engagement API", async ({
    page,
  }) => {
    await loginDenaliOperatorViewer(page);
    const overviewRes = await page.request.get("/api/engagement/overview");
    expect([403]).toContain(overviewRes.status());
  });

  test("SMK-MEG-OP-04 member point history visible in recent awards list", async ({ page }) => {
    await loginDenaliOperatorOwner(page);
    await page.goto("/engagement", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-operator-engagement-recent-points] li").first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-operator-engagement-recent-points]")).toContainText("+50");
  });
});
