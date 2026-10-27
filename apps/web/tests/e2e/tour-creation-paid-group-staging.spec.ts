/** Staging proof: paid group intake for both Denali registration approval policies. */
import { expect, test } from "@playwright/test";

import {
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  requestRegistrationOtp,
  syntheticNationalId,
  syntheticTestPhone,
} from "../../../portal/tests/e2e/fixtures/catalog-registration-otp";
import {
  operatorApproveBookingViaUi,
  withOperatorBookingsUi,
} from "../../../portal/tests/e2e/fixtures/operator-booking-ui";
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
};

const scenarios = [
  { approval: "manual", expectedInitialStatus: "pending" },
  { approval: "auto", expectedInitialStatus: "approved" },
] as const;

test.describe("paid group registration on staging", () => {
  test.describe.configure({ mode: "serial" });

  for (const scenario of scenarios) {
    test(`two guests are tracked and paid independently with ${scenario.approval} approval`, async ({
      page,
      browser,
    }) => {
      test.setTimeout(600_000);
      const stamp = Date.now();
      const title = `TC paid group ${scenario.approval} ${stamp}`;
      const suffix = String(stamp).slice(-7);
      const memberPhone = syntheticTestPhone();
      const names = [`Paid Group A ${suffix}`, `Paid Group B ${suffix}`];
      const guestPhones = [syntheticTestPhone(), syntheticTestPhone()];

      const { tourId, canonical } = await publishTourForClosure(page, title, {
        capacityMax: 2,
        pricing: {
          paymentCollection: "paid",
          registrationApproval: scenario.approval,
          basePriceToman: "500000",
        },
      });
      expect(canonical.pricing).toBeTruthy();

      await page.goto(
        `${PORTAL_OPERATOR_BASE_URL}/catalog/${encodeURIComponent(tourId)}/register`,
        {
          waitUntil: "domcontentloaded",
        }
      );
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
          try {
            registrations.push({ status: response.status(), body: await response.json() });
          } catch {
            registrations.push({ status: response.status(), body: {} });
          }
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
            fatherName: `Paid Group Father ${index + 1}`,
          }),
        });
      } finally {
        page.off("response", onRegistrationResponse);
      }

      await expect(page.locator("[data-public-registration-success]")).toBeVisible({
        timeout: 90_000,
      });
      expect(registrations.map(({ status }) => status)).toEqual([201, 201]);
      const ids = registrations.map(({ body }) => body.registrationId ?? body.id);
      expect(ids.every((id) => typeof id === "string" && id.length > 0)).toBeTruthy();
      expect(new Set(ids).size).toBe(2);
      const registrationIds = ids as string[];

      for (const id of registrationIds) {
        const response = await page.request.get(
          `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(id)}`
        );
        expect(response.ok(), await response.text()).toBeTruthy();
        const body = (await response.json()) as {
          data?: { status?: string; paymentStatus?: string };
        };
        expect(body.data?.status).toBe(scenario.expectedInitialStatus);
        // A newly created paid booking has not yet submitted receipt evidence.
        if (body.data?.paymentStatus !== undefined) {
          expect(body.data.paymentStatus.toLowerCase()).not.toBe("paid");
        }
      }

      await withOperatorBookingsUi(browser, async (adminPage) => {
        const readRoster = async (): Promise<RegistrationRow[]> => {
          const response = await adminPage.request.get(
            `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
          );
          expect(response.ok(), await response.text()).toBeTruthy();
          const body = (await response.json()) as { items?: readonly RegistrationRow[] };
          return [...(body.items ?? [])].filter((row) => registrationIds.includes(row.id ?? ""));
        };

        let rows = await readRoster();
        expect(rows).toHaveLength(2);
        for (let index = 0; index < 2; index++) {
          expect(rows.find((row) => row.id === registrationIds[index])).toMatchObject({
            guestLabel: expect.stringContaining(names[index]),
            status: scenario.expectedInitialStatus,
            partySize: 1,
          });
        }

        if (scenario.approval === "manual") {
          for (let index = 0; index < registrationIds.length; index++) {
            await operatorApproveBookingViaUi(adminPage, {
              guestLabel: names[index],
              bookingId: registrationIds[index]!,
            });
          }
        }

        for (const registrationId of registrationIds) {
          await page.goto(
            `${PORTAL_OPERATOR_BASE_URL}/me/registrations/${encodeURIComponent(registrationId)}`,
            { waitUntil: "domcontentloaded" }
          );
          await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
            timeout: 60_000,
          });
          await expect(page.locator("[data-portal-member-receipt-upload]")).toBeVisible({
            timeout: 60_000,
          });
          await page
            .locator("[data-portal-member-receipt-note]")
            .fill("Synthetic staging test receipt; no funds transferred");
          await page.locator("#receipt-file").setInputFiles({
            name: `synthetic-paid-group-${registrationId}.png`,
            mimeType: "image/png",
            buffer: Buffer.from("Synthetic test receipt only; payment gateway not used"),
          });

          const [receiptResponse] = await Promise.all([
            page.waitForResponse(
              (response) =>
                response.request().method() === "POST" &&
                new URL(response.url()).pathname ===
                  `/api/me/registrations/${registrationId}/receipt`,
              { timeout: 60_000 }
            ),
            page.locator("[data-portal-member-receipt-submit]").click(),
          ]);
          const receiptText = await receiptResponse.text();
          expect(receiptResponse.status(), receiptText).toBe(201);
          const receiptBody = JSON.parse(receiptText) as {
            data?: { id?: string; status?: string };
          };
          expect(receiptBody.data?.id).toBeTruthy();
          expect(receiptBody.data?.status).toBe("Pending");
          await expect(page.locator("[data-portal-member-receipt-waiting]")).toBeVisible({
            timeout: 60_000,
          });

          await adminPage.goto(
            `/finance?tab=receipts&registrationId=${encodeURIComponent(registrationId)}`,
            { waitUntil: "domcontentloaded" }
          );
          await expect(adminPage.getByTestId("finance-receipts-panel")).toBeVisible({
            timeout: 60_000,
          });
          const receiptRow = adminPage
            .getByTestId("finance-receipts-list")
            .getByRole("listitem")
            .filter({ has: adminPage.locator(`a[title="${registrationId}"]`) });
          const reviewForm = receiptRow.getByTestId("finance-receipt-review-form");
          await expect(reviewForm).toBeVisible({ timeout: 60_000 });
          const reviewResponsePromise = adminPage.waitForResponse(
            (response) =>
              response.request().method() === "PATCH" &&
              new URL(response.url()).pathname ===
                `/api/finance/receipts/${receiptBody.data!.id}/review`
          );
          await reviewForm.getByRole("button", { name: /approve|تأیید/i }).click();
          const reviewResponse = await reviewResponsePromise;
          expect(reviewResponse.status(), await reviewResponse.text()).toBe(200);
        }

        rows = await readRoster();
        expect(rows).toHaveLength(2);
        for (let index = 0; index < 2; index++) {
          expect(rows.find((row) => row.id === registrationIds[index])).toMatchObject({
            guestLabel: expect.stringContaining(names[index]),
            status: "approved",
            paymentStatus: "paid",
            partySize: 1,
          });
        }
      });
    });
  }

  test("same national ID on two guest cards currently creates two bookings", async ({
    page,
    browser,
  }) => {
    test.setTimeout(360_000);
    const stamp = Date.now();
    const title = `TC paid group duplicate ${stamp}`;
    const suffix = String(stamp).slice(-7);
    const memberPhone = syntheticTestPhone();
    const firstName = `Duplicate Probe A ${suffix}`;
    const secondName = `Duplicate Probe B ${suffix}`;
    const sharedNationalId = syntheticNationalId(stamp + 900);
    const guestPhones = [syntheticTestPhone(), syntheticTestPhone()];

    const { tourId } = await publishTourForClosure(page, title, {
      capacityMax: 2,
      pricing: {
        paymentCollection: "paid",
        registrationApproval: "auto",
        basePriceToman: "500000",
      },
    });
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

    const responses: Array<{ status: number; body: Record<string, unknown> }> = [];
    const listener = async (response: import("@playwright/test").Response) => {
      if (
        response.request().method() === "POST" &&
        new URL(response.url()).pathname.endsWith("/api/catalog/registrations")
      ) {
        try {
          responses.push({ status: response.status(), body: await response.json() });
        } catch {
          responses.push({ status: response.status(), body: {} });
        }
      }
    };
    page.on("response", listener);
    try {
      await completeCatalogRegistrationIntake(page, {
        fullName: firstName,
        phone: memberPhone,
        partySize: "1",
        registrantTarget: "other",
        guestCount: 2,
        expectSuccess: true,
        guestOverrides: (index) => ({
          fullName: index === 0 ? firstName : secondName,
          phone: guestPhones[index],
          nationalId: sharedNationalId,
          fatherName: `Duplicate Probe Father ${index + 1}`,
        }),
      });
    } finally {
      page.off("response", listener);
    }

    expect(responses.map(({ status }) => status)).toEqual([201, 201]);
    await expect(page.locator("[data-public-registration-success]")).toBeVisible();
    const createdIds = responses.map(({ body }) => body.registrationId ?? body.id);
    expect(createdIds).toEqual([expect.any(String), expect.any(String)]);
    expect(new Set(createdIds).size).toBe(2);

    await withOperatorBookingsUi(browser, async (adminPage) => {
      const response = await adminPage.request.get(
        `/api/bookings?tourId=${encodeURIComponent(tourId)}&view=ops&limit=20`
      );
      expect(response.ok(), await response.text()).toBeTruthy();
      const body = (await response.json()) as { items?: readonly RegistrationRow[] };
      const tourRows = body.items ?? [];
      expect(tourRows).toHaveLength(2);
      expect(tourRows.map((row) => row.id).sort()).toEqual([...createdIds].sort());
      expect(tourRows.find((row) => row.guestLabel?.includes(firstName))).toMatchObject({
        status: "approved",
        partySize: 1,
      });
      expect(tourRows.find((row) => row.guestLabel?.includes(secondName))).toMatchObject({
        status: "approved",
        partySize: 1,
      });
      expect(tourRows.every((row) => row.paymentStatus?.toLowerCase() !== "paid")).toBeTruthy();
    });
  });
});
