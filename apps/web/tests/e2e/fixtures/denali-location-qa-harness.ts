import { expect, type Page, type Route } from "@playwright/test";

import {
  fillDenaliMultiDayWizardBasics,
  fillDenaliWizardPhotosMinimal,
  fillDenaliWizardProgramMinimal,
} from "../../../test/fixtures/denali-itinerary-wizard-fixture";

export type QaViewport = "desktop" | "375" | "390" | "430";
export type QaStatus = "PASS" | "FAIL" | "NOT RUN" | "UNVERIFIED";

export type MockGeocodingPlace = {
  readonly displayName: string;
  readonly addressText: string;
  readonly latitude: number;
  readonly longitude: number;
};

export const QA_LOC_A: MockGeocodingPlace = {
  displayName: "QA Location A",
  addressText: "آدرس آزمایشی A",
  latitude: 35.7001,
  longitude: 51.4001,
};

export const QA_LOC_B: MockGeocodingPlace = {
  displayName: "QA Location B",
  addressText: "آدرس آزمایشی B",
  latitude: 35.7102,
  longitude: 51.4102,
};

export const QA_LOC_C: MockGeocodingPlace = {
  displayName: "QA Location C",
  addressText: "آدرس آزمایشی C",
  latitude: 35.7203,
  longitude: 51.4203,
};

export const QA_LOC_D: MockGeocodingPlace = {
  displayName: "QA Location D",
  addressText: "آدرس آزمایشی D",
  latitude: 35.7304,
  longitude: 51.4304,
};

export const QA_LOC_E: MockGeocodingPlace = {
  displayName: "QA Location E",
  addressText: "آدرس آزمایشی E",
  latitude: 35.7405,
  longitude: 51.4405,
};

export const QA_LOC_GEO: MockGeocodingPlace = {
  displayName: "QA Geolocation",
  addressText: "آدرس موقعیت فعلی",
  latitude: 35.6892,
  longitude: 51.389,
};

const MATRIX: Record<string, Partial<Record<QaViewport, QaStatus>>> = {};

export function recordMatrix(scenario: string, viewport: QaViewport, status: QaStatus): void {
  MATRIX[scenario] ??= {};
  MATRIX[scenario][viewport] = status;
  console.log(`[MATRIX] ${viewport}\t${status}\t${scenario}`);
}

export function getMatrixSnapshot(): Record<string, Partial<Record<QaViewport, QaStatus>>> {
  return structuredClone(MATRIX);
}

export function printMatrixSummary(): void {
  console.log("\n=== LOCATION QA MATRIX ===");
  for (const [scenario, row] of Object.entries(MATRIX)) {
    console.log(
      `${scenario}\tdesktop=${row.desktop ?? "NOT RUN"}\t375=${row["375"] ?? "NOT RUN"}\t390=${row["390"] ?? "NOT RUN"}\t430=${row["430"] ?? "NOT RUN"}`
    );
  }
}

export async function gotoLogistics(page: Page): Promise<void> {
  await fillDenaliMultiDayWizardBasics(page, `Location QA ${Date.now()}`);
  await fillDenaliWizardPhotosMinimal(page);
  await fillDenaliWizardProgramMinimal(page);
  await expect(page.locator('[data-wizard-step="denali_logistics"]')).toBeVisible({
    timeout: 30_000,
  });
}

export async function settleDraft(page: Page): Promise<void> {
  const indicator = page.getByTestId("draft-sync-indicator");
  await expect
    .poll(() => indicator.getAttribute("data-status"), { timeout: 30_000 })
    .toMatch(/^(?:IDLE|SAVED)$/);
}

export async function expandZoneIfNeeded(page: Page, zoneKey: string): Promise<void> {
  const zone = page.getByTestId(`denali-location-zone-${zoneKey}`);
  const open = await zone.getAttribute("data-location-zone-open");
  if (open !== "true") {
    await zone.locator("summary").click();
    await expect(zone).toHaveAttribute("data-location-zone-open", "true", { timeout: 5_000 });
  }
}

export async function openZoneModal(page: Page, zoneKey: string) {
  await expandZoneIfNeeded(page, zoneKey);
  const openBtn = page.getByTestId(`denali-location-${zoneKey}-open-map`);
  await expect(openBtn).toBeVisible({ timeout: 15_000 });
  await openBtn.click();
  const modal = page.getByTestId(`denali-location-${zoneKey}-map-modal`);
  await expect(modal).toBeVisible({ timeout: 15_000 });
  return modal;
}

export async function closeModalCancel(page: Page, zoneKey: string): Promise<void> {
  await page.getByTestId(`denali-location-${zoneKey}-modal-cancel`).click();
  await expect(page.getByTestId(`denali-location-${zoneKey}-map-modal`)).toBeHidden({
    timeout: 10_000,
  });
}

