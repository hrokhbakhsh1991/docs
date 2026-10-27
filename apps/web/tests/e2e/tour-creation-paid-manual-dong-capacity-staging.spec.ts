/** Staging characterization: paid/manual shared-car registrations without seats waitlist. */
import { expect, test } from "@playwright/test";

import {
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  requestRegistrationOtp,
  syntheticNationalId,
  syntheticTestPhone,
} from "../../../portal/tests/e2e/fixtures/catalog-registration-otp";
import { withOperatorBookingsUi } from "../../../portal/tests/e2e/fixtures/operator-booking-ui";
import {
  PORTAL_OPERATOR_BASE_URL,
  publishTourForClosure,
} from "../../test/fixtures/tour-creation-closure-fixture";

test("paid manual no-car dong registration is waitlisted when shared-car seats are unavailable", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const suffix = String(stamp).slice(-7);
  const fullName = `Paid Manual Dong ${suffix}`;
  const phone = syntheticTestPhone();
  const nationalId = syntheticNationalId(stamp + 700);

  const { tourId, canonical } = await publishTourForClosure(page, `TC paid manual dong ${stamp}`, {
    capacityMax: 1,
    pricing: {
      paymentCollection: "paid",
      registrationApproval: "manual",
      basePriceToman: "500000",
    },
    transport: { mode: "shared_cars", dongAmountToman: "100000" },
  });
  expect(canonical.pricing).toBeTruthy();
  expect(canonical.transport).toMatchObject({ mode: "shared_cars", dongAmount: 100_000 });

  await page.goto(`${PORTAL_OPERATOR_BASE_URL}/catalog/${encodeURIComponent(tourId)}/register`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .locator(
      "dialog[open][data-portal-login-modal-open='true'] [data-public-registration-phone][data-registration-ready], [data-public-registration-intake][data-registration-ready]"
    )
    .first()
    .waitFor({ state: "visible", timeout: 120_000 });
  if (
    await page
      .locator("[data-public-registration-phone][data-registration-ready]")
      .isVisible()
      .catch(() => false)
  ) {
    await requestRegistrationOtp(page, phone);
    await fillCatalogOtp(page, "1234");
  }

  const registrationRequest = page.waitForRequest(
    (request) =>
      request.method() === "POST" &&
      new URL(request.url()).pathname.endsWith("/api/catalog/registrations"),
    { timeout: 90_000 }
  );
  const registrationResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/api/catalog/registrations"),
    { timeout: 90_000 }
  );
  const intakeUi = completeCatalogRegistrationIntake(page, {
    fullName,
    phone,
    nationalId,
    partySize: "1",
    registrantTarget: "self",
    // Shared-car intake defaults to no personal car and paying dong.
    expectSuccess: true,
  });

  const request = await registrationRequest;
  const payload = JSON.parse(request.postData() ?? "{}") as {
    transport?: { kind?: string };
  };
  const response = await registrationResponse;
  const responseText = await response.text();
  const responseBody = JSON.parse(responseText) as {
    registrationId?: string | null;
    status?: string | null;
  };
  await intakeUi;

  expect(payload.transport?.kind).toBe("no_car_dong");
  expect(response.status(), responseText).toBe(201);
  expect(responseBody.registrationId).toBeTruthy();
  expect(responseBody.status).toBe("waitlisted");

  const registrationId = responseBody.registrationId!;
  const memberResponse = await page.request.get(
    `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(registrationId)}`
  );
  expect(memberResponse.ok(), await memberResponse.text()).toBeTruthy();
  const memberBody = (await memberResponse.json()) as {
    data?: { status?: string; paymentStatus?: string };
  };
  expect(memberBody.data?.status).toBe("waitlisted");

  await withOperatorBookingsUi(browser, async (adminPage) => {
    const rosterResponse = await adminPage.request.get(
      `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
    );
    expect(rosterResponse.ok(), await rosterResponse.text()).toBeTruthy();
    const roster = (await rosterResponse.json()) as {
      items?: readonly { id?: string; guestLabel?: string; status?: string; partySize?: number }[];
    };
    const row = (roster.items ?? []).find((item) => item.id === registrationId);
    expect(row).toMatchObject({
      guestLabel: expect.stringContaining(fullName),
      status: "waitlisted",
      partySize: 1,
    });
  });
});
