/** Staging proof: the same authenticated member cannot self-register twice concurrently. */
import { expect, test } from "@playwright/test";

import {
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

test("TC-CL-REG-SAME-MEMBER-01 two tabs racing self-registration create one roster row", async ({
  page,
  browser,
}) => {
  test.setTimeout(360_000);
  const stamp = Date.now();
  const phone = syntheticTestPhone();
  const fullName = `Concurrent Self ${String(stamp).slice(-6)}`;
  const title = `TC-CL-REG-SAME-MEMBER ${stamp}`;
  const { tourId } = await publishTourForClosure(page, title, {
    capacityMax: 4,
    pricing: { paymentCollection: "free", registrationApproval: "auto" },
    transport: { mode: "bus", allowPersonalCar: false },
  });

  const registrationPath = `/catalog/${encodeURIComponent(tourId)}/register`;
  await page.goto(`${PORTAL_OPERATOR_BASE_URL}${registrationPath}`, {
    waitUntil: "domcontentloaded",
  });
  await page
    .locator(
      "dialog[open][data-portal-login-modal-open='true'] [data-public-registration-phone][data-registration-ready], [data-public-registration-intake][data-registration-ready]"
    )
    .first()
    .waitFor({ state: "visible", timeout: 120_000 });
  await requestRegistrationOtp(page, phone);
  await fillCatalogOtp(page, "1234");

  const profile = page.locator("[data-public-registration-profile]");
  if (await profile.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator("#displayName").fill(fullName);
    const [profileResponse] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          response.url().includes("/api/public-auth/register-complete"),
        { timeout: 90_000 }
      ),
      page.locator('[data-action="profile-continue"]').click({ noWaitAfter: true }),
    ]);
    expect(
      profileResponse.ok(),
      `profile completion failed (${profileResponse.status()})`
    ).toBeTruthy();
  }
  await page
    .locator("[data-public-registration-intake][data-registration-ready]")
    .waitFor({ state: "visible", timeout: 120_000 });

  const secondTab = await page.context().newPage();
  try {
    await secondTab.goto(`${PORTAL_OPERATOR_BASE_URL}${registrationPath}`, {
      waitUntil: "domcontentloaded",
    });
    await secondTab
      .locator("[data-public-registration-intake][data-registration-ready]")
      .waitFor({ state: "visible", timeout: 120_000 });

    const payload = {
      tourId,
      fullName,
      email: `same-member-${stamp}@denali.local`,
      phone,
      partySize: 1,
      nationalId: syntheticNationalId(stamp),
      fatherName: "Smoke Father",
      birthDate: "1990-01-15",
      registrantTarget: "self",
      transport: { kind: "primary" },
    };
    const submitFromTab = (tab: typeof page) =>
      tab.evaluate(async (body) => {
        const response = await fetch("/api/catalog/registrations", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(body),
        });
        return {
          status: response.status,
          body: (await response.json().catch(() => ({}))) as {
            ok?: boolean;
            code?: string;
            registrationId?: string | null;
            status?: string | null;
          },
        };
      }, payload);

    const responses = await Promise.all([submitFromTab(page), submitFromTab(secondTab)]);
    expect(responses.map((response) => response.status).sort((a, b) => a - b)).toEqual([201, 409]);
    const winner = responses.find((response) => response.status === 201);
    expect(winner?.body.registrationId).toEqual(expect.any(String));

    await withOperatorBookingsUi(browser, async (adminPage) => {
      const rosterResponse = await adminPage.request.get(
        `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
      );
      expect(rosterResponse.ok(), await rosterResponse.text()).toBeTruthy();
      const roster = (await rosterResponse.json()) as {
        items?: readonly { id?: string; guestLabel?: string; status?: string }[];
      };
      const matchingRows = (roster.items ?? []).filter((row) => row.guestLabel?.includes(fullName));
      expect(matchingRows).toHaveLength(1);
      expect(matchingRows[0]).toMatchObject({
        id: winner?.body.registrationId,
        status: "approved",
      });
    });
  } finally {
    await secondTab.close();
  }
});
