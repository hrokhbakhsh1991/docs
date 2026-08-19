/**
 * Phase 3 — Journey D guest funnel acceptance (P3-E2E-D01).
 *
 * Stabilizes discover → register → member portal as one Denali-tagged chain using
 * CI smoke published tour fixtures (not the fragile hardcoded denali.localhost probe tour).
 *
 * Pieces already existed as SMK-MKT-03 + SMK-PTL-02; this owns the full cross-app seam
 * including /me/registrations visibility.
 *
 * @see TEMP/DENALI_PHASE_3_WAVE2_GUEST_E2E_DESIGN.md
 * @see TEMP/DENALI_PHASE_3_JOURNEY_INVENTORY.md (P3-E2E-D01)
 */
import { expect, test } from "@playwright/test";

import {
  completeCatalogRegistrationIntake,
  completeGuestPdpRegisterModalThenOpenPortalIntake,
} from "./fixtures/catalog-registration-otp";
import {
  resolveSmokePublishedTourId,
  SMOKE_PUBLISHED_TOUR_TITLE,
} from "./fixtures/smoke-published-tour";

const SMOKE_PUBLISHED_TOUR_ID = resolveSmokePublishedTourId();
/** Draft fixture title — must not appear as bookable catalog CTA target. */
const OPERATOR_SMOKE_DRAFT_TITLE = "Denali draft fixture";

test.describe("denali-guest-funnel.spec.ts — Phase 3 D01", () => {
  test.setTimeout(240_000);

  test("P3-E2E-D01 marketing catalog → portal register → member registrations", async ({
    page,
  }) => {
    const email = `p3-d01-${Date.now()}@denali-smoke.local`;
    const phone = `+1555${String(Date.now()).slice(-7)}`;

    await page.goto("/tours", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(SMOKE_PUBLISHED_TOUR_TITLE).first()).toBeVisible({
      timeout: 60_000,
    });

    await page.goto(`/tours/${SMOKE_PUBLISHED_TOUR_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
      timeout: 60_000,
    });

    await completeGuestPdpRegisterModalThenOpenPortalIntake(page, {
      phone,
      fullName: "P3 D01 Guest",
      email,
    });

    await expect(page.locator('body[data-workspace-plugin="denali"]')).toBeAttached({
      timeout: 30_000,
    });

    await completeCatalogRegistrationIntake(page, {
      email,
      fullName: "P3 D01 Guest",
      partySize: "2",
      phone,
    });

    await expect(page.locator("[data-public-registration-success]")).toBeVisible({
      timeout: 60_000,
    });

    await page.locator('[data-public-registration-success] a[href*="/me"]').first().click();
    await expect(page.locator("[data-portal-member-registrations]")).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(SMOKE_PUBLISHED_TOUR_TITLE).first()).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.locator('body[data-workspace-plugin="denali"]')).toBeAttached();
  });

  test("P3-E2E-D01-F draft tour is not listed as bookable catalog entry", async ({ page }) => {
    await page.goto("/tours", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText(SMOKE_PUBLISHED_TOUR_TITLE).first()).toBeVisible({
      timeout: 60_000,
    });
    await expect(page.getByText(OPERATOR_SMOKE_DRAFT_TITLE)).toHaveCount(0);
  });
});
