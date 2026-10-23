import { expect, test, type Page } from "@playwright/test";

import {
  CATALOG_DEV_OTP,
  fillCatalogOtp,
  gotoPortalRegistration,
  requestRegistrationOtp,
} from "./fixtures/catalog-registration-otp";
import {
  OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID,
  OPERATOR_SMOKE_TRANSPORT_BUS_OCCUPANCY_TOUR_ID,
  OPERATOR_SMOKE_TRANSPORT_BUS_DRIVER_ONLY_TOUR_ID,
  OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID,
} from "./fixtures/complete-portal-registration";

function uniqueTransportPhone(): string {
  const suffix = String(Date.now() + Math.floor(Math.random() * 1000)).slice(-7);
  return `+1555${suffix}`;
}

type RegistrationBody = {
  readonly transport?: { readonly kind?: string; readonly personalCarOccupants?: number };
};

type RegistrationSubmission = {
  readonly body: RegistrationBody;
  readonly registrationId: string;
};

async function reachTransportIntake(page: Page, tourId: string, phone: string): Promise<void> {
  const profileProbes: string[] = [];
  const sessionCookieWrites: string[] = [];
  const registrationDocumentCookie: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "document" && request.url().includes("/catalog/")) {
      void request.allHeaders().then((headers) => {
        registrationDocumentCookie.push(`cookie=${String(Boolean(headers.cookie))}`);
      });
    }
  });
  const captureProfileProbe = async (response: import("@playwright/test").Response) => {
    if (response.url().includes("/api/public-auth/register-complete")) {
      const setCookie = response.headers()["set-cookie"] ?? "";
      const attributes = setCookie
        .split(";")
        .slice(1)
        .map((part) => part.trim().split("=")[0]?.toLowerCase())
        .filter(Boolean)
        .join(",");
      sessionCookieWrites.push(`set-cookie=${Boolean(setCookie)};attrs=${attributes}`);
    }
    if (!response.url().includes("/api/me/profile")) return;
    let bodyOk = "unreadable";
    try {
      const body = (await response.json()) as { ok?: unknown };
      bodyOk = String(body.ok === true);
    } catch {
      // Keep diagnostics non-sensitive; status and the `ok` bit are sufficient.
    }
    profileProbes.push(`${response.status()}:ok=${bodyOk}`);
  };
  page.on("response", captureProfileProbe);
  await page.context().clearCookies();
  await gotoPortalRegistration(page, tourId);
  await requestRegistrationOtp(page, phone);
  await fillCatalogOtp(page, CATALOG_DEV_OTP);

  const profileStep = page.locator("[data-public-registration-profile]");
  if (await profileStep.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.locator("#displayName").fill("Transport Smoke Guest");
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST" &&
          res.url().includes("/api/public-auth/register-complete"),
        { timeout: 90_000 }
      ),
      // The auth host intentionally reloads the register route after the
      // session cookie is verified. We still wait for the BFF response so a
      // failed profile completion is not misreported as an intake timeout.
      page.locator('[data-action="profile-continue"]').click({ noWaitAfter: true }),
    ]);
    const body = await response.text();
    expect(
      response.ok(),
      `register-complete failed (${response.status()}): ${body.slice(0, 240)}`
    ).toBeTruthy();
  }

  try {
    await page.locator("[data-public-registration-intake]").waitFor({
      state: "visible",
      timeout: 60_000,
    });
  } catch (error) {
    const authAlert = await page
      .locator('[role="alert"]')
      .allTextContents()
      .catch(() => []);
    throw new Error(
      `transport intake did not appear; profile probes=[${profileProbes.join(", ")}], session cookie=[${sessionCookieWrites.join(", ")}], document cookies=[${registrationDocumentCookie.join(", ")}], alerts=[${authAlert.join(" | ")}]`,
      { cause: error }
    );
  } finally {
    page.off("response", captureProfileProbe);
  }
}

async function submitAndReadBody(page: Page): Promise<RegistrationSubmission> {
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
  const responseBody = JSON.parse(responseText) as { registrationId?: unknown };
  const registrationId =
    typeof responseBody.registrationId === "string" ? responseBody.registrationId.trim() : "";
  expect(registrationId, "catalog registration must return its id for cleanup").not.toBe("");
  return {
    body: JSON.parse(request.postData() ?? "{}") as RegistrationBody,
    registrationId,
  };
}

async function cancelSubmittedRegistration(page: Page, registrationId: string): Promise<void> {
  const response = await page.request.post(
    `/api/me/registrations/${encodeURIComponent(registrationId)}/cancellation`
  );
  expect(response.ok(), `smoke cleanup cancellation failed (${response.status()})`).toBeTruthy();
}

