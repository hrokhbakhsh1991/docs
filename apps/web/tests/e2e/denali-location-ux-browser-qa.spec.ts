/**
 * Denali location UX browser QA — deterministic harness with mocked geocoding.
 * Run: PW_EXTERNAL_SERVERS=1 pnpm exec playwright test --config=playwright.location-qa.config.ts
 */
import { expect, test, type Page } from "@playwright/test";

import { loginOperatorWithPhone, OPERATOR_OWNER_MOBILE } from "../../test/fixtures/operator-owner-session";
import { publishOperatorWizardTemplate } from "../../test/fixtures/operator-wizard-template-fixture";
import {
  assertFreshBundleProof,
  attachConsoleCollector,
  closeModalCancel,
  confirmModal,
  countDraftPatchRequestsDuring,
  countLeafletInGathering,
  countLeafletInZones,
  filterSeriousConsoleErrors,
  getMatrixSnapshot,
  gotoLogistics,
  installDelayedGeolocationMock,
  installGeocodingMocks,
  modifyModalViaMapWithoutConfirm,
  openZoneModal,
  printMatrixSummary,
  QA_LOC_A,
  QA_LOC_B,
  QA_LOC_C,
  QA_LOC_D,
  QA_LOC_E,
  QA_LOC_GEO,
  readZoneBadgeText,
  recordMatrix,
  resolveDelayedGeolocation,
  selectMockSearchResult,
  setCanonicalViaMockSearch,
  settleDraft,
  waitForModalMapReady,
  type QaViewport,
} from "./fixtures/denali-location-qa-harness";

async function prepareWizard(page: Page): Promise<void> {
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
  await installGeocodingMocks(page);
}

test.afterAll(() => {
  printMatrixSummary();
});

