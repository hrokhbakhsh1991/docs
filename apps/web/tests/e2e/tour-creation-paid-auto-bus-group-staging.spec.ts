/** Staging pairwise: paid/auto two-guest bus group at exact capacity, unpaid. */
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
  readonly id?: string;
  readonly status?: string;
};

type RegistrationRow = {
  readonly id?: string;
  readonly guestLabel?: string;
  readonly status?: string;
  readonly paymentStatus?: string;
  readonly partySize?: number;
  readonly transportKind?: string | null;
};

test("paid auto two-guest bus group is approved, unpaid, and fills exact capacity", async ({
  page,
  browser,
}) => {
  test.setTimeout(360_000);
  const stamp = Date.now();
  const suffix = String(stamp).slice(-7);
  const memberPhone = syntheticTestPhone();
  const names = [`Paid Auto Bus A ${suffix}`, `Paid Auto Bus B ${suffix}`];
  const guestPhones = [syntheticTestPhone(), syntheticTestPhone()];
  const { tourId, canonical } = await publishTourForClosure(page, `TC paid auto bus ${stamp}`, {
    capacityMax: 2,
    pricing: {
      paymentCollection: "paid",
      registrationApproval: "auto",
      basePriceToman: "500000",
    },
    transport: { mode: "bus", allowPersonalCar: false },
  });
  expect(canonical.capacityMax).toBe(2);
  expect(canonical.pricing).toBeTruthy();
  expect(canonical.transport).toMatchObject({ mode: "bus" });

  const forbiddenWrites: string[] = [];
  const recordForbiddenWrite = (request: import("@playwright/test").Request) => {
    const path = new URL(request.url()).pathname;
    if (
      !["GET", "HEAD"].includes(request.method()) &&
      /receipt|gateway|checkout|payment-session|payment-intent/i.test(path)
    ) {
      forbiddenWrites.push(`${request.method()} ${path}`);
    }
  };
  page.on("request", recordForbiddenWrite);

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
        nationalId: syntheticNationalId(stamp + index + 2700),
        fatherName: `Paid Auto Bus Father ${index + 1}`,
      }),
    });
  } finally {
    page.off("response", onRegistrationResponse);
  }

  await expect(page.locator("[data-public-registration-success]")).toBeVisible({ timeout: 90_000 });
  expect(registrations.map(({ status }) => status)).toEqual([201, 201]);
  expect(registrations.map(({ body }) => body.status)).toEqual(["approved", "approved"]);
  const rawIds = registrations.map(({ body }) => body.registrationId ?? body.id);
  expect(rawIds.every((id) => typeof id === "string" && id.length > 0)).toBeTruthy();
  expect(new Set(rawIds).size).toBe(2);
  const ids = rawIds as string[];

  for (const id of ids) {
    const response = await page.request.get(
      `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(id)}`
    );
    const text = await response.text();
    expect(response.ok(), text).toBeTruthy();
    const body = (
      JSON.parse(text) as {
        data?: { status?: string; paymentStatus?: string };
      }
    ).data;
    expect(body?.status).toBe("approved");
    expect(body?.paymentStatus?.toLowerCase()).not.toBe("paid");
  }

  await withOperatorBookingsUi(browser, async (adminPage) => {
    adminPage.on("request", recordForbiddenWrite);
    const rosterResponse = await adminPage.request.get(
      `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
    );
    const rosterText = await rosterResponse.text();
    expect(rosterResponse.ok(), rosterText).toBeTruthy();
    const roster = JSON.parse(rosterText) as { items?: readonly RegistrationRow[] };
    const rows = (roster.items ?? []).filter((row) => ids.includes(row.id ?? ""));
    expect(rows).toHaveLength(2);
    for (const [index, id] of ids.entries()) {
      expect(rows.find((row) => row.id === id)).toMatchObject({
        guestLabel: expect.stringContaining(names[index]),
        status: "approved",
        partySize: 1,
        transportKind: "primary",
      });
      expect(rows.find((row) => row.id === id)?.paymentStatus?.toLowerCase()).not.toBe("paid");
    }

    const detailResponse = await adminPage.request.get(`/api/bookings/${ids[0]}`);
    const detailText = await detailResponse.text();
    expect(detailResponse.ok(), detailText).toBeTruthy();
    expect(JSON.parse(detailText)).toMatchObject({ capacitySnapshot: { occupied: 2, max: 2 } });
  });

  page.off("request", recordForbiddenWrite);
  expect(forbiddenWrites).toEqual([]);
});
