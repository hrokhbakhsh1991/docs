/**
 * GAP-BQC — public tour catalog browser proof with walkthrough artifact.
 */
import { expect, test } from "@playwright/test";

import { captureBqcArtifact } from "./fixtures/capture-bqc-artifact";
import {
  resolveSmokePublishedTourId,
  SMOKE_PUBLISHED_TOUR_TITLE,
} from "./fixtures/smoke-published-tour";

const SMOKE_PUBLISHED_TOUR_ID = resolveSmokePublishedTourId();

test("GAP-MARKETING-01 public club tour catalog loads", async ({ page }) => {
  const res = await page.goto("/tours", { waitUntil: "domcontentloaded" });
  expect(res?.ok() ?? false).toBeTruthy();

  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("[data-marketing-header]")).toBeVisible();
  await expect(page.getByText(SMOKE_PUBLISHED_TOUR_TITLE)).toBeVisible({ timeout: 60_000 });

  await captureBqcArtifact(page, "/opt/cursor/artifacts/gap-marketing-tours-catalog.png");
});

test("GAP-MARKETING-02 guest tour detail page from catalog", async ({ page }) => {
  await page.goto("/tours", { waitUntil: "domcontentloaded" });
  await expect(page.getByText(SMOKE_PUBLISHED_TOUR_TITLE)).toBeVisible({ timeout: 60_000 });

  await page.goto(`/tours/${SMOKE_PUBLISHED_TOUR_ID}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-marketing-catalog-tour-detail]")).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.locator("[data-marketing-catalog-detail-jump-nav]")).toBeVisible();
  await expect(page.locator("[data-marketing-catalog-detail-faq]")).toBeVisible();

  await page.locator("[data-marketing-catalog-detail-back]").click();
  await expect(page.locator("[data-marketing-catalog]")).toBeVisible({ timeout: 60_000 });

  await captureBqcArtifact(page, "/opt/cursor/artifacts/gap-marketing-tour-detail.png");
});