export async function confirmModal(page: Page, zoneKey: string): Promise<void> {
  const confirm = page.getByTestId(`denali-location-${zoneKey}-modal-confirm`);
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
  await confirm.click();
  await expect(page.getByTestId(`denali-location-${zoneKey}-map-modal`)).toBeHidden({
    timeout: 10_000,
  });
}

export async function countLeafletInZones(page: Page): Promise<number> {
  const zones = page.getByTestId("denali-composite-location-zones");
  return zones.locator(".leaflet-container").count();
}

export async function countLeafletInGathering(page: Page): Promise<number> {
  const gathering = page.getByTestId("denali-composite-gathering-points");
  return gathering.locator(".leaflet-container").count();
}

export async function assertFreshBundleProof(page: Page): Promise<void> {
  await expect(page.getByTestId("denali-composite-location-zones")).toBeVisible();
  await expect(page.getByTestId("denali-composite-gathering-points")).toBeVisible();

  const zones = page.getByTestId("denali-composite-location-zones");
  await expect(zones.locator('input[type="search"]')).toHaveCount(0);
  await expect(zones.locator(".leaflet-container")).toHaveCount(0);
  await expect(page.getByTestId("denali-location-startPoint-open-map")).toBeVisible();

  const startZone = page.getByTestId("denali-location-zone-startPoint");
  await expect(startZone).toHaveAttribute("data-location-zone-primary", "true");
  await expect(startZone).toHaveAttribute("data-location-zone-open", "true");

  const gathering = page.getByTestId("denali-composite-gathering-points");
  await expect(gathering.locator('input[type="search"]')).toHaveCount(0);
  await expect(gathering.locator(".leaflet-container")).toHaveCount(0);
  await expect(page.getByTestId("denali-location-gathering-0-open-map")).toBeVisible();

  const bodyText = await page.locator("main").innerText();
  expect(bodyText).not.toMatch(/\bdenali\.[a-zA-Z0-9_.]+\b/);
}

type GeocodingMockOptions = {
  readonly searchResults?: readonly MockGeocodingPlace[];
  readonly reverseResolver?: (lat: number, lon: number) => string | null;
  readonly reverseDelayMs?: number;
  readonly reverseDelayForLat?: number;
  readonly delayFirstReverseResponseMs?: number;
};

export async function installGeocodingMocks(
  page: Page,
  options: GeocodingMockOptions = {}
): Promise<void> {
  await page.unroute("**/api/geocoding/search*").catch(() => undefined);
  await page.unroute("**/api/geocoding/reverse*").catch(() => undefined);

  const searchResults = options.searchResults ?? [QA_LOC_A, QA_LOC_B, QA_LOC_C, QA_LOC_D, QA_LOC_E];
  const reverseResolver =
    options.reverseResolver ??
    ((lat: number, lon: number) => `آدرس معکوس ${lat.toFixed(4)},${lon.toFixed(4)}`);

  let reverseCallCount = 0;

  await page.route("**/api/geocoding/search*", async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ results: searchResults }),
    });
  });

  await page.route("**/api/geocoding/reverse*", async (route: Route) => {
    const url = new URL(route.request().url());
    const lat = Number(url.searchParams.get("lat"));
    const lon = Number(url.searchParams.get("lon"));
    reverseCallCount += 1;
    const isFirstDelayed =
      options.delayFirstReverseResponseMs != null && reverseCallCount === 1;
    const latDelay =
      options.reverseDelayForLat != null && Math.abs(lat - options.reverseDelayForLat) < 0.0001
        ? (options.reverseDelayMs ?? 0)
        : 0;
    const delayMs = isFirstDelayed ? options.delayFirstReverseResponseMs! : latDelay;
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ address: reverseResolver(lat, lon) }),
    });
  });
}

export async function selectMockSearchResult(
  page: Page,
  zoneKey: string,
  place: MockGeocodingPlace
): Promise<void> {
  const defaults = [QA_LOC_A, QA_LOC_B, QA_LOC_C, QA_LOC_D, QA_LOC_E];
  const index = defaults.findIndex(
    (candidate) =>
      candidate.displayName === place.displayName &&
      candidate.latitude === place.latitude &&
      candidate.longitude === place.longitude
  );
  if (index < 0) {
    throw new Error(`Unknown mock place: ${place.displayName}`);
  }
  await selectMockSearchResultByIndex(page, zoneKey, index);
}

