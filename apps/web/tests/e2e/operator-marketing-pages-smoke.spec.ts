/**
 * MKP-001 — Denali operator marketing pages cross-surface smoke.
 */
import { expect, test } from "@playwright/test";

import {
  loginDenaliOperatorOwner,
  loginDenaliOperatorViewer,
} from "./fixtures/authenticate-denali-operator-for-engagement";

const MARKETING_BASE_URL =
  process.env.SMOKE_MARKETING_BASE_URL?.trim() || "http://denali.localhost:3002";

function uniqueHeroLead(): string {
  return `MKP-SMK-${Date.now()}`;
}

test.describe("MKP-001 operator marketing pages", () => {
  test("SMK-MKP-01 owner publishes hero and marketing home reflects copy", async ({ page, browser }) => {
    const heroLead = uniqueHeroLead();
    const heroSupport = `${heroLead} support copy`;
    const heroCta = `${heroLead} CTA`;

    await loginDenaliOperatorOwner(page);
    await page.goto("/settings/marketing-pages", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("marketing-pages-settings-page")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId("marketing-pages-locale-tab-fa")).toBeVisible();

    await page.getByTestId("marketing-pages-lead-input").fill(heroLead);
    await page.getByTestId("marketing-pages-support-input").fill(heroSupport);
    await page.getByTestId("marketing-pages-cta-input").fill(heroCta);
    await page.getByTestId("marketing-pages-publish").click();
    await expect(page.getByTestId("marketing-pages-saved-published")).toBeVisible({ timeout: 60_000 });

    const marketingContext = await browser.newContext();
    const marketingPage = await marketingContext.newPage();
    await marketingPage.goto(`${MARKETING_BASE_URL}/`, { waitUntil: "domcontentloaded" });
    await expect(marketingPage.locator("[data-marketing-home-hero]")).toBeVisible({ timeout: 90_000 });
    await expect(marketingPage.locator("[data-marketing-home-title]")).toContainText(heroLead, {
      timeout: 60_000,
    });
    const hero = marketingPage.locator("[data-marketing-home-hero]");
    await expect(hero.locator("[data-marketing-home-hero-support]")).toContainText(heroSupport);
    await expect(hero.locator("[data-marketing-home-cta]")).toContainText(heroCta);
    await marketingContext.close();
  });

  test("SMK-MKP-02 viewer can read settings but cannot mutate", async ({ page }) => {
    await loginDenaliOperatorViewer(page);

    const readRes = await page.request.get("/api/settings/marketing-pages/home-hero?locale=fa");
    expect(readRes.ok(), await readRes.text()).toBeTruthy();

    const patchRes = await page.request.patch("/api/settings/marketing-pages/home-hero?locale=fa", {
      data: { lead: "viewer-denied", support: "denied", ctaPrimary: "denied" },
    });
    expect(patchRes.status()).toBe(403);

    await page.goto("/settings/marketing-pages", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("marketing-pages-settings-page")).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId("marketing-pages-read-only-banner")).toBeVisible();
    await expect(page.getByTestId("marketing-pages-save-draft")).toHaveCount(0);
    await expect(page.getByTestId("marketing-pages-publish")).toHaveCount(0);
  });

  test("SMK-MKP-03 locale tabs load independently", async ({ page }) => {
    const faLead = uniqueHeroLead();
    const enLead = `${faLead}-en`;

    await loginDenaliOperatorOwner(page);
    await page.goto("/settings/marketing-pages", { waitUntil: "domcontentloaded" });
    await expect(page.getByTestId("marketing-pages-settings-page")).toBeVisible({ timeout: 90_000 });

    await page.getByTestId("marketing-pages-lead-input").fill(faLead);
    await page.getByTestId("marketing-pages-support-input").fill("FA support");
    await page.getByTestId("marketing-pages-cta-input").fill("FA CTA");
    await page.getByTestId("marketing-pages-save-draft").click();
    await expect(page.getByTestId("marketing-pages-saved-draft")).toBeVisible({ timeout: 60_000 });

    await page.getByTestId("marketing-pages-locale-tab-en").click();
    await expect(page.getByTestId("marketing-pages-lead-input")).not.toHaveValue(faLead, {
      timeout: 30_000,
    });

    await page.getByTestId("marketing-pages-lead-input").fill(enLead);
    await page.getByTestId("marketing-pages-support-input").fill("EN support");
    await page.getByTestId("marketing-pages-cta-input").fill("EN CTA");
    await page.getByTestId("marketing-pages-publish").click();
    await expect(page.getByTestId("marketing-pages-saved-published")).toBeVisible({ timeout: 60_000 });

    const enPublic = await page.request.get("/api/settings/marketing-pages/home-hero?locale=en");
    expect(enPublic.ok(), await enPublic.text()).toBeTruthy();
    const enBody = (await enPublic.json()) as { published?: { lead?: string } };
    expect(enBody.published?.lead).toBe(enLead);
  });
});
