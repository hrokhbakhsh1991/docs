/** Staging boundary: a paid auto group cannot admit more than one guest. */
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

type RegistrationResponse = {
  readonly registrationId?: string;
  readonly status?: string;
};

test("TC-CL-GROUP-CAPACITY-03 paid auto group admits one guest and waitlists one", async ({
  page,
  browser,
}) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const suffix = String(stamp).slice(-7);
  const title = `TC paid group capacity ${stamp}`;
  const memberPhone = syntheticTestPhone();
  const names = [`Paid Capacity A ${suffix}`, `Paid Capacity B ${suffix}`];
  const guestPhones = [syntheticTestPhone(), syntheticTestPhone()];
  const { tourId, canonical } = await publishTourForClosure(page, title, {
    capacityMax: 1,
    pricing: {
      paymentCollection: "paid",
      registrationApproval: "auto",
      basePriceToman: "500000",
    },
  });
  expect(canonical.capacityMax).toBe(1);
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
        fatherName: `Paid Capacity Father ${index + 1}`,
      }),
    });
  } finally {
    page.off("response", onRegistrationResponse);
  }

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({ timeout: 90_000 });
  expect(registrations.map(({ status }) => status)).toEqual([201, 201]);
  expect(registrations.map(({ body }) => body.status)).toEqual(["approved", "waitlisted"]);
  const registrationIds = registrations.map(({ body }) => body.registrationId);
  expect(registrationIds.every((id) => typeof id === "string" && id.length > 0)).toBeTruthy();
  expect(new Set(registrationIds).size).toBe(2);
  const ids = registrationIds as string[];

  for (let index = 0; index < ids.length; index++) {
    const response = await page.request.get(
      `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(ids[index]!)}`
    );
    expect(response.ok(), await response.text()).toBeTruthy();
    const body = (await response.json()) as {
      data?: { status?: string; paymentStatus?: string };
    };
    expect(body.data?.status).toBe(index === 0 ? "approved" : "waitlisted");
    if (body.data?.paymentStatus !== undefined) {
      expect(body.data.paymentStatus.toLowerCase()).not.toBe("paid");
    }
  }

  await withOperatorBookingsUi(browser, async (adminPage) => {
    const rosterResponse = await adminPage.request.get(
      `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
    );
    expect(rosterResponse.ok(), await rosterResponse.text()).toBeTruthy();
    const roster = (await rosterResponse.json()) as {
      items?: readonly {
        id?: string;
        guestLabel?: string;
        status?: string;
        paymentStatus?: string;
        partySize?: number;
      }[];
    };
    const rows = (roster.items ?? []).filter((row) => ids.includes(row.id ?? ""));
    expect(rows).toHaveLength(2);
    for (let index = 0; index < ids.length; index++) {
      expect(rows.find((row) => row.id === ids[index])).toMatchObject({
        guestLabel: expect.stringContaining(names[index]),
        status: index === 0 ? "approved" : "waitlisted",
        partySize: 1,
      });
    }
    expect(rows.filter((row) => row.status === "approved")).toHaveLength(1);
    const approvedDetailResponse = await adminPage.request.get(`/api/bookings/${ids[0]}`);
    expect(approvedDetailResponse.ok(), await approvedDetailResponse.text()).toBeTruthy();
    const approvedDetail = (await approvedDetailResponse.json()) as {
      capacitySnapshot?: { occupied?: number; max?: number };
    };
    expect(approvedDetail.capacitySnapshot).toEqual({ occupied: 1, max: 1 });
  });
});
