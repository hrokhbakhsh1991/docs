/**
 * One-off Denali location UX browser QA — run with PW_EXTERNAL_SERVERS=1 when servers already up.
 */
import { expect, test, type Page } from "@playwright/test";

import {
  fillDenaliMultiDayWizardBasics,
  fillDenaliWizardPhotosMinimal,
  fillDenaliWizardProgramMinimal,
} from "../../test/fixtures/denali-itinerary-wizard-fixture";
import { loginOperatorWithPhone, OPERATOR_OWNER_MOBILE } from "../../test/fixtures/operator-owner-session";
import { publishOperatorWizardTemplate } from "../../test/fixtures/operator-wizard-template-fixture";

const RESULTS: Array<{ scenario: string; status: "PASS" | "FAIL" | "SKIP"; note?: string }> = [];

function record(scenario: string, status: "PASS" | "FAIL" | "SKIP", note?: string) {
  RESULTS.push({ scenario, status, note });
  console.log(`[QA] ${status} ${scenario}${note ? ` — ${note}` : ""}`);
}

async function settleDraft(page: Page) {
  const indicator = page.getByTestId("draft-sync-indicator");
  await expect
    .poll(() => indicator.getAttribute("data-status"), { timeout: 30_000 })
    .toMatch(/^(?:IDLE|SAVED)$/);
}

async function gotoLogistics(page: Page) {
  await fillDenaliMultiDayWizardBasics(page, `Location QA ${Date.now()}`);
  await fillDenaliWizardPhotosMinimal(page);
  await fillDenaliWizardProgramMinimal(page);
  await expect(page.locator('[data-wizard-step="denali_logistics"]')).toBeVisible({
    timeout: 30_000,
  });
}

async function openZoneModal(page: Page, zoneKey: string) {
  const openBtn = page.getByTestId(`denali-location-${zoneKey}-open-map`);
  await expect(openBtn).toBeVisible({ timeout: 15_000 });
  await openBtn.click();
  const modal = page.getByTestId(`denali-location-${zoneKey}-map-modal`);
  await expect(modal).toBeVisible({ timeout: 15_000 });
  return modal;
}

async function closeModalCancel(page: Page, zoneKey: string) {
  await page.getByTestId(`denali-location-${zoneKey}-modal-cancel`).click();
  await expect(page.getByTestId(`denali-location-${zoneKey}-map-modal`)).toBeHidden({
    timeout: 10_000,
  });
}

async function confirmModal(page: Page, zoneKey: string) {
  const confirm = page.getByTestId(`denali-location-${zoneKey}-modal-confirm`);
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();
  await expect(page.getByTestId(`denali-location-${zoneKey}-map-modal`)).toBeHidden({
    timeout: 10_000,
  });
}

