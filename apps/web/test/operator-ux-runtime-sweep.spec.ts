/**
 * Operator UX runtime sweep — local dev evidence harness.
 * Run: pnpm --filter @apps/web exec playwright test test/operator-ux-runtime-sweep.spec.ts --config=playwright.operator.config.ts
 */
import { expect, test } from "@playwright/test";

import { OPERATOR_NAV_TEST_IDS } from "../src/admin/shell/operator-nav.types";
import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../src/features/bookings/bookings-command-center-types";
import { FINANCE_TOUR_FILTER_TEST_IDS } from "../src/finance/finance-tour-filter";
import { loginOperatorOwner } from "./fixtures/operator-owner-session";

const sweep = test.extend({
  page: async ({ page }, use) => {
    await loginOperatorOwner(page);
    await use(page);
  },
});

async function openUsersDrawer(page: import("@playwright/test").Page) {
  const openBtn = page.getByRole("button", { name: /باز کردن عضو/i }).first();
  await expect(openBtn).toBeVisible({ timeout: 15_000 });
  await openBtn.click();
  await expect(page.locator("[data-operator-sheet-panel]")).toBeVisible({ timeout: 5_000 });
}

async function readDrawerMetrics(page: import("@playwright/test").Page) {
  return page.evaluate(() => {
    const panel = document.querySelector("[data-operator-sheet-panel]");
    const overlay = document.querySelector("[data-operator-sheet-overlay]");
    if (!panel) return null;
    const rect = panel.getBoundingClientRect();
    const cs = getComputedStyle(panel);
    const overlayCs = overlay ? getComputedStyle(overlay) : null;
    return {
      dir: document.documentElement.getAttribute("dir"),
      locale: document.body.getAttribute("data-locale"),
      side: panel.getAttribute("data-operator-sheet-side"),
      enterFrom: panel.getAttribute("data-operator-sheet-enter-from"),
      state: panel.getAttribute("data-state"),
      left: Math.round(rect.left),
      right: Math.round(rect.right),
      width: Math.round(rect.width),
      animationName: cs.animationName,
      animationDuration: cs.animationDuration,
      overlayAnimation: overlayCs?.animationName ?? null,
    };
  });
}

test.describe("operator-ux-runtime-sweep", () => {
  sweep("§1 users drawer RTL 1440", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/users", { waitUntil: "domcontentloaded" });
    await openUsersDrawer(page);
    const metrics = await readDrawerMetrics(page);
    expect(metrics).not.toBeNull();
    expect(metrics?.dir).toBe("rtl");
    expect(metrics?.side).toBe("left");
    expect(metrics?.enterFrom).toBe("left");
    expect(metrics?.left).toBeLessThan(40);
    expect(metrics?.animationName).toContain("slide-in-left");

    const closeBtn = page.getByRole("button", { name: "Close" });
    await closeBtn.click();
    await page.waitForTimeout(40);
    const closing = await page.evaluate(() => {
      const panel = document.querySelector("[data-operator-sheet-panel]");
      if (!panel) return { gone: true };
      return { animation: getComputedStyle(panel).animationName, state: panel.getAttribute("data-state") };
    });
    expect(closing.gone || closing.animation?.includes("slide-out-left")).toBeTruthy();
  });

  sweep("§1 users drawer RTL 1024", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/users", { waitUntil: "domcontentloaded" });
    await openUsersDrawer(page);
    const metrics = await readDrawerMetrics(page);
    expect(metrics?.side).toBe("left");
    expect(metrics?.animationName).toContain("slide-in-left");
  });

  sweep("§1 users drawer LTR 1440", async ({ page, context }) => {
    await context.addCookies([
      { name: "NEXT_LOCALE", value: "en", domain: "admin.denali.localhost", path: "/" },
    ]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/users", { waitUntil: "domcontentloaded" });
    await openUsersDrawer(page);
    const metrics = await readDrawerMetrics(page);
    expect(metrics?.dir).toBe("ltr");
    expect(metrics?.side).toBe("right");
    expect(metrics?.right).toBeGreaterThan(700);
    expect(metrics?.animationName).toContain("slide-in-right");
  });

  sweep("§2 sidebar expanded/collapsed 1440", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    const collapse = page.getByTestId(OPERATOR_NAV_TEST_IDS.sidebarCollapse);
    await expect(collapse).toBeVisible();

    const expanded = await page.evaluate(() => {
      const brand = document.querySelector("[data-operator-sidebar-brand-mark]");
      const btn = document.querySelector("[data-operator-sidebar-collapse]");
      const cta = document.querySelector("[data-operator-nav-cta-link]");
      if (!brand || !btn) return null;
      const br = brand.getBoundingClientRect();
      const cr = btn.getBoundingClientRect();
      const ctaR = cta?.getBoundingClientRect();
      const overlap = !(cr.right < br.left || cr.left > br.right || cr.bottom < br.top || cr.top > br.bottom);
      return { overlapBrand: overlap, collapseAboveCta: ctaR ? cr.bottom <= ctaR.top : false };
    });
    expect(expanded?.overlapBrand).toBe(false);
    expect(expanded?.collapseAboveCta).toBe(true);

    await collapse.click();
    await page.waitForTimeout(300);
    const collapsed = await page.evaluate(() => {
      const brand = document.querySelector("[data-operator-sidebar-brand-mark]");
      const btn = document.querySelector("[data-operator-sidebar-collapse]");
      if (!brand || !btn) return null;
      const br = brand.getBoundingClientRect();
      const cr = btn.getBoundingClientRect();
      const overlap = !(cr.right < br.left || cr.left > br.right || cr.bottom < br.top || cr.top > br.bottom);
      return { overlapBrand: overlap, gap: cr.top - br.bottom };
    });
    expect(collapsed?.overlapBrand).toBe(false);
    expect(collapsed?.gap ?? 0).toBeGreaterThan(4);
  });

  sweep("§3 finance tour filter compact", async ({ page }) => {
    await page.goto("/finance", { waitUntil: "domcontentloaded" });
    const filter = page.getByTestId(FINANCE_TOUR_FILTER_TEST_IDS.root);
    await expect(filter).toBeVisible({ timeout: 15_000 });
    const box = await filter.boundingBox();
    expect(box?.height ?? 999).toBeLessThan(120);
    await filter.click();
    await expect(page.locator('[role="listbox"]')).toBeVisible({ timeout: 5_000 });
  });

  sweep("§4 bookings row avatar", async ({ page }) => {
    await page.goto("/bookings", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    const avatar = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.rowAvatar).first();
    await expect(avatar).toBeVisible({ timeout: 15_000 });
  });
});
