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

    await expect(page.getByTestId("operator-engagement-tab-members")).toHaveCount(0);
    await expect(page.getByTestId("operator-engagement-member-ops-users-link")).toBeVisible();

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

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("[data-operator-engagement-page]")).toBeVisible();
    const dir = await page.locator("html").getAttribute("dir");
    expect(dir === "rtl" || dir === "ltr").toBeTruthy();
  });

  test("SMK-MEG-OP-02 loading and error states", async ({ page }) => {
    await loginDenaliOperatorOwner(page);

    await page.route("**/api/engagement/overview", async (route) => {
      await route.fulfill({ status: 500, body: JSON.stringify({ error: "forced" }) });
    });
    await page.goto("/engagement", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-operator-engagement-error]")).toBeVisible({ timeout: 60_000 });
  });

  test("SMK-MEG-OP-03 viewer can read overview but not mutate", async ({ page }) => {
    await loginDenaliOperatorViewer(page);
    const overviewRes = await page.request.get("/api/engagement/overview");
    expect(overviewRes.ok(), await overviewRes.text()).toBeTruthy();

    const badgePostRes = await page.request.post("/api/engagement/badges", {
      headers: { "Idempotency-Key": "smk-meg-op-03-viewer-denied" },
      data: {
        code: "viewer_denied_badge",
        titleI18n: { en: "Denied", fa: "رد" },
        descriptionI18n: { en: "Denied", fa: "رد" },
        iconKey: "mountain",
        triggerKind: "event",
        triggerEventType: "profile.completed",
      },
    });
    expect(badgePostRes.status()).toBe(403);
  });

  test("SMK-MEG-OP-04 member point history visible in recent awards list", async ({ page }) => {
    await loginDenaliOperatorOwner(page);
    await page.goto("/engagement", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-operator-engagement-recent-points] li").first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator("[data-operator-engagement-recent-points]")).toContainText("+50");
  });

  test("SMK-MEG-OP-05 member search by phone and adjust/reverse", async ({ page }) => {
    await loginDenaliOperatorOwner(page);
    await page.goto("/users", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("operator-users-page")).toBeVisible({ timeout: 60_000 });

    await page.getByTestId("operator-users-search").fill("09174070937");
    await expect(page.getByTestId("operator-users-row-details").first()).toBeVisible({
      timeout: 60_000,
    });
    await page.getByTestId("operator-users-row-details").first().click();
    await expect(page.getByTestId("operator-users-member-detail")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByTestId("operator-users-member-engagement")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId("operator-engagement-member-lookup-result")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByTestId("operator-engagement-member-history")).toBeVisible();

    await page.screenshot({
      path: "/opt/cursor/artifacts/ia-after-users-member-engagement.png",
      fullPage: true,
    });

    const pointsBefore = Number.parseInt(
      await page.getByTestId("operator-engagement-member-points").innerText(),
      10,
    );

    await page.getByTestId("operator-engagement-adjust-button").click();
    await expect(page.getByTestId("operator-engagement-adjust-dialog")).toBeVisible();
    await page.locator("#engagement-adjust-points").fill("5");
    await page.locator("#engagement-adjust-reason").fill("SMK-MEG-OP-05 operator recognition");
    await page.getByRole("button", { name: /confirm|تأیید/i }).click();

    await expect(page.getByTestId("operator-engagement-member-points")).toContainText(
      String(pointsBefore + 5),
      { timeout: 60_000 },
    );

    await page.getByTestId("operator-engagement-reverse-button").first().click();
    await expect(page.getByTestId("operator-engagement-reverse-dialog")).toBeVisible();
    await page.locator("#engagement-reverse-reason").fill("SMK-MEG-OP-05 reversal smoke");
    await page.getByRole("button", { name: /confirm|تأیید/i }).click();

    await expect(page.getByTestId("operator-engagement-member-points")).toContainText(
      String(pointsBefore),
      { timeout: 60_000 },
    );

    await page.screenshot({
      path: "/opt/cursor/artifacts/operator-engagement-adjust-reverse.png",
      fullPage: true,
    });
  });

  test("SMK-MEG-OP-06 owner creates badge, activates, refreshes and sees it", async ({ page }) => {
    await loginDenaliOperatorOwner(page);
    const badgeCode = `smk_meg_op_06_${Date.now()}`;

    await page.goto("/engagement", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-operator-engagement-recent-points]")).toBeVisible({
      timeout: 60_000,
    });
    await page.getByTestId("operator-engagement-tab-badges").click();
    await expect(page.getByTestId("operator-engagement-badges-panel")).toBeVisible({
      timeout: 60_000,
    });

    await page.getByTestId("operator-engagement-badges-create-button").click();
    await expect(page.getByTestId("operator-engagement-badges-create-dialog")).toBeVisible();
    await page.locator("#badge-code").fill(badgeCode);
    await page.locator("#badge-title-en").fill("SMK OP 06 Badge");
    await page.locator("#badge-title-fa").fill("نشان تست ۰۶");
    await page.locator("#badge-desc-en").fill("Created by SMK-MEG-OP-06");
    await page.locator("#badge-desc-fa").fill("ایجاد شده توسط SMK-MEG-OP-06");
    await page.getByRole("button", { name: /create badge|ایجاد نشان/i }).click();

    await expect(page.locator(`[data-badge-code="${badgeCode}"]`)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(`[data-badge-code="${badgeCode}"]`)).toContainText(/inactive|غیرفعال/i);

    await page
      .locator(`[data-badge-code="${badgeCode}"]`)
      .getByRole("button", { name: /activate|فعال/i })
      .click();
    await expect(page.locator(`[data-badge-code="${badgeCode}"]`)).toContainText(/active|فعال/i, {
      timeout: 60_000,
    });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-operator-engagement-recent-points]")).toBeVisible({
      timeout: 60_000,
    });
    await page.getByTestId("operator-engagement-tab-badges").click();
    await expect(page.getByTestId("operator-engagement-badges-panel")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.locator(`[data-badge-code="${badgeCode}"]`)).toBeVisible({ timeout: 60_000 });
    await expect(page.locator(`[data-badge-code="${badgeCode}"]`)).toContainText(/active|فعال/i);
  });

  test("SMK-MEG-OP-07 owner creates award rule for profile.completed", async ({ page }) => {
    await loginDenaliOperatorOwner(page);
    const badgeCode = `smk_meg_op_07_${Date.now()}`;

    const badgePostRes = await page.request.post("/api/engagement/badges", {
      headers: { "Idempotency-Key": `smk-meg-op-07-badge-${badgeCode}` },
      data: {
        code: badgeCode,
        titleI18n: { en: "SMK OP 07", fa: "تست ۰۷" },
        descriptionI18n: { en: "Rule badge", fa: "نشان قاعده" },
        iconKey: "star",
        triggerKind: "event",
        triggerEventType: "profile.completed",
        status: "active",
      },
    });
    expect(badgePostRes.ok(), await badgePostRes.text()).toBeTruthy();

    await page.goto("/engagement", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-operator-engagement-recent-points]")).toBeVisible({
      timeout: 60_000,
    });
    await page.getByTestId("operator-engagement-tab-award-rules").click();
    await expect(page.getByTestId("operator-engagement-award-rules-panel")).toBeVisible({
      timeout: 60_000,
    });

    await page.getByTestId("operator-engagement-award-rules-create-button").click();
    await page.locator("#rule-event").selectOption("profile.completed");
    await page.locator("#rule-points").fill("12");
    await page.locator("#rule-badge").selectOption(badgeCode);
    await page.getByRole("button", { name: /create rule|ایجاد قاعده/i }).click();

    await expect(
      page.locator('[data-rule-event="profile.completed"]').filter({ hasText: "+12" }).first(),
    ).toBeVisible({ timeout: 60_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-operator-engagement-recent-points]")).toBeVisible({
      timeout: 60_000,
    });
    await page.getByTestId("operator-engagement-tab-award-rules").click();
    await expect(
      page.locator('[data-rule-event="profile.completed"]').filter({ hasText: "+12" }).first(),
    ).toBeVisible({ timeout: 60_000 });
  });

  test("SMK-MEG-OP-08 viewer GET overview OK but POST badge returns 403", async ({ page }) => {
    await loginDenaliOperatorViewer(page);

    const overviewRes = await page.request.get("/api/engagement/overview");
    expect(overviewRes.ok(), await overviewRes.text()).toBeTruthy();

    await page.goto("/engagement", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("operator-engagement-tab-badges")).toBeVisible({ timeout: 60_000 });
    await page.getByTestId("operator-engagement-tab-badges").click();

    const badgePostRes = await page.request.post("/api/engagement/badges", {
      headers: { "Idempotency-Key": "smk-meg-op-08-viewer-denied" },
      data: {
        code: "viewer_denied_badge_08",
        titleI18n: { en: "Denied", fa: "رد" },
        descriptionI18n: { en: "Denied", fa: "رد" },
        iconKey: "mountain",
        triggerKind: "event",
        triggerEventType: "profile.completed",
      },
    });
    expect(badgePostRes.status()).toBe(403);
  });
});