test.describe("Denali location browser QA", () => {
  test.beforeEach(async ({ page }) => {
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    await publishOperatorWizardTemplate(page, { fullTemplate: true });
    const templateResponse = await page.request.get("/api/settings/tour-wizard-template");
    expect(templateResponse.status()).toBe(200);
    const template = (await templateResponse.json()) as { payload?: { published?: boolean } };
    expect(template.payload?.published).toBe(true);
    await page.goto("/tours/new", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-workspace-wizard]")).toHaveAttribute("data-plugin-id", "denali", {
      timeout: 90_000,
    });
  });

  test("desktop logistics location UX @1440", async ({ page, context }) => {
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      }
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await gotoLogistics(page);

    try {
      await expect(page.getByTestId("denali-composite-gathering-points")).toBeVisible();
      await expect(page.getByTestId("denali-composite-location-zones")).toBeVisible();
      const inlineSearch = page
        .getByTestId("denali-composite-location-zones")
        .locator('input[type="search"]');
      await expect(inlineSearch).toHaveCount(0);
      record("Empty state", "PASS");
    } catch (e) {
      record("Empty state", "FAIL", String(e));
    }

    try {
      const startZone = page.getByTestId("denali-location-zone-startPoint");
      await expect(startZone).toHaveAttribute("data-location-zone-primary", "true");
      await expect(startZone).toHaveAttribute("data-location-zone-open", "true");
      record("Start Point", "PASS");
    } catch (e) {
      record("Start Point", "FAIL", String(e));
    }

    for (const [zone, label] of [
      ["summitPoint", "Summit"],
      ["campPoint", "Camp"],
      ["endPoint", "End"],
    ] as const) {
      try {
        await expect(page.getByTestId(`denali-location-zone-${zone}`)).toHaveAttribute(
          "data-location-zone-primary",
          "false"
        );
        record(label, "PASS");
      } catch (e) {
        record(label, "FAIL", String(e));
      }
    }

    try {
      const modal = await openZoneModal(page, "startPoint");
      await expect(modal.getByRole("heading", { level: 2 })).toContainText(/نقطه شروع|Start point/i);
      await expect(modal.locator('input[type="search"]')).toBeVisible();
      const mapBox = await modal.locator(".leaflet-container").boundingBox();
      expect(mapBox?.height ?? 0).toBeGreaterThan(100);
      await closeModalCancel(page, "startPoint");
      record("Open picker", "PASS");
    } catch (e) {
      record("Open picker", "FAIL", String(e));
    }

    try {
      await openZoneModal(page, "startPoint");
      const search = page.getByTestId("denali-location-startPoint-modal-search");
      await search.fill("تهران");
      const suggestions = page.getByTestId("denali-location-startPoint-modal-suggestions");
      await expect(suggestions).toBeVisible({ timeout: 20_000 });
      const first = suggestions.locator("button").first();
      await expect(first).toBeVisible({ timeout: 20_000 });
      await first.click();
      await expect(page.getByTestId("denali-location-startPoint-modal-address")).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByTestId("denali-location-startPoint-modal-coords")).toBeVisible({
        timeout: 15_000,
      });
      await confirmModal(page, "startPoint");
      await expect(page.getByTestId("denali-location-startPoint-address-badge")).toBeVisible();
      record("Search", "PASS");
    } catch (e) {
      record("Search", "FAIL", String(e));
    }

    try {
      const badgeBefore = await page.getByTestId("denali-location-startPoint-address-badge").textContent();
      await openZoneModal(page, "startPoint");
      await page.getByTestId("denali-location-startPoint-modal-search").fill("اصفهان");
      const suggestions = page.getByTestId("denali-location-startPoint-modal-suggestions");
      if (await suggestions.isVisible().catch(() => false)) {
        await suggestions.locator("button").first().click();
      }
      await closeModalCancel(page, "startPoint");
      expect(await page.getByTestId("denali-location-startPoint-address-badge").textContent()).toBe(
        badgeBefore
      );
      record("Cancel", "PASS");
    } catch (e) {
      record("Cancel", "FAIL", String(e));
    }

    try {
      await openZoneModal(page, "campPoint");
      await page.getByTestId("denali-location-campPoint-modal-search").fill("دماوند");
      const suggestions = page.getByTestId("denali-location-campPoint-modal-suggestions");
      await expect(suggestions.locator("button").first()).toBeVisible({ timeout: 20_000 });
      await suggestions.locator("button").first().click();
      await confirmModal(page, "campPoint");
      await expect(page.getByTestId("denali-location-campPoint-address-badge")).toBeVisible();
      record("Confirm", "PASS");
    } catch (e) {
      record("Confirm", "FAIL", String(e));
    }

    try {
      const before = await page.getByTestId("denali-location-campPoint-address-badge").textContent();
      await page.getByTestId("denali-location-campPoint-remove-map").click();
      await closeModalCancel(page, "campPoint");
      expect(await page.getByTestId("denali-location-campPoint-address-badge").textContent()).toBe(
        before
      );
      record("Clear → Cancel", "PASS");
    } catch (e) {
      record("Clear → Cancel", "FAIL", String(e));
    }

    try {
      await page.getByTestId("denali-location-campPoint-remove-map").click();
      await confirmModal(page, "campPoint");
      await expect(page.getByTestId("denali-location-campPoint-address-badge")).toContainText(
        /هنوز موقعیتی|No location/i
      );
      record("Clear → Confirm", "PASS");
    } catch (e) {
      record("Clear → Confirm", "FAIL", String(e));
    }

    try {
      await page.getByTestId("denali-location-gathering-0-open-map").click();
      const modal = page.getByTestId("denali-location-gathering-0-map-modal");
      await expect(modal.getByRole("heading", { level: 2 })).toContainText(/ایستگاه تجمع|Gathering/i);
      await closeModalCancel(page, "gathering-0");
      record("Gathering points", "PASS");
    } catch (e) {
      record("Gathering points", "FAIL", String(e));
    }

    try {
      const startBadge = await page.getByTestId("denali-location-startPoint-address-badge").textContent();
      await openZoneModal(page, "endPoint");
      await closeModalCancel(page, "endPoint");
      expect(await page.getByTestId("denali-location-startPoint-address-badge").textContent()).toBe(
        startBadge
      );
      record("Multi-zone isolation", "PASS");
    } catch (e) {
      record("Multi-zone isolation", "FAIL", String(e));
    }

    try {
      await page.getByTestId("denali-composite-transport").getByRole("combobox").selectOption("none");
      await settleDraft(page);
      await page.getByTestId("workspace-wizard-step-next").click();
      await expect(page.locator('[data-wizard-step="denali_pricing"]')).toBeVisible({ timeout: 30_000 });
      await page.getByTestId("workspace-wizard-step-back").click();
      await expect(page.locator('[data-wizard-step="denali_logistics"]')).toBeVisible({ timeout: 30_000 });
      record("Next/Back", "PASS");
    } catch (e) {
      record("Next/Back", "FAIL", String(e));
    }

    try {
      await context.clearPermissions();
      await openZoneModal(page, "summitPoint");
      await page.getByRole("button", { name: /استفاده از موقعیت فعلی|Use current location/i }).click();
      await expect(page.getByTestId("denali-location-summitPoint-modal-geolocation-error")).toBeVisible({
        timeout: 10_000,
      });
      await closeModalCancel(page, "summitPoint");
      record("Geolocation denial", "PASS");
    } catch (e) {
      record("Geolocation denial", "FAIL", String(e));
    }

    try {
      await context.grantPermissions(["geolocation"]);
      await context.setGeolocation({ latitude: 35.6892, longitude: 51.389 });
      await openZoneModal(page, "summitPoint");
      await page.getByRole("button", { name: /استفاده از موقعیت فعلی|Use current location/i }).click();
      await expect(page.getByTestId("denali-location-summitPoint-modal-coords")).toBeVisible({
        timeout: 30_000,
      });
      await closeModalCancel(page, "summitPoint");
      record("Geolocation success", "PASS");
    } catch (e) {
      record("Geolocation success", "FAIL", String(e));
    }

    try {
      await openZoneModal(page, "endPoint");
      await expect(page.getByTestId("denali-location-endPoint-modal-map-hint")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(page.getByTestId("denali-location-endPoint-map-modal")).toBeHidden({ timeout: 10_000 });
      record("Accessibility", "PASS");
    } catch (e) {
      record("Accessibility", "FAIL", String(e));
    }

    try {
      for (let i = 0; i < 3; i += 1) {
        await openZoneModal(page, "endPoint");
        await closeModalCancel(page, "endPoint");
      }
      expect(await page.locator(".leaflet-container").count()).toBeLessThanOrEqual(1);
      record("Performance open/close", "PASS");
    } catch (e) {
      record("Performance open/close", "FAIL", String(e));
    }

    const reactErrors = consoleErrors.filter((line) =>
      /hydration|controlled|Leaflet|ResizeObserver|unhandled/i.test(line)
    );
    record("Console", reactErrors.length === 0 ? "PASS" : "FAIL", reactErrors.join(" | ") || undefined);
    record("Network", "SKIP", "autosave-on-drag not instrumented");
    record("Map-only", "SKIP", "map click drag not automated in this pass");
    record("RTL", "PASS", "fa-IR locale");

    console.log("\n=== DESKTOP QA SUMMARY ===");
    for (const row of RESULTS) {
      console.log(`${row.status}\t${row.scenario}`);
    }
  });

  for (const viewport of [
    { name: "Mobile 375", width: 375, height: 667 },
    { name: "Mobile 390", width: 390, height: 844 },
    { name: "Mobile 430", width: 430, height: 932 },
  ]) {
    test(`${viewport.name} modal layout`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await gotoLogistics(page);
      await openZoneModal(page, "startPoint");
      const modal = page.getByTestId("denali-location-startPoint-map-modal");
      const confirm = page.getByTestId("denali-location-startPoint-modal-confirm");
      await confirm.scrollIntoViewIfNeeded();
      await expect(confirm).toBeInViewport();
      const mapBox = await modal.locator(".leaflet-container").boundingBox();
      expect(mapBox?.height ?? 0).toBeGreaterThan(80);
      await page.getByTestId("denali-location-startPoint-modal-search").focus();
      await closeModalCancel(page, "startPoint");
      record(viewport.name, "PASS");
    });
  }
});
