import { expect, test, type Page } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  fillCatalogOtp,
  gotoPortalRegistration,
  requestRegistrationOtp,
} from "./fixtures/catalog-registration-otp";
import {
  OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID,
  OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID,
} from "./fixtures/complete-portal-registration";

function uniqueTransportPhone(): string {
  const suffix = String(Date.now() + Math.floor(Math.random() * 1000)).slice(-7);
  return `+1555${suffix}`;
}

type RegistrationBody = {
  readonly transport?: { readonly kind?: string; readonly personalCarOccupants?: number };
};

async function reachTransportIntake(page: Page, tourId: string, phone: string): Promise<void> {
  await page.context().clearCookies();
  await gotoPortalRegistration(page, tourId);
  await requestRegistrationOtp(page, phone);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);

  const profileStep = page.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator("#displayName").fill("Transport Smoke Guest");
    await page.locator('[data-action="profile-continue"]').click();
  }

  await page.locator("[data-public-registration-intake]").waitFor({
    state: "visible",
    timeout: 60_000,
  });
}

async function submitAndReadBody(page: Page): Promise<RegistrationBody> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.request().method() === "POST" && res.url().includes("/api/catalog/registrations"),
      { timeout: 90_000 }
    ),
    page.locator('[data-action="intake-submit"]').click(),
  ]);
  const responseText = await response.text();
  expect(
    response.ok(),
    `catalog registration failed (${response.status()}): ${responseText.slice(0, 240)}`
  ).toBeTruthy();
  const request = response.request();
  return JSON.parse(request.postData() ?? "{}") as RegistrationBody;
}

test("DEN-TRANS-01 bus tour hides transport UI and omits transport payload", async ({ page }) => {
  await reachTransportIntake(page, OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID, uniqueTransportPhone());

  await expect(page.locator("[data-public-registration-personal-car-opt-in]")).toBeVisible();
  await expect(page.locator("[data-public-registration-transport]")).toHaveCount(0);

  const body = await submitAndReadBody(page);
  expect(body.transport, "bus default must not send a transport payload").toBeUndefined();
});

test("DEN-TRANS-02 personal-car opt-in persists personal_car with occupants", async ({ page }) => {
  await reachTransportIntake(page, OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID, uniqueTransportPhone());

  await page.locator("[data-public-registration-personal-car-opt-in] input[type=checkbox]").check();
  const transportFieldset = page.locator("[data-public-registration-transport]");
  await expect(transportFieldset).toBeVisible();
  await transportFieldset.locator('input[name="hasPersonalCar"]').first().check();
  await page
    .locator('[data-public-registration-transport-occupants] input[name="personalCarOccupants"]')
    .nth(1)
    .check();

  const body = await submitAndReadBody(page);
  expect(body.transport?.kind).toBe("personal_car");
  expect(body.transport?.personalCarOccupants).toBe(2);
});

test("DEN-TRANS-03 shared_cars tour forces dong follow-up and persists no_car_dong", async ({
  page,
}) => {
  await reachTransportIntake(page, OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID, uniqueTransportPhone());

  const transportFieldset = page.locator("[data-public-registration-transport]");
  await expect(transportFieldset).toBeVisible();
  await expect(page.locator("[data-registration-price-hint]")).toBeVisible();
  await transportFieldset.locator('input[name="hasPersonalCar"]').nth(1).check();
  await page
    .locator('[data-public-registration-transport-dong] input[name="paysDong"]')
    .first()
    .check();

  const body = await submitAndReadBody(page);
  expect(body.transport?.kind).toBe("no_car_dong");
});
