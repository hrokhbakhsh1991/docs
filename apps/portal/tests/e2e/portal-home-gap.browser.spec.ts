/**
 * GAP-BQC — member portal guest home egress (PCMS-003).
 */
import { expect, test } from "@playwright/test";

import { captureBqcArtifact } from "./fixtures/capture-bqc-artifact";

test("GAP-PORTAL-01 guest portal home resolves to catalog register or marketing egress", async ({
  page,
}) => {
  const res = await page.goto("/", { waitUntil: "domcontentloaded" });
  expect(res?.ok() ?? false).toBeTruthy();

  await expect(page).toHaveURL(/\/catalog\/[^/]+\/register|denali\.localhost:3002|\/tours/, {
    timeout: 60_000,
  });

  const onCatalogRegister = /\/catalog\/[^/]+\/register/.test(page.url());
  if (onCatalogRegister) {
    await expect(
      page.locator("[data-portal-register-auth-gate], [data-public-registration-intake]"),
    ).toBeVisible({ timeout: 60_000 });
  } else {
    await expect(
      page.locator("[data-marketing-home-hero], [data-marketing-catalog]"),
    ).toBeVisible({ timeout: 60_000 });
  }

  await captureBqcArtifact(page, "/opt/cursor/artifacts/gap-portal-home.png");
});
