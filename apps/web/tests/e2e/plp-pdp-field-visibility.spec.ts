/**
 * PLP/PDP field visibility — admin exposure settings → marketing catalog render.
 */
import { expect, test } from "@playwright/test";

import {
  DENALI_SMOKE_PUBLISHED_TOUR_ID,
  hideDestinationOnSurface,
  openMarketingCatalogList,
  openMarketingTourDetail,
  restoreDestinationOnSurface,
  smokeTourCard,
  surfaceSection,
} from "../../test/fixtures/plp-pdp-field-visibility-fixture";

test.describe("plp-pdp-field-visibility.spec.ts", () => {
  test.afterEach(async ({ page }) => {
    await restoreDestinationOnSurface(page, "public_list").catch(() => undefined);
    await restoreDestinationOnSurface(page, "public_details").catch(() => undefined);
  });

  test("FV-PLP-01 hiding destination on public_list removes PLP category", async ({ page }) => {
    await openMarketingCatalogList(page);
    const card = smokeTourCard(page);
    await expect(card.locator("[data-marketing-catalog-card-category]")).toBeVisible({
      timeout: 30_000,
    });

    await hideDestinationOnSurface(page, "public_list");

    await openMarketingCatalogList(page);
    await expect(card.locator("[data-marketing-catalog-card-category]")).toHaveCount(0);
  });

  test("FV-PDP-01 hiding destination on public_details removes PDP destination label", async ({
    page,
  }) => {
    await openMarketingTourDetail(page);
    await expect(page.locator("[data-marketing-catalog-detail-destination]")).toBeVisible({
      timeout: 30_000,
    });

    await hideDestinationOnSurface(page, "public_details");

    await openMarketingTourDetail(page);
    await expect(page.locator("[data-marketing-catalog-detail-destination]")).toHaveCount(0);
  });

  test("FV-CONSIST-01 public_list hide does not remove PDP destination when public_details inherits", async ({
    page,
  }) => {
    await hideDestinationOnSurface(page, "public_list");

    await openMarketingTourDetail(page);
    await expect(page.locator("[data-marketing-catalog-detail-destination]")).toBeVisible({
      timeout: 30_000,
    });
  });

  test("FV-PERSIST-01 exposure settings persist after reload", async ({ page }) => {
    await hideDestinationOnSurface(page, "public_list");

    await page.reload({ waitUntil: "domcontentloaded" });
    const section = surfaceSection(page, "public_list");
    await expect(section).toBeVisible({ timeout: 30_000 });
    const destinationCheckbox = section.getByRole("checkbox", { name: /مقصد|Destination/i });
    await expect(destinationCheckbox).not.toBeChecked();
  });

  test("FV-MOBILE-01 PLP category hidden on mobile after public_list override", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await hideDestinationOnSurface(page, "public_list");

    await openMarketingCatalogList(page);
    const card = smokeTourCard(page);
    await expect(card.locator("[data-marketing-catalog-card-category]")).toHaveCount(0);
  });

  test("FV-LTR-01 English PLP respects public_list destination hide", async ({ page }) => {
    await hideDestinationOnSurface(page, "public_list");

    await page.goto(`http://denali.localhost:3002/en/tours`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
    const card = page
      .locator("[data-marketing-catalog-card]")
      .filter({ hasText: "North Ridge Trek" })
      .first();
    await expect(card.locator("[data-marketing-catalog-card-category]")).toHaveCount(0);
  });

  test("FV-API-01 catalog API omits category after public_list destination hide", async ({
    page,
  }) => {
    await hideDestinationOnSurface(page, "public_list");

    const response = await page.request.get("http://denali.localhost:3002/api/catalog", {
      headers: { host: "denali.localhost:3002" },
    });
    expect(response.ok()).toBeTruthy();
    const payload = (await response.json()) as {
      data?: { items?: Array<{ id?: string; category?: string | null }> };
    };
    const item = payload.data?.items?.find((row) => row.id === DENALI_SMOKE_PUBLISHED_TOUR_ID);
    expect(item).toBeDefined();
    expect(item?.category == null || item.category.trim().length === 0).toBeTruthy();
  });
});
