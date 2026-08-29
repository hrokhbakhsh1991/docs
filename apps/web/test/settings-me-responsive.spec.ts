/**
 * Settings > Me responsive layout — scrollWidth/clientWidth regression (S9-R7).
 */
import { expect, test } from "@playwright/test";

import { SETTINGS_HUB_TEST_IDS } from "../src/features/settings/settings-module-types";
import { loginOperatorOwner } from "./fixtures/operator-owner-session";

const VIEWPORTS = [
  { label: "1440", width: 1440, height: 900 },
  { label: "1024", width: 1024, height: 768 },
  { label: "768", width: 768, height: 1024 },
  { label: "390", width: 390, height: 844 },
] as const;

async function readLayoutMetrics(page: import("@playwright/test").Page) {
  return page.evaluate((profileTestId) => {
    const doc = document.documentElement;
    const body = document.body;
    const profilePage = document.querySelector(`[data-testid="${profileTestId}"]`);
    const card = profilePage?.querySelector(".rounded-\\[var\\(--radius\\)\\]") ?? null;

    function rect(el: Element | null) {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left: Math.round(r.left),
        right: Math.round(r.right),
        width: Math.round(r.width),
      };
    }

    return {
      dir: doc.getAttribute("dir"),
      doc: {
        scrollWidth: doc.scrollWidth,
        clientWidth: doc.clientWidth,
        overflow: doc.scrollWidth > doc.clientWidth,
      },
      body: {
        scrollWidth: body.scrollWidth,
        clientWidth: body.clientWidth,
        overflow: body.scrollWidth > body.clientWidth,
      },
      profilePage: rect(profilePage),
      card: rect(card),
    };
  }, SETTINGS_HUB_TEST_IDS.profilePage);
}

test.describe("settings-me-responsive", () => {
  test("WEB-9.6-ME-05 no horizontal overflow across breakpoints", async ({ page }) => {
    await loginOperatorOwner(page);
    await page.goto("/settings/me", { waitUntil: "networkidle" });
    await expect(page.getByTestId(SETTINGS_HUB_TEST_IDS.profilePage)).toBeVisible({
      timeout: 15_000,
    });

    for (const viewport of VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(200);
      const metrics = await readLayoutMetrics(page);

      expect(metrics.doc.overflow, `doc overflow @ ${viewport.label}`).toBe(false);
      expect(metrics.body.overflow, `body overflow @ ${viewport.label}`).toBe(false);

      if (metrics.card && metrics.profilePage) {
        const cardCenter = (metrics.card.left + metrics.card.right) / 2;
        const pageCenter = (metrics.profilePage.left + metrics.profilePage.right) / 2;
        expect(
          Math.abs(cardCenter - pageCenter),
          `card center drift @ ${viewport.label}`
        ).toBeLessThan(8);
      }

      await page.screenshot({
        path: `/opt/cursor/artifacts/settings-me-${viewport.label}.png`,
        fullPage: true,
      });
    }
  });
});
