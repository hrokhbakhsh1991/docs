/** Staging boundary: a sequential two-guest free group cannot exceed capacity one. */
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

type RegistrationResponse = {
  readonly registrationId?: string;
  readonly status?: string;
};

test("TC-CL-GROUP-CAPACITY-01 sequential free auto group admits one guest and waitlists one at capacity one", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const suffix = String(stamp).slice(-7);
  const title = `TC free group capacity ${stamp}`;
  const memberPhone = syntheticTestPhone();
  const names = [`Capacity Group A ${suffix}`, `Capacity Group B ${suffix}`];
  const guestPhones = [syntheticTestPhone(), syntheticTestPhone()];
  const { tourId, canonical } = await publishTourForClosure(page, title, {
    capacityMax: 1,
    pricing: { paymentCollection: "free", registrationApproval: "auto" },
  });
  expect(canonical.capacityMax).toBe(1);

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

  const registrations: Array<{ status: number; body: RegistrationResponse }> = [];
  const onRegistrationResponse = async (response: import("@playwright/test").Response) => {
    if (
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/api/catalog/registrations")
    ) {
      registrations.push({
        status: response.status(),
        body: (await response.json()) as RegistrationResponse,
      });
    }
  };
  page.on("response", onRegistrationResponse);
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
        nationalId: syntheticNationalId(stamp + index + 100),
        fatherName: `Capacity Group Father ${index + 1}`,
      }),
    });
  } finally {
    page.off("response", onRegistrationResponse);
  }

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({ timeout: 90_000 });
  expect(registrations.map(({ status }) => status)).toEqual([201, 201]);
  expect(registrations.map(({ body }) => body.status)).toEqual(["approved", "waitlisted"]);
  const ids = registrations.map(({ body }) => body.registrationId);
  expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBeTruthy();
  expect(new Set(ids).size).toBe(2);
  const registrationIds = ids as string[];

  for (let index = 0; index < registrationIds.length; index++) {
    const response = await page.request.get(
      `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(registrationIds[index]!)}`
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    const body = (await response.json()) as { data?: { status?: string } };
    expect(body.data?.status).toBe(index === 0 ? "approved" : "waitlisted");
  }

  await withOperatorBookingsUi(browser, async (adminPage) => {
    const rosterResponse = await adminPage.request.get(
      `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
    );
    expect(rosterResponse.ok(), await rosterResponse.text()).toBeTruthy();
    const roster = (await rosterResponse.json()) as {
      items?: readonly { id?: string; guestLabel?: string; status?: string; partySize?: number }[];
    };
    const rows = (roster.items ?? []).filter((row) => registrationIds.includes(row.id ?? ""));
    expect(rows).toHaveLength(2);
    for (let index = 0; index < registrationIds.length; index++) {
      expect(rows.find((row) => row.id === registrationIds[index])).toMatchObject({
        guestLabel: expect.stringContaining(names[index]),
        status: index === 0 ? "approved" : "waitlisted",
        partySize: 1,
      });
    }
    const approvedRow = rows.find((row) => row.status === "approved");
    expect(rows.filter((row) => row.status === "approved")).toHaveLength(1);
    const detailResponse = await adminPage.request.get(`/api/bookings/${approvedRow?.id}`);
    expect(detailResponse.ok(), await detailResponse.text()).toBeTruthy();
    const detail = (await detailResponse.json()) as {
      capacitySnapshot?: { occupied?: number; max?: number };
    };
    expect(detail.capacitySnapshot).toEqual({ occupied: 1, max: 1 });
  });
});
