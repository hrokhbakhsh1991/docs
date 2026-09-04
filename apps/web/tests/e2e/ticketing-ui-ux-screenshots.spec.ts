/**
 * FDA-001 — Operator ticketing UI/UX evidence screenshots.
 * Deterministic before/after: `node scripts/capture-ticketing-ui-ux-evidence.mjs`
 */
import { expect, test } from "@playwright/test";

import { loginOperatorOwner } from "../../test/fixtures/operator-owner-session";
import { OPERATOR_TICKETS_TEST_IDS } from "../../src/features/tickets/operator-tickets-types";

const PHASE = process.env.TICKETING_UI_UX_PHASE ?? "before";
const OUT_ROOT = `/opt/cursor/artifacts/screenshots/ticketing-ui-ux/${PHASE}`;

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
  { name: "360x800", width: 360, height: 800 },
] as const;

test.describe(`operator ticketing UI/UX screenshots (${PHASE})`, () => {
  test.beforeEach(async ({ page }) => {
    await loginOperatorOwner(page);
  });

  async function openOperatorTicketDetail(
    page: import("@playwright/test").Page,
    viewport: (typeof VIEWPORTS)[number],
  ): Promise<void> {
    await expect(
      page.locator("[data-operator-tickets][data-operator-tickets-ready='true']"),
    ).toBeVisible({ timeout: 90_000 });

    const rows = page.getByTestId(OPERATOR_TICKETS_TEST_IDS.inboxRow);
    await expect(rows.first()).toBeVisible({ timeout: 60_000 });
    const readyDetail = page
      .locator("[data-operator-tickets-detail-state='ready']")
      .filter({ visible: true });
    if (await readyDetail.isVisible()) {
      return;
    }
    await rows.first().click();
    if (viewport.width < 1024) {
      await expect(page.getByTestId(OPERATOR_TICKETS_TEST_IDS.mobileSheet)).toBeVisible({
        timeout: 60_000,
      });
    }
    await expect(readyDetail).toBeVisible({ timeout: 60_000 });
    await expect(readyDetail.getByTestId(OPERATOR_TICKETS_TEST_IDS.composer)).toBeVisible({
      timeout: 60_000,
    });
  }

  for (const viewport of VIEWPORTS) {
    test(`operator inbox @ ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/tickets", { waitUntil: "load" });
      await expect(page.getByTestId(OPERATOR_TICKETS_TEST_IDS.shell)).toBeVisible({
        timeout: 120_000,
      });
      await page.screenshot({
        path: `${OUT_ROOT}/${viewport.name}/operator-tickets-inbox.png`,
        fullPage: true,
      });
    });

    test(`operator detail @ ${viewport.name}`, async ({ page }) => {
      test.skip(PHASE !== "after", "operator detail screenshots are after-remediation evidence only");

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/tickets", { waitUntil: "load" });
      await expect(page.getByTestId(OPERATOR_TICKETS_TEST_IDS.shell)).toBeVisible({
        timeout: 120_000,
      });
      await openOperatorTicketDetail(page, viewport);
      await page.screenshot({
        path: `${OUT_ROOT}/${viewport.name}/operator-tickets-detail.png`,
        fullPage: true,
      });
    });
  }
});