export async function selectMockSearchResultByIndex(
  page: Page,
  zoneKey: string,
  index: number
): Promise<void> {
  const search = page.getByTestId(`denali-location-${zoneKey}-modal-search`);
  await search.fill("qa");
  const suggestions = page.getByTestId(`denali-location-${zoneKey}-modal-suggestions`);
  await expect(suggestions).toBeVisible({ timeout: 10_000 });
  await expect
    .poll(async () => suggestions.locator("button").count(), { timeout: 15_000 })
    .toBeGreaterThanOrEqual(index + 1);
  const button = suggestions.locator("button").nth(index);
  await button.click();
  await expect(page.getByTestId(`denali-location-${zoneKey}-modal-coords`)).toBeVisible({
    timeout: 10_000,
  });
}

export async function setCanonicalViaMockSearch(
  page: Page,
  zoneKey: string,
  place: MockGeocodingPlace
): Promise<void> {
  await openZoneModal(page, zoneKey);
  await selectMockSearchResult(page, zoneKey, place);
  await confirmModal(page, zoneKey);
  await expect(page.getByTestId(`denali-location-${zoneKey}-address-badge`)).toContainText(
    place.addressText
  );
}

export async function waitForModalMapReady(page: Page, zoneKey: string): Promise<void> {
  const mapHost = page.getByTestId(`denali-location-${zoneKey}-modal-map`);
  await expect(mapHost).toBeVisible({ timeout: 15_000 });
  await expect(mapHost).toHaveClass(/leaflet-container/, { timeout: 60_000 });
}

export async function clickMapAt(
  page: Page,
  zoneKey: string,
  _coords: { latitude: number; longitude: number }
): Promise<void> {
  const mapHost = page.getByTestId(`denali-location-${zoneKey}-modal-map`);
  await expect(mapHost).toHaveClass(/leaflet-container/, { timeout: 60_000 });
  const box = await mapHost.boundingBox();
  if (box == null) {
    throw new Error("leaflet map bounding box unavailable");
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

export async function modifyModalViaMapWithoutConfirm(
  page: Page,
  zoneKey: string,
  coords: { latitude: number; longitude: number }
): Promise<void> {
  await waitForModalMapReady(page, zoneKey);
  await clickMapAt(page, zoneKey, coords);
  const confirm = page.getByTestId(`denali-location-${zoneKey}-modal-confirm`);
  await expect(confirm).toBeEnabled({ timeout: 30_000 });
}

export async function readZoneBadgeText(page: Page, zoneKey: string): Promise<string> {
  return (await page.getByTestId(`denali-location-${zoneKey}-address-badge`).textContent()) ?? "";
}

export async function installDelayedGeolocationMock(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __qaDelayedGeoResolve?: () => void;
      __qaDelayedGeoReject?: () => void;
    };
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (
          success: PositionCallback,
          error?: PositionErrorCallback | null
        ) => {
          w.__qaDelayedGeoResolve = () => {
            success({
              coords: {
                latitude: 35.1111,
                longitude: 51.1111,
                accuracy: 5,
                altitude: null,
                altitudeAccuracy: null,
                heading: null,
                speed: null,
              },
              timestamp: Date.now(),
            } as GeolocationPosition);
          };
          w.__qaDelayedGeoReject = () => {
            error?.({
              code: 1,
              message: "denied",
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
            } as GeolocationPositionError);
          };
        },
        watchPosition: () => 0,
        clearWatch: () => undefined,
      },
    });
  });
}

export async function resolveDelayedGeolocation(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __qaDelayedGeoResolve?: () => void };
    w.__qaDelayedGeoResolve?.();
  });
}

export async function rejectDelayedGeolocation(page: Page): Promise<void> {
  await page.evaluate(() => {
    const w = window as unknown as { __qaDelayedGeoReject?: () => void };
    w.__qaDelayedGeoReject?.();
  });
}

export function attachConsoleCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      errors.push(msg.text());
    }
  });
  page.on("pageerror", (error) => {
    errors.push(error.message);
  });
  return errors;
}

export function filterSeriousConsoleErrors(errors: readonly string[]): string[] {
  return errors.filter((line) =>
    /hydration|controlled|Leaflet|ResizeObserver|unhandled|Build Error/i.test(line)
  );
}

export async function countDraftPatchRequestsDuring(
  page: Page,
  action: () => Promise<void>
): Promise<number> {
  let patchCount = 0;
  const handler = async (route: Route) => {
    if (route.request().method() === "PATCH") {
      patchCount += 1;
    }
    await route.continue();
  };
  await page.route("**/api/workspaces/**/drafts/**", handler);
  try {
    await action();
    await page.waitForTimeout(500);
  } finally {
    await page.unroute("**/api/workspaces/**/drafts/**", handler);
  }
  return patchCount;
}
