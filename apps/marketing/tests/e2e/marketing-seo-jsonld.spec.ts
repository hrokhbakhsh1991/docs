import { expect, test } from "@playwright/test";

import { resolveSmokePublishedTourId } from "./fixtures/smoke-published-tour";

const SMOKE_PUBLISHED_TOUR_ID = resolveSmokePublishedTourId();

test("SMK-MKT-06 denali tour detail exposes TouristTrip JSON-LD", async ({ page }) => {
  await page.goto(`/tours/${SMOKE_PUBLISHED_TOUR_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });

  const structuredData = page.locator("[data-marketing-catalog-jsonld-graph]");
  await expect(structuredData).toHaveCount(1);
  const raw = await structuredData.evaluate((node) => node.textContent ?? "");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const graph = parsed["@graph"] as Array<Record<string, unknown>> | undefined;
  const tripNode =
    graph?.find((node) => node["@type"] === "TouristTrip") ??
  (parsed["@type"] === "TouristTrip" ? parsed : undefined);
  expect(tripNode?.["@type"]).toBe("TouristTrip");
  expect(typeof tripNode?.name).toBe("string");
  expect(typeof tripNode?.url).toBe("string");
  expect(String(tripNode?.url)).toMatch(/\/tours\//);
  expect(tripNode?.offers).toBeTruthy();
  expect(typeof tripNode?.image).toBe("string");
  expect(String(tripNode?.image).length).toBeGreaterThan(0);

  const breadcrumbNode =
    graph?.find((node) => node["@type"] === "BreadcrumbList") ??
    (parsed["@type"] === "BreadcrumbList" ? parsed : undefined);
  expect(breadcrumbNode?.["@type"]).toBe("BreadcrumbList");
});

test("SMK-MKT-11 denali tour detail JSON-LD includes offers and cover image", async ({ page }) => {
  await page.goto(`/tours/${SMOKE_PUBLISHED_TOUR_ID}`, { waitUntil: "domcontentloaded" });
  const raw = await page
    .locator("[data-marketing-catalog-jsonld-graph]")
    .evaluate((node) => node.textContent ?? "");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const graph = parsed["@graph"] as Array<Record<string, unknown>> | undefined;
  const tripNode =
    graph?.find((node) => node["@type"] === "TouristTrip") ??
    (parsed["@type"] === "TouristTrip" ? parsed : undefined);
  const offers = tripNode?.offers as Record<string, unknown> | undefined;
  expect(offers?.["@type"]).toBe("Offer");
  expect(typeof offers?.price).toBe("number");
  expect(typeof tripNode?.image).toBe("string");
});
