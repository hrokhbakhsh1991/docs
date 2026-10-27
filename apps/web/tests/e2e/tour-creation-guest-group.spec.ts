/** Current-SHA proof for two synthetic guests registered together on a fresh tour. */
import { expect, test } from "@playwright/test";

import {
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  requestRegistrationOtp,
  syntheticNationalId,
  syntheticTestPhone,
} from "../../../portal/tests/e2e/fixtures/catalog-registration-otp";
import {
  PORTAL_OPERATOR_BASE_URL,
  publishTourForClosure,
} from "../../test/fixtures/tour-creation-closure-fixture";
import { withOperatorBookingsUi } from "../../../portal/tests/e2e/fixtures/operator-booking-ui";

test("TC-CL-GUEST-GROUP-01 creates two approved guest rows from one portal intake", async ({
  page,
  browser,
}) => {
  test.setTimeout(360_000);
  const stamp = Date.now();
  const title = `TC-CL guest group ${stamp}`;
  const memberPhone = syntheticTestPhone();
  const names = [
    `Guest Group A ${String(stamp).slice(-7)}`,
    `Guest Group B ${String(stamp).slice(-7)}`,
  ];
  const guestPhones = [syntheticTestPhone(), syntheticTestPhone()];
  const { tourId, canonical } = await publishTourForClosure(page, title, {
    capacityMax: 2,
    pricing: { paymentCollection: "free", registrationApproval: "auto" },
  });
  expect(canonical.pricing).toBeTruthy();

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
    await requestRegistrationOtp(page, memberPhone);
    await fillCatalogOtp(page, "1234");
  }

  const registrationResponses: Array<{
    status: number;
    body: { registrationId?: string; status?: string };
  }> = [];
  const responseListener = async (response: import("@playwright/test").Response) => {
    if (
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/api/catalog/registrations")
    ) {
      try {
        registrationResponses.push({ status: response.status(), body: await response.json() });
      } catch {
        registrationResponses.push({ status: response.status(), body: {} });
      }
    }
  };
  page.on("response", responseListener);
  try {
    await completeCatalogRegistrationIntake(page, {
      fullName: names[0],
      phone: memberPhone,
      partySize: "1",
      registrantTarget: "other",
      guestCount: 2,
      guestOverrides: (index) => ({
        fullName: names[index],
        phone: guestPhones[index],
        nationalId: syntheticNationalId(stamp + index + 1),
        fatherName: `Group Father ${index + 1}`,
      }),
    });
  } finally {
    page.off("response", responseListener);
  }

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({ timeout: 90_000 });
  expect(registrationResponses.map((item) => item.status)).toEqual([201, 201]);
  const registrationIds = registrationResponses.map((item) => item.body.registrationId);
  expect(registrationIds.every((id) => typeof id === "string")).toBeTruthy();
  expect(new Set(registrationIds).size).toBe(2);

  for (const registrationId of registrationIds as string[]) {
    const memberResponse = await page.request.get(
      `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(registrationId)}`
    );
    expect(memberResponse.ok(), await memberResponse.text()).toBeTruthy();
    const memberBody = (await memberResponse.json()) as { data?: { status?: string } };
    expect(memberBody.data?.status).toBe("approved");
  }

  await withOperatorBookingsUi(browser, async (adminPage) => {
    const rosterResponse = await adminPage.request.get(
      `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
    );
    expect(rosterResponse.ok(), await rosterResponse.text()).toBeTruthy();
    const roster = (await rosterResponse.json()) as {
      items?: readonly { id?: string; guestLabel?: string; status?: string; partySize?: number }[];
    };
    const guestRows = (roster.items ?? []).filter((row) => registrationIds.includes(row.id ?? ""));
    expect(guestRows).toHaveLength(2);
    for (let index = 0; index < 2; index++) {
      expect(guestRows.find((row) => row.id === registrationIds[index])).toMatchObject({
        guestLabel: expect.stringContaining(names[index]),
        status: "approved",
        partySize: 1,
      });
    }
  });
});
