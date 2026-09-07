/**
 * GAP-BQC — public tour catalog browser proof with walkthrough artifact.
 */
import { expect, test } from "@playwright/test";

import { captureBqcArtifact } from "./fixtures/capture-bqc-artifact";
import { SMOKE_PUBLISHED_TOUR_TITLE } from "./fixtures/smoke-published-tour";

test("GAP-MARKETING-01 public club tour catalog loads", async ({ page }) => {
  const res = await page.goto("/tours", { waitUntil: "domcontentloaded" });
  expect(res?.ok() ?? false).toBeTruthy();

  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-marketing-header]")).toBeVisible();
  await expect(page.getByText(SMOKE_PUBLISHED_TOUR_TITLE)).toBeVisible({ timeout: 60_000 });

  await captureBqcArtifact(page, "/opt/cursor/artifacts/gap-marketing-tours-catalog.png");
});
