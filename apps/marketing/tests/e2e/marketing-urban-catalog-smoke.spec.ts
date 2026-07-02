import { expect, test } from "@playwright/test";

const URBAN_PUBLISHED_TOUR_TITLE = "Berlin city highlights";
const URBAN_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000410";

test("SMK-MKT-05 urban public catalog browse", async ({ page }) => {
  await page.goto("/tours");
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-marketing-header]")).toBeVisible();
  await expect(page.locator("[data-marketing-city-filter]")).toBeVisible();
  await expect(page.getByText(URBAN_PUBLISHED_TOUR_TITLE)).toBeVisible();
  await expect(page.locator("body[data-workspace-plugin='urban']")).toBeVisible();
});

test("SMK-MKT-05 urban tour detail hides Denali-only sections", async ({ page }) => {
  await page.goto("/tours", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(URBAN_PUBLISHED_TOUR_TITLE)).toBeVisible({ timeout: 60_000 });
  await page.locator(`a[href="/tours/${URBAN_PUBLISHED_TOUR_ID}"]`).first().click();
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-marketing-catalog-itinerary]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-catalog-detail-policies]")).toHaveCount(0);
  await expect(page.locator("[data-marketing-register]")).toBeVisible();
});

test("SMK-MKT-12 urban tour detail exposes Event JSON-LD v2 fields", async ({ page }) => {
  await page.goto(`/tours/${URBAN_PUBLISHED_TOUR_ID}`, { waitUntil: "domcontentloaded" });
  const raw = await page
    .locator("[data-marketing-catalog-jsonld-graph]")
    .evaluate((node) => node.textContent ?? "");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const graph = parsed["@graph"] as Array<Record<string, unknown>> | undefined;
  const eventNode =
    graph?.find((node) => node["@type"] === "Event") ??
    (parsed["@type"] === "Event" ? parsed : undefined);
  expect(eventNode?.["@type"]).toBe("Event");
  expect(typeof eventNode?.startDate).toBe("string");
  expect(typeof eventNode?.url).toBe("string");
  expect(String(eventNode?.url)).toMatch(/\/tours\//);
  expect(eventNode?.eventAttendanceMode).toBe("https://schema.org/OfflineEventAttendanceMode");
});
