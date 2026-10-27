/** Two-phase staging probe. `prepare` creates only a fresh published tour; `submit` reuses its id. */
import { expect, test } from "@playwright/test";

import {
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  requestRegistrationOtp,
  syntheticTestPhone,
} from "../../../portal/tests/e2e/fixtures/catalog-registration-otp";
import {
  PORTAL_OPERATOR_BASE_URL,
  publishTourForClosure,
} from "../../test/fixtures/tour-creation-closure-fixture";

const mode = process.env.NO_CAR_HARNESS_MODE;

test("staging no-car diagnostic harness: prepare or submit", async ({ page }) => {
  test.setTimeout(240_000);

  if (mode === "prepare") {
    const stamp = Date.now();
    const title = `TC-CL staging no-car diagnostic ${stamp}`;
    const { tourId, canonical } = await publishTourForClosure(page, title, {
      capacityMax: 3,
      pricing: { paymentCollection: "free", registrationApproval: "auto" },
      transport: { mode: "shared_cars", dongAmountToman: "100000" },
    });
    expect(canonical.transport).toMatchObject({ mode: "shared_cars", dongAmount: 100_000 });

    const rosterResponse = await page.request.get(
      `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
    );
    expect(rosterResponse.ok(), await rosterResponse.text()).toBeTruthy();
    const roster = (await rosterResponse.json()) as { items?: readonly unknown[] };
    expect(roster.items ?? []).toHaveLength(0);
    console.info(`[NO-CAR-HARNESS-PREPARED] ${JSON.stringify({ tourId, title })}`);
    return;
  }

  if (mode !== "submit") {
    throw new Error("Set NO_CAR_HARNESS_MODE=prepare or submit.");
  }
  const tourId = process.env.NO_CAR_HARNESS_TOUR_ID?.trim();
  if (!tourId) throw new Error("NO_CAR_HARNESS_TOUR_ID is required in submit mode.");

  const phone = syntheticTestPhone();
  const stamp = Date.now();
  const fullName = `No Car Diagnostic ${String(stamp).slice(-7)}`;
  await page.goto(`${PORTAL_OPERATOR_BASE_URL}/catalog/${encodeURIComponent(tourId)}/register`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .locator(
      "dialog[open][data-portal-login-modal-open='true'] [data-public-registration-phone][data-registration-ready], [data-public-registration-intake][data-registration-ready]"
    )
    .first()
    .waitFor({ state: "visible", timeout: 120_000 });

  const phoneStep = page.locator("[data-public-registration-phone][data-registration-ready]");
  if (await phoneStep.isVisible().catch(() => false)) {
    await requestRegistrationOtp(page, phone);
    await fillCatalogOtp(page, "1234");
  }
  const profileStep = page.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator("#displayName").fill(fullName);
    const [response] = await Promise.all([
      page.waitForResponse(
        (item) =>
          item.request().method() === "POST" &&
          item.url().includes("/api/public-auth/register-complete"),
        { timeout: 90_000 }
      ),
      page.locator('[data-action="profile-continue"]').click({ noWaitAfter: true }),
    ]);
    expect(response.ok(), `profile completion failed (${response.status()})`).toBeTruthy();
  }
  await page
    .locator("[data-public-registration-intake][data-registration-ready]")
    .waitFor({ state: "visible", timeout: 120_000 });

  const requestPromise = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/api/catalog/registrations"),
    { timeout: 90_000 }
  );
  const responsePromise = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/api/catalog/registrations"),
    { timeout: 90_000 }
  );
  const intake = completeCatalogRegistrationIntake(page, {
    fullName,
    phone,
    partySize: "1",
    registrantTarget: "self",
    expectSuccess: false,
  });
  void intake.catch(() => undefined);
  const request = await requestPromise;
  const response = await responsePromise;
  const responseText = await response.text();
  const result = {
    tourId,
    transport: JSON.parse(request.postData() ?? "{}").transport,
    httpStatus: response.status(),
    response: JSON.parse(responseText),
  };
  console.info(`[NO-CAR-HARNESS-SUBMITTED] ${JSON.stringify(result)}`);
  await Promise.race([intake, new Promise<void>((resolve) => setTimeout(resolve, 2_000))]);
  expect(result.transport).toMatchObject({ kind: "no_car_dong" });
});
