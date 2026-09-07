/**
 * LAND-BQC — Denali marketing home landing browser closure (sections + artifacts).
 */
import { expect, test } from "@playwright/test";

import { captureBqcArtifact } from "./fixtures/capture-bqc-artifact";

test.describe("marketing home landing — LAND-BQC sections", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-home-hero]")).toBeVisible({ timeout: 90_000 });
  });

  test("LAND-BQC-05 destinations and why sections scroll into view", async ({ page }) => {
    const destinations = page.locator("[data-marketing-home-destinations]");
    await destinations.scrollIntoViewIfNeeded();
    await expect(destinations).toBeVisible();
    await expect(destinations.locator("[data-marketing-home-destination-card]")).toHaveCount(3);
    await captureBqcArtifact(page, "/opt/cursor/artifacts/landing-bqc-destinations.png");

    const why = page.locator("[data-marketing-home-why]#why-us");
    await why.scrollIntoViewIfNeeded();
    await expect(why).toBeVisible();
    await expect(why.locator("[data-marketing-home-why-item]")).toHaveCount(4);
    await captureBqcArtifact(page, "/opt/cursor/artifacts/landing-bqc-why.png");
  });

  test("LAND-BQC-06 gallery lightbox and FAQ accordion interaction", async ({ page }) => {
    const gallery = page.locator("[data-marketing-home-gallery]");
    await gallery.scrollIntoViewIfNeeded();
    await expect(gallery).toBeVisible();
    await expect(gallery.locator("[data-marketing-catalog-detail-photo-trigger]")).toHaveCount(1);

    await gallery.locator("[data-marketing-catalog-detail-photo-trigger]").click();
    const lightbox = page.locator("[data-marketing-catalog-detail-photo-lightbox]");
    await expect(lightbox).toBeVisible();
    await captureBqcArtifact(page, "/opt/cursor/artifacts/landing-bqc-gallery-lightbox.png");
    await page.keyboard.press("Escape");
    await expect(lightbox).not.toBeVisible();

    const faq = page.locator("[data-marketing-home-faq]");
    await faq.scrollIntoViewIfNeeded();
    await expect(faq).toBeVisible();
    const firstItem = faq.locator("details[data-marketing-home-faq-item]").first();
    await firstItem.locator("summary").click();
    await expect(firstItem).toHaveAttribute("open", "");
    await captureBqcArtifact(page, "/opt/cursor/artifacts/landing-bqc-faq-open.png");
  });

  test("LAND-BQC-07 final CTA band visible with tours link", async ({ page }) => {
    const finalCta = page.locator("[data-marketing-home-final-cta]");
    await finalCta.scrollIntoViewIfNeeded();
    await expect(finalCta).toBeVisible();
    await expect(finalCta.locator("[data-marketing-home-final-cta-action]")).toHaveAttribute(
      "href",
      /\/tours/,
    );
    await captureBqcArtifact(page, "/opt/cursor/artifacts/landing-bqc-final-cta.png");
  });
});
