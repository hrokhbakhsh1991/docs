/**
 * Thin Shell Phase 4by — opt-in Playwright E2E for /workspace-host-probe.
 * @see docs/dev/thin-shell-host-probe-e2e.mdoc
 */
import { expect, test } from "@playwright/test";

const enabled =
  process.env.HOST_PROBE_E2E === "1" && process.env.PW_EXTERNAL_SERVERS === "1";

test.describe("workspace-host-probe — Phase 4by E2E", () => {
  test.skip(!enabled, "Set HOST_PROBE_E2E=1 and PW_EXTERNAL_SERVERS=1 with Next running");

  test("SMK-HOST-PROBE-01 missing pluginId shows missing-id surface", async ({ page }) => {
    await page.goto("/workspace-host-probe");
    await expect(page.getByTestId("workspace-host-probe-missing-id")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("SMK-HOST-PROBE-02 acme publishes hostProbe stub", async ({ page }) => {
    await page.goto("/workspace-host-probe?pluginId=acme");
    await expect(page.getByTestId("workspace-host-probe")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("workspace-host-probe-plugin-id")).toHaveText("acme");
  });

  test("SMK-HOST-PROBE-03 denali lacks hostProbe capability", async ({ page }) => {
    await page.goto("/workspace-host-probe?pluginId=denali");
    await expect(page.getByTestId("workspace-host-probe-capability-missing")).toBeVisible({
      timeout: 15_000,
    });
  });

  test("SMK-HOST-PROBE-04 unknown pluginId fails closed", async ({ page }) => {
    await page.goto("/workspace-host-probe?pluginId=no-such-workspace-plugin");
    await expect(page.getByTestId("workspace-host-probe-not-found")).toBeVisible({
      timeout: 15_000,
    });
  });
});