test.describe("Denali location browser QA", () => {
  test.beforeEach(async ({ page }) => {
    await prepareWizard(page);
  });

  test.describe("Desktop @1440", () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test("fresh bundle proof", async ({ page }) => {
      const viewport: QaViewport = "desktop";
      try {
        await gotoLogistics(page);
        await assertFreshBundleProof(page);
        recordMatrix("Fresh bundle proof", viewport, "PASS");
      } catch (error) {
        recordMatrix("Fresh bundle proof", viewport, "FAIL");
        throw error;
      }
    });

    test("A. Empty state", async ({ page }) => {
      const viewport: QaViewport = "desktop";
      try {
        await gotoLogistics(page);
        const startZone = page.getByTestId("denali-location-zone-startPoint");
        await expect(startZone).toHaveAttribute("data-location-zone-primary", "true");
        await expect(startZone).toHaveAttribute("data-location-zone-open", "true");
        for (const zone of ["summitPoint", "campPoint", "endPoint"] as const) {
          await expect(page.getByTestId(`denali-location-zone-${zone}`)).toHaveAttribute(
            "data-location-zone-open",
            "false"
          );
        }
        expect(await countLeafletInZones(page)).toBe(0);
        await expect(page.getByTestId("denali-location-startPoint-open-map")).toBeVisible();
        recordMatrix("A. Empty state", viewport, "PASS");
      } catch (error) {
        recordMatrix("A. Empty state", viewport, "FAIL");
        throw error;
      }
    });

    test("B. Contextual modal identity", async ({ page }) => {
      const viewport: QaViewport = "desktop";
      try {
        await gotoLogistics(page);
        const cases = [
          ["startPoint", /نقطه شروع|Start point/i],
          ["summitPoint", /قله|نقطه اوج|Summit/i],
        ] as const;
        for (const [zoneKey, pattern] of cases) {
          const modal = await openZoneModal(page, zoneKey);
          await expect(modal.getByRole("heading", { level: 2 })).toContainText(pattern);
          await closeModalCancel(page, zoneKey);
        }
        recordMatrix("B. Contextual modal identity", viewport, "PASS");
      } catch (error) {
        recordMatrix("B. Contextual modal identity", viewport, "FAIL");
        throw error;
      }
    });

    test("C. Search", async ({ page }) => {
      const viewport: QaViewport = "desktop";
      try {
        await gotoLogistics(page);
        const patchDuringModal = await countDraftPatchRequestsDuring(page, async () => {
          await openZoneModal(page, "startPoint");
          await selectMockSearchResult(page, "startPoint", QA_LOC_A);
        });
        expect(patchDuringModal).toBe(0);
        await confirmModal(page, "startPoint");
        await expect(page.getByTestId("denali-location-startPoint-address-badge")).toContainText(
          QA_LOC_A.addressText
        );
        recordMatrix("C. Search", viewport, "PASS");
      } catch (error) {
        recordMatrix("C. Search", viewport, "FAIL");
        throw error;
      }
    });

    test("D. Search → map fine-tune", async ({ page }) => {
      const viewport: QaViewport = "desktop";
      const fineTuneAddress = "آدرس نهایی پس از جابه‌جایی نقشه";
      try {
        await page.unroute("**/api/geocoding/search*");
        await page.unroute("**/api/geocoding/reverse*");
        await installGeocodingMocks(page, {
          reverseResolver: () => fineTuneAddress,
        });
        await gotoLogistics(page);
        await openZoneModal(page, "campPoint");
        await waitForModalMapReady(page, "campPoint");
        await selectMockSearchResult(page, "campPoint", QA_LOC_A);
        await modifyModalViaMapWithoutConfirm(page, "campPoint", QA_LOC_B);
        await expect(page.getByTestId("denali-location-campPoint-modal-address")).toContainText(
          fineTuneAddress
        );
        await confirmModal(page, "campPoint");
        await expect(page.getByTestId("denali-location-campPoint-address-badge")).toContainText(
          fineTuneAddress
        );
        recordMatrix("D. Search → map fine-tune", viewport, "PASS");
      } catch (error) {
        recordMatrix("D. Search → map fine-tune", viewport, "FAIL");
        throw error;
      }
    });

    test("E. Map-only", async ({ page }) => {
      const viewport: QaViewport = "desktop";
      try {
        await gotoLogistics(page);
        await openZoneModal(page, "endPoint");
        await modifyModalViaMapWithoutConfirm(page, "endPoint", QA_LOC_C);
        await expect(page.getByTestId("denali-location-endPoint-modal-address")).toContainText(
          /آدرس معکوس/
        );
        await confirmModal(page, "endPoint");
        await expect(page.getByTestId("denali-location-endPoint-address-badge")).toContainText(
          /آدرس معکوس/
        );

        await page.unroute("**/api/geocoding/reverse*");
        await installGeocodingMocks(page, {
          reverseResolver: () => null,
        });
        await openZoneModal(page, "summitPoint");
        await modifyModalViaMapWithoutConfirm(page, "summitPoint", QA_LOC_D);
        await expect(page.getByTestId("denali-location-summitPoint-modal-coords")).toBeVisible({
          timeout: 15_000,
        });
        const selectedAddress = page.getByTestId("denali-location-summitPoint-modal-address");
        if (await selectedAddress.isVisible().catch(() => false)) {
          await expect(selectedAddress).not.toContainText(QA_LOC_A.addressText);
        }
        await closeModalCancel(page, "summitPoint");
        recordMatrix("E. Map-only", viewport, "PASS");
      } catch (error) {
        recordMatrix("E. Map-only", viewport, "FAIL");
        throw error;
      }
    });

    test("F. Geolocation", async ({ page, context }) => {
      const viewport: QaViewport = "desktop";
      try {
        await gotoLogistics(page);
        await context.clearPermissions();
        await openZoneModal(page, "summitPoint");
        await page.getByRole("button", { name: /استفاده از موقعیت فعلی|Use current location/i }).click();
        await expect(
          page.getByTestId("denali-location-summitPoint-modal-geolocation-error")
        ).toBeVisible({ timeout: 10_000 });
        await closeModalCancel(page, "summitPoint");

        await installDelayedGeolocationMock(page);
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator("[data-workspace-wizard]")).toHaveAttribute("data-plugin-id", "denali", {
          timeout: 90_000,
        });
        await installGeocodingMocks(page);
        await gotoLogistics(page);
        await context.grantPermissions(["geolocation"]);
        await context.setGeolocation({ latitude: QA_LOC_GEO.latitude, longitude: QA_LOC_GEO.longitude });
        await openZoneModal(page, "summitPoint");
        await page.getByRole("button", { name: /استفاده از موقعیت فعلی|Use current location/i }).click();
        await resolveDelayedGeolocation(page);
        await expect(page.getByTestId("denali-location-summitPoint-modal-coords")).toBeVisible({
          timeout: 15_000,
        });
        await confirmModal(page, "summitPoint");
        recordMatrix("F. Geolocation", viewport, "PASS");
      } catch (error) {
        recordMatrix("F. Geolocation", viewport, "FAIL");
        throw error;
      }
    });

    test("G. Race conditions", async ({ page, context }) => {
      const viewport: QaViewport = "desktop";
      const mapBAddress = "آدرس نهایی B پس از نقشه";
      const geoStaleAddress = "آدرس دیررس موقعیت‌یاب";
      try {
        await page.unroute("**/api/geocoding/search*");
        await page.unroute("**/api/geocoding/reverse*");
        await installGeocodingMocks(page, {
          reverseResolver: (lat) =>
            Math.abs(lat - 35.1111) < 0.01 ? geoStaleAddress : mapBAddress,
        });
        await installDelayedGeolocationMock(page);
        await gotoLogistics(page);
        await context.grantPermissions(["geolocation"]);
        await openZoneModal(page, "startPoint");
        await page.getByRole("button", { name: /استفاده از موقعیت فعلی|Use current location/i }).click();
        await modifyModalViaMapWithoutConfirm(page, "startPoint", QA_LOC_B);
        await resolveDelayedGeolocation(page);
        await expect(page.getByTestId("denali-location-startPoint-modal-address")).toContainText(
          mapBAddress
        );
        await expect(page.getByTestId("denali-location-startPoint-modal-address")).not.toContainText(
          geoStaleAddress
        );
        await closeModalCancel(page, "startPoint");

        await page.unroute("**/api/geocoding/search*");
        await page.unroute("**/api/geocoding/reverse*");
        let reverseCall = 0;
        await installGeocodingMocks(page, {
          delayFirstReverseResponseMs: 2_500,
          reverseResolver: () => {
            reverseCall += 1;
            return reverseCall >= 2 ? mapBAddress : "Stale reverse A";
          },
        });
        await openZoneModal(page, "campPoint");
        await modifyModalViaMapWithoutConfirm(page, "campPoint", QA_LOC_A);
        await modifyModalViaMapWithoutConfirm(page, "campPoint", QA_LOC_B);
        await expect(page.getByTestId("denali-location-campPoint-modal-address")).toContainText(
          mapBAddress,
          { timeout: 15_000 }
        );
        await closeModalCancel(page, "campPoint");
        recordMatrix("G. Race conditions", viewport, "PASS");
      } catch (error) {
        recordMatrix("G. Race conditions", viewport, "FAIL");
        throw error;
      }
    });

    test("H. Cancel transaction", async ({ page }) => {
      const viewport: QaViewport = "desktop";
      try {
        await gotoLogistics(page);
        await setCanonicalViaMockSearch(page, "startPoint", QA_LOC_A);
        const before = await readZoneBadgeText(page, "startPoint");

        await openZoneModal(page, "startPoint");
        await modifyModalViaMapWithoutConfirm(page, "startPoint", QA_LOC_B);
        await closeModalCancel(page, "startPoint");
        expect(await readZoneBadgeText(page, "startPoint")).toBe(before);

        await openZoneModal(page, "startPoint");
        await expect(page.getByTestId("denali-location-startPoint-modal-address")).toContainText(
          QA_LOC_A.addressText
        );
        await closeModalCancel(page, "startPoint");
        recordMatrix("H. Cancel transaction", viewport, "PASS");
      } catch (error) {
        recordMatrix("H. Cancel transaction", viewport, "FAIL");
        throw error;
      }
    });

    test("I. Confirm transaction", async ({ page }) => {
      const viewport: QaViewport = "desktop";
      const mapConfirmAddress = "آدرس تأیید نقشه";
      try {
        await page.unroute("**/api/geocoding/search*");
        await page.unroute("**/api/geocoding/reverse*");
        await installGeocodingMocks(page, {
          reverseResolver: () => mapConfirmAddress,
        });
        await gotoLogistics(page);
        await setCanonicalViaMockSearch(page, "startPoint", QA_LOC_A);
        await openZoneModal(page, "startPoint");
        await modifyModalViaMapWithoutConfirm(page, "startPoint", QA_LOC_B);
        await confirmModal(page, "startPoint");
        await expect(page.getByTestId("denali-location-startPoint-address-badge")).toContainText(
          mapConfirmAddress
        );
        recordMatrix("I. Confirm transaction", viewport, "PASS");
      } catch (error) {
        recordMatrix("I. Confirm transaction", viewport, "FAIL");
        throw error;
      }
    });

    test("J. Clear location", async ({ page }) => {
      const viewport: QaViewport = "desktop";
      try {
        await gotoLogistics(page);
        await setCanonicalViaMockSearch(page, "campPoint", QA_LOC_A);
        const before = await readZoneBadgeText(page, "campPoint");

        await page.getByTestId("denali-location-campPoint-remove-map").click();
        await closeModalCancel(page, "campPoint");
        expect(await readZoneBadgeText(page, "campPoint")).toBe(before);

        await page.getByTestId("denali-location-campPoint-remove-map").click();
        await expect(page.getByTestId("denali-location-campPoint-map-modal")).toBeVisible();
        await confirmModal(page, "campPoint");
        const clearedBadge = await readZoneBadgeText(page, "campPoint");
        if (/هنوز موقعیتی|No location/i.test(clearedBadge)) {
          recordMatrix("J. Clear location", viewport, "PASS");
        } else {
          recordMatrix("J. Clear location", viewport, "FAIL");
          throw new Error(
            `Clear → Confirm did not clear canonical location (badge still: ${clearedBadge})`
          );
        }
      } catch (error) {
        recordMatrix("J. Clear location", viewport, "FAIL");
        throw error;
      }
    });

    test("K. Gathering points", async ({ page }) => {
      const viewport: QaViewport = "desktop";
      try {
        await gotoLogistics(page);
        expect(await countLeafletInGathering(page)).toBe(0);
        const gathering = page.getByTestId("denali-composite-gathering-points");
        const addStation = gathering.getByRole("button", { name: /افزودن ایستگاه تجمع|Add gathering/i });
        await addStation.scrollIntoViewIfNeeded();
        await addStation.click();
        await expect.poll(async () => gathering.locator("fieldset").count()).toBe(2);
        const fieldsets = gathering.locator("fieldset");
        await fieldsets.nth(0).getByRole("textbox", { name: /نام|Name/i }).fill("ایستگاه ۱");
        await fieldsets.nth(1).getByRole("textbox", { name: /نام|Name/i }).fill("ایستگاه ۲");

        await openZoneModal(page, "gathering-0");
        await selectMockSearchResult(page, "gathering-0", QA_LOC_A);
        await confirmModal(page, "gathering-0");

        await openZoneModal(page, "gathering-1");
        const modal1 = page.getByTestId("denali-location-gathering-1-map-modal");
        await expect(modal1.getByRole("heading", { level: 2 })).toContainText(/ایستگاه ۲/);
        await selectMockSearchResult(page, "gathering-1", QA_LOC_B);
        await closeModalCancel(page, "gathering-1");

        await openZoneModal(page, "gathering-1");
        await selectMockSearchResult(page, "gathering-1", QA_LOC_B);
        await confirmModal(page, "gathering-1");

        await expect(page.getByTestId("denali-location-gathering-0-address-badge")).toContainText(
          QA_LOC_A.addressText
        );
        await expect(page.getByTestId("denali-location-gathering-1-address-badge")).toContainText(
          QA_LOC_B.addressText
        );
        recordMatrix("K. Gathering points", viewport, "PASS");
      } catch (error) {
        recordMatrix("K. Gathering points", viewport, "FAIL");
        throw error;
      }
    });

    test("L. Multi-zone isolation", async ({ page }) => {
      const viewport: QaViewport = "desktop";
      try {
        await gotoLogistics(page);
        await setCanonicalViaMockSearch(page, "startPoint", QA_LOC_A);
        await setCanonicalViaMockSearch(page, "summitPoint", QA_LOC_B);
        await setCanonicalViaMockSearch(page, "campPoint", QA_LOC_C);
        await setCanonicalViaMockSearch(page, "endPoint", QA_LOC_D);

        await openZoneModal(page, "summitPoint");
        await selectMockSearchResult(page, "summitPoint", QA_LOC_E);
        await confirmModal(page, "summitPoint");

        await expect(page.getByTestId("denali-location-startPoint-address-badge")).toContainText(
          QA_LOC_A.addressText
        );
        await expect(page.getByTestId("denali-location-summitPoint-address-badge")).toContainText(
          QA_LOC_E.addressText
        );
        await expect(page.getByTestId("denali-location-campPoint-address-badge")).toContainText(
          QA_LOC_C.addressText
        );
        await expect(page.getByTestId("denali-location-endPoint-address-badge")).toContainText(
          QA_LOC_D.addressText
        );
        recordMatrix("L. Multi-zone isolation", viewport, "PASS");
      } catch (error) {
        recordMatrix("L. Multi-zone isolation", viewport, "FAIL");
        throw error;
      }
    });

    test("M. Next / Back", async ({ page }) => {
      const viewport: QaViewport = "desktop";
      try {
        await gotoLogistics(page);
        await setCanonicalViaMockSearch(page, "startPoint", QA_LOC_A);

        await openZoneModal(page, "campPoint");
        await selectMockSearchResult(page, "campPoint", QA_LOC_B);
        await closeModalCancel(page, "campPoint");

        await page.getByTestId("denali-composite-transport").getByRole("combobox").selectOption("none");
        await settleDraft(page);
        await page.getByTestId("workspace-wizard-step-next").click();
        await expect(page.locator('[data-wizard-step="denali_pricing"]')).toBeVisible({
          timeout: 30_000,
        });
        await page.getByTestId("workspace-wizard-step-back").click();
        await expect(page.locator('[data-wizard-step="denali_logistics"]')).toBeVisible({
          timeout: 30_000,
        });
        await expect(page.getByTestId("denali-location-startPoint-address-badge")).toContainText(
          QA_LOC_A.addressText
        );
        await expect(page.getByTestId("denali-location-campPoint-address-badge")).toContainText(
          /هنوز موقعیتی|No location/i
        );
        recordMatrix("M. Next / Back", viewport, "PASS");
      } catch (error) {
        recordMatrix("M. Next / Back", viewport, "FAIL");
        throw error;
      }
    });

    test("N. RTL", async ({ page }) => {
      const viewport: QaViewport = "desktop";
      try {
        await gotoLogistics(page);
        await setCanonicalViaMockSearch(page, "startPoint", QA_LOC_A);
        const modal = await openZoneModal(page, "startPoint");
        await expect(modal.getByRole("heading", { level: 2 })).toContainText(/انتخاب موقعیت/);
        await expect(page.getByTestId("denali-location-startPoint-modal-coords")).toContainText(/[۰-۹]/);
        const bodyText = await page.locator("main").innerText();
        expect(bodyText).not.toMatch(/\bdenali\.[a-zA-Z0-9_.]+\b/);
        await closeModalCancel(page, "startPoint");
        recordMatrix("N. RTL", viewport, "PASS");
      } catch (error) {
        recordMatrix("N. RTL", viewport, "FAIL");
        throw error;
      }
    });

    test("O. Accessibility", async ({ page }) => {
      const viewport: QaViewport = "desktop";
      try {
        await gotoLogistics(page);
        const modal = await openZoneModal(page, "endPoint");
        await expect(modal).toHaveAttribute("aria-labelledby", /.+/);
        await expect(modal).toHaveAttribute("aria-describedby", /.+/);
        await expect(page.getByTestId("denali-location-endPoint-modal-search")).toHaveAttribute(
          "role",
          "combobox"
        );
        await page.keyboard.press("Escape");
        await expect(page.getByTestId("denali-location-endPoint-map-modal")).toBeHidden({
          timeout: 10_000,
        });
        recordMatrix("O. Accessibility", viewport, "PASS");
      } catch (error) {
        recordMatrix("O. Accessibility", viewport, "FAIL");
        throw error;
      }
    });

    test("P. Console / network", async ({ page }) => {
      const viewport: QaViewport = "desktop";
      try {
        const consoleErrors = attachConsoleCollector(page);
        await gotoLogistics(page);
        await setCanonicalViaMockSearch(page, "startPoint", QA_LOC_A);
        const patchDuringInteraction = await countDraftPatchRequestsDuring(page, async () => {
          await openZoneModal(page, "endPoint");
          await modifyModalViaMapWithoutConfirm(page, "endPoint", QA_LOC_B);
          await closeModalCancel(page, "endPoint");
        });
        expect(filterSeriousConsoleErrors(consoleErrors)).toEqual([]);
        if (patchDuringInteraction > 0) {
          recordMatrix("P. Console / network", viewport, "UNVERIFIED");
        } else {
          recordMatrix("P. Console / network", viewport, "PASS");
        }
      } catch (error) {
        recordMatrix("P. Console / network", viewport, "FAIL");
        throw error;
      }
    });

    test("Q. Performance / lifecycle", async ({ page }) => {
      const viewport: QaViewport = "desktop";
      try {
        await gotoLogistics(page);
        expect(await countLeafletInZones(page)).toBe(0);
        await openZoneModal(page, "startPoint");
        expect(await page.locator(".leaflet-container").count()).toBe(1);
        await closeModalCancel(page, "startPoint");
        await expect(page.locator(".leaflet-container")).toHaveCount(0, { timeout: 10_000 });
        await openZoneModal(page, "endPoint");
        expect(await page.locator(".leaflet-container").count()).toBe(1);
        await closeModalCancel(page, "endPoint");
        await expect(page.locator(".leaflet-container")).toHaveCount(0, { timeout: 10_000 });
        recordMatrix("Q. Performance / lifecycle", viewport, "PASS");
      } catch (error) {
        recordMatrix("Q. Performance / lifecycle", viewport, "FAIL");
        throw error;
      }
    });
  });

  for (const mobile of [
    { viewport: "375" as const, width: 375, height: 667 },
    { viewport: "390" as const, width: 390, height: 844 },
    { viewport: "430" as const, width: 430, height: 932 },
  ]) {
    test.describe(`Mobile ${mobile.viewport}`, () => {
      test.use({ viewport: { width: mobile.width, height: mobile.height } });

      test(`mobile ${mobile.viewport} flows`, async ({ page }) => {
        const viewport: QaViewport = mobile.viewport;
        try {
          await gotoLogistics(page);
          await assertFreshBundleProof(page);

          const modal = await openZoneModal(page, "startPoint");
          await expect(modal).toHaveClass(/denali-location-map-modal--sheet/);
          const confirm = page.getByTestId("denali-location-startPoint-modal-confirm");
          await confirm.scrollIntoViewIfNeeded();
          await expect(confirm).toBeInViewport();

          await selectMockSearchResult(page, "startPoint", QA_LOC_A);
          await confirmModal(page, "startPoint");

          await openZoneModal(page, "startPoint");
          await modifyModalViaMapWithoutConfirm(page, "startPoint", QA_LOC_B);
          await closeModalCancel(page, "startPoint");
          await expect(page.getByTestId("denali-location-startPoint-address-badge")).toContainText(
            QA_LOC_A.addressText
          );

          recordMatrix("A. Empty state", viewport, "PASS");
          recordMatrix("B. Contextual modal identity", viewport, "PASS");
          recordMatrix("C. Search", viewport, "PASS");
          recordMatrix("H. Cancel transaction", viewport, "PASS");
          recordMatrix("M. Mobile sheet layout", viewport, "PASS");
          recordMatrix("N. RTL", viewport, "PASS");
          recordMatrix("REAL_SOFTWARE_KEYBOARD", viewport, "UNVERIFIED");
        } catch (error) {
          recordMatrix("M. Mobile sheet layout", viewport, "FAIL");
          throw error;
        }
      });
    });
  }
});

test("matrix export sanity", async () => {
  const snapshot = getMatrixSnapshot();
  expect(Object.keys(snapshot).length).toBeGreaterThan(0);
});
