import { expect, test, type Page } from "@playwright/test";
import ExcelJS from "../../../api/node_modules/exceljs/excel.js";

import {
  completeCatalogRegistrationIntake,
  fillCatalogOtp,
  requestRegistrationOtp,
} from "../../../portal/tests/e2e/fixtures/catalog-registration-otp";
import {
  fetchMarketingCatalogTour,
  PORTAL_OPERATOR_BASE_URL,
  publishTourForClosure,
} from "../../test/fixtures/tour-creation-closure-fixture";
import { withOperatorBookingsUi } from "../../../portal/tests/e2e/fixtures/operator-booking-ui";

type WorkbookSheet = {
  readonly rowCount: number;
  getRow(row: number): { readonly values: readonly unknown[] };
};
type Workbook = {
  readonly xlsx: { load(data: Buffer): Promise<void> };
  getWorksheet(name: string): WorkbookSheet | undefined;
};

async function openMemberIntake(
  page: Page,
  tourId: string,
  phone: string,
  fullName: string
): Promise<void> {
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
  if (await profileStep.isVisible().catch(() => false)) {
    await page.locator("#displayName").fill(fullName);
    const profileResponse = page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        response.url().includes("/api/public-auth/register-complete"),
      { timeout: 90_000 }
    );
    await page.locator('[data-action="profile-continue"]').click({ noWaitAfter: true });
    const response = await profileResponse;
    expect(response.ok(), `profile completion failed (${response.status()})`).toBeTruthy();
  }

  await page.locator("[data-public-registration-intake][data-registration-ready]").waitFor({
    state: "visible",
    timeout: 120_000,
  });
}

for (const mode of ["train", "airplane"] as const) {
  test(`TC-CL-SEAT-FORM-${mode.toUpperCase()}-01 member flow has no seat selection and exports match roster`, async ({
    page,
    browser,
  }) => {
    test.setTimeout(360_000);
    const stamp = Date.now();
    const title = `TC-CL seat form ${mode} ${stamp}`;
    const guestName = `Seat Form ${mode} ${String(stamp).slice(-6)}`;
    const phone = `+1555${String(stamp).slice(-7)}`;
    const { tourId, canonical } = await publishTourForClosure(page, title, {
      capacityMax: 2,
      pricing: { paymentCollection: "free", registrationApproval: "auto" },
      transport: {
        mode,
        ...(mode === "train" ? { seatPreference: "پنجره" } : {}),
      },
    });
    expect((canonical.transport as { mode?: string } | undefined)?.mode).toBe(mode);

    const catalogTour = await fetchMarketingCatalogTour(page, tourId);
    expect(catalogTour.transport?.mode).toBe(mode);

    await openMemberIntake(page, tourId, phone, guestName);
    const intake = page.locator("[data-public-registration-intake]");
    const visibleControlDescriptions = await intake
      .locator("input, select, textarea, [role='combobox']")
      .evaluateAll((elements) =>
        elements
          .filter((element) => {
            const style = window.getComputedStyle(element);
            return style.display !== "none" && style.visibility !== "hidden";
          })
          .map((element) => {
            const label = element.closest("label")?.textContent ?? "";
            return [
              element.getAttribute("name"),
              element.getAttribute("data-intake-field"),
              element.getAttribute("aria-label"),
              label,
            ]
              .filter(Boolean)
              .join(" ");
          })
      );
    const controls = visibleControlDescriptions.join(" ");
    expect(controls).not.toMatch(/seat|صندلی/i);
    if (mode === "airplane") expect(controls).not.toMatch(/flight|پرواز/i);

    const registrationRequest = page.waitForRequest(
      (request) =>
        request.method() === "POST" &&
        new URL(request.url()).pathname.endsWith("/api/catalog/registrations"),
      { timeout: 90_000 }
    );
    await completeCatalogRegistrationIntake(page, {
      fullName: guestName,
      partySize: "1",
      phone,
      registrantTarget: "self",
    });
    const requestBody = JSON.parse((await registrationRequest).postData() ?? "{}") as {
      transport?: { kind?: string };
    };
    expect(requestBody.transport?.kind).toBe("primary");
    expect(JSON.stringify(requestBody)).not.toMatch(/seatPreference|flightSeat|seatNumber/i);

    await page.goto(`${PORTAL_OPERATOR_BASE_URL}/me/registrations`, {
      waitUntil: "domcontentloaded",
    });
    const detailLink = page
      .locator("[data-portal-member-registrations-list] a")
      .filter({ hasText: title })
      .first();
    await expect(detailLink).toBeVisible({ timeout: 60_000 });
    const href = await detailLink.getAttribute("href");
    const registrationId = href?.match(/\/me\/registrations\/([^/?#]+)/)?.[1];
    expect(registrationId).toBeTruthy();
    await page.goto(`${PORTAL_OPERATOR_BASE_URL}${href}`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-portal-member-registration-detail]")).toBeVisible({
      timeout: 60_000,
    });
    const memberResponse = await page.request.get(
      `${PORTAL_OPERATOR_BASE_URL}/api/me/registrations/${encodeURIComponent(registrationId!)}`
    );
    expect(memberResponse.ok(), await memberResponse.text()).toBeTruthy();
    expect(((await memberResponse.json()) as { data?: { status?: string } }).data?.status).toBe(
      "approved"
    );

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
          transportKind?: string | null;
        }[];
      };
      expect((roster.items ?? []).find((row) => row.id === registrationId)).toMatchObject({
        guestLabel: expect.stringContaining(guestName),
        status: "approved",
        transportKind: "primary",
      });

      const allocationsResponse = await adminPage.request.get(
        `/api/tours/${encodeURIComponent(tourId)}/transport-allocations`
      );
      expect(allocationsResponse.ok(), await allocationsResponse.text()).toBeTruthy();
      const allocationData = (await allocationsResponse.json()) as {
        allocations?: readonly unknown[];
      };
      expect(allocationData.allocations).toEqual([]);

      const exportResponse = await adminPage.request.get(
        `/api/tours/${encodeURIComponent(tourId)}/operational-roster/export?filter=final&format=xlsx`
      );
      expect(exportResponse.ok(), await exportResponse.text()).toBeTruthy();
      const workbook = new ExcelJS.Workbook() as unknown as Workbook;
      await workbook.xlsx.load(await exportResponse.body());
      const finalSheet = workbook.getWorksheet("لیست نهایی");
      expect(finalSheet).toBeDefined();
      const headers = (finalSheet?.getRow(1).values ?? []).map(String).join(" ");
      expect(headers).not.toMatch(/seat|صندلی|driver|راننده|passenger|مسافر/i);
      const exportedMember = Array.from(
        { length: Math.max(0, (finalSheet?.rowCount ?? 0) - 1) },
        (_, index) => (finalSheet?.getRow(index + 2).values ?? []).map(String).join(" ")
      ).find((row) => row.includes(guestName));
      expect(exportedMember).toBeTruthy();
    });

    console.log(
      `TC-CL-SEAT-FORM-${mode.toUpperCase()}-01 tour=${tourId} registration=${registrationId} controls=${JSON.stringify(visibleControlDescriptions)}`
    );
  });
}