test("DEN-TRANS-01 bus tour shows direct personal-car choices without an opt-in checkbox", async ({
  page,
}) => {
  await reachTransportIntake(page, OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID, uniqueTransportPhone());

  await expect(page.locator("[data-public-registration-personal-car-opt-in]")).toHaveCount(0);
  const transportFieldset = page.locator("[data-public-registration-transport]");
  await expect(transportFieldset).toBeVisible();
  await expect(transportFieldset.locator('input[name^="transportChoice-"]')).toHaveCount(3);
  await expect(transportFieldset.locator('input[name^="transportChoice-"]:checked')).toHaveCount(0);
});

test("DEN-TRANS-01a organized transport choice persists primary", async ({ page }) => {
  await reachTransportIntake(page, OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID, uniqueTransportPhone());

  const transportFieldset = page.locator("[data-public-registration-transport]");
  await expect(transportFieldset).toBeVisible();
  await transportFieldset.locator('input[name^="transportChoice-"]').first().check();

  const submission = await submitAndReadBody(page);
  expect(submission.body.transport?.kind).toBe("primary");
  await cancelSubmittedRegistration(page, submission.registrationId);
});

test("DEN-TRANS-02 personal-car choice persists personal_car with occupants", async ({ page }) => {
  await reachTransportIntake(
    page,
    OPERATOR_SMOKE_TRANSPORT_BUS_OCCUPANCY_TOUR_ID,
    uniqueTransportPhone()
  );

  const transportFieldset = page.locator("[data-public-registration-transport]");
  await expect(transportFieldset).toBeVisible();
  await transportFieldset.locator('input[name^="transportChoice-"]').nth(1).check();
  await page
    .locator('[data-public-registration-transport-occupants] input[name^="personalCarOccupants-"]')
    .nth(2)
    .check();

  const submission = await submitAndReadBody(page);
  expect(submission.body.transport?.kind).toBe("personal_car");
  expect(submission.body.transport?.personalCarOccupants).toBe(2);
  await cancelSubmittedRegistration(page, submission.registrationId);
});

test("DEN-TRANS-02b personal-car choice persists driver-only with zero companions", async ({
  page,
}) => {
  await reachTransportIntake(
    page,
    OPERATOR_SMOKE_TRANSPORT_BUS_DRIVER_ONLY_TOUR_ID,
    uniqueTransportPhone()
  );

  const transportFieldset = page.locator("[data-public-registration-transport]");
  await expect(transportFieldset).toBeVisible();
  await transportFieldset.locator('input[name^="transportChoice-"]').nth(1).check();
  await page
    .locator("[data-public-registration-transport-occupants] input[type=radio]")
    .first()
    .check();

  const submission = await submitAndReadBody(page);
  expect(submission.body.transport?.kind).toBe("personal_car");
  expect(submission.body.transport?.personalCarOccupants).toBe(0);
  await cancelSubmittedRegistration(page, submission.registrationId);
});

test("DEN-TRANS-02c incomplete transport explains the blocker and focuses its control", async ({
  page,
}) => {
  await reachTransportIntake(page, OPERATOR_SMOKE_TRANSPORT_BUS_TOUR_ID, uniqueTransportPhone());

  const transportFieldset = page.locator("[data-public-registration-transport]");
  await expect(transportFieldset).toBeVisible();
  await transportFieldset.locator('input[name^="transportChoice-"]').nth(1).check();

  await page.locator('[data-action="intake-submit"]').click();

  await expect(page.locator("[data-denali-field-alert]")).toBeVisible();
  await expect(transportFieldset).toHaveAttribute("aria-invalid", "true");
  await expect(transportFieldset.locator("input").first()).toBeFocused();
});

test("DEN-TRANS-03 shared_cars tour forces dong follow-up and persists no_car_dong", async ({
  page,
}) => {
  await reachTransportIntake(page, OPERATOR_SMOKE_TRANSPORT_SHARED_TOUR_ID, uniqueTransportPhone());

  const transportFieldset = page.locator("[data-public-registration-transport]");
  await expect(transportFieldset).toBeVisible();
  await expect(page.locator("[data-registration-price-hint]")).toBeVisible();
  await transportFieldset.locator('input[name^="transportChoice-"]').nth(1).check();
  await page
    .locator('[data-public-registration-transport-dong] input[name="paysDong-self"]')
    .first()
    .check();

  const submission = await submitAndReadBody(page);
  expect(submission.body.transport?.kind).toBe("no_car_dong");
  await cancelSubmittedRegistration(page, submission.registrationId);
});
