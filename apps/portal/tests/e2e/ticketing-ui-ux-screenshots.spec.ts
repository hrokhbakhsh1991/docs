/**
 * FDA-001 — Ticketing UI/UX evidence screenshots (before/after via TICKETING_UI_UX_PHASE env).
 */
import { expect, test } from "@playwright/test";

import { authenticatePortalMemberForTickets } from "./fixtures/authenticate-portal-member-for-tickets";

const PHASE = process.env.TICKETING_UI_UX_PHASE ?? "before";
const OUT_ROOT = `/opt/cursor/artifacts/screenshots/ticketing-ui-ux/${PHASE}`;

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
  { name: "360x800", width: 360, height: 800 },
] as const;

test.describe(`ticketing UI/UX screenshots (${PHASE})`, () => {
  test.beforeEach(async ({ page }) => {
    const phone = `+1555${String(Date.now()).slice(-7)}`;
    await authenticatePortalMemberForTickets(page, {
      phone,
      fullName: "Ticketing UI UX Member",
    });
  });

  for (const viewport of VIEWPORTS) {
    test(`member list @ ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
      await expect(
        page.locator("[data-portal-member-tickets][data-portal-member-tickets-state='ready']"),
      ).toBeVisible({ timeout: 90_000 });
      await page.screenshot({
        path: `${OUT_ROOT}/${viewport.name}/portal-tickets-list.png`,
        fullPage: true,
      });
    });

    test(`member new form @ ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/me/tickets/new", { waitUntil: "domcontentloaded" });
      await expect(page.locator("[data-portal-member-tickets-new-form]")).toBeVisible({
        timeout: 60_000,
      });
      await page.screenshot({
        path: `${OUT_ROOT}/${viewport.name}/portal-tickets-new.png`,
        fullPage: true,
      });
    });

    test(`member nav shell @ ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/me/tickets", { waitUntil: "domcontentloaded" });
      await expect(page.getByTestId("portal-shell-nav-tickets")).toBeVisible({ timeout: 60_000 });
      await page.screenshot({
        path: `${OUT_ROOT}/${viewport.name}/portal-nav-tickets.png`,
        fullPage: true,
      });
    });
  }
});
