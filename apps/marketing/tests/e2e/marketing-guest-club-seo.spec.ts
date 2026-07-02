import { expect, test } from "@playwright/test";

const GUEST_CLUB_PUBLISHED_TOUR_ID = "00000000-0000-4000-8000-000000000420";
const GUEST_CLUB_PUBLISHED_TOUR_TITLE = "Club weekend getaway";

test("SMK-MKT-13 guest-club tour detail exposes Event stub JSON-LD", async ({ page }) => {
  await page.goto("/tours", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(GUEST_CLUB_PUBLISHED_TOUR_TITLE)).toBeVisible();
  await expect(page.locator("body[data-workspace-plugin='guest-club']")).toBeVisible();

  await page.goto(`/tours/${GUEST_CLUB_PUBLISHED_TOUR_ID}`, { waitUntil: "domcontentloaded" });
  const raw = await page
    .locator("[data-marketing-catalog-jsonld-graph]")
    .evaluate((node) => node.textContent ?? "");
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const graph = parsed["@graph"] as Array<Record<string, unknown>> | undefined;
  const eventNode =
    graph?.find((node) => node["@type"] === "Event") ??
    (parsed["@type"] === "Event" ? parsed : undefined);

  expect(eventNode?.["@type"]).toBe("Event");
  expect(eventNode?.name).toBe(GUEST_CLUB_PUBLISHED_TOUR_TITLE);
  expect(eventNode?.eventStatus).toBe("https://schema.org/EventScheduled");
  expect(typeof eventNode?.url).toBe("string");
  expect(String(eventNode?.url)).toMatch(/\/tours\//);
});
