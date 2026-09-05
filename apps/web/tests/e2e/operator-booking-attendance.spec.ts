/**
 * SDE-001 — operator attendance marking (browser + RTL/a11y matrix).
 */
import { expect, test, type Page } from "@playwright/test";

import { BOOKINGS_COMMAND_CENTER_TEST_IDS } from "../../src/features/bookings/bookings-command-center-types";
import { OPERATOR_SMOKE_PUBLISHED_TOUR_ID } from "../../test/fixtures/p6-chain-guest-api";
import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";

const TOUR_ID = process.env.QA_TOUR_ID?.trim() || OPERATOR_SMOKE_PUBLISHED_TOUR_ID;

const VIEWPORTS = {
  desktop: { width: 1280, height: 900 },
  mobile: { width: 390, height: 844 },
} as const;

type AppLocale = "en" | "fa";

type TourDetailResponse = {
  readonly projection?: {
    readonly title?: string | null;
    readonly departureAt?: string | null;
  };
};

type BookingCreateResponse = {
  readonly id?: string;
};

async function setOperatorLocale(page: Page, locale: AppLocale): Promise<void> {
  const baseURL = page.context()._options.baseURL;
  const domain =
    typeof baseURL === "string" && baseURL.length > 0
      ? new URL(baseURL).hostname
      : "admin.operator.localhost";
  await page.context().addCookies([
    {
      name: "NEXT_LOCALE",
      value: locale,
      domain,
      path: "/",
    },
  ]);
}

function uniqueStamp(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function findApprovedBookingWithoutAttendance(page: Page): Promise<{
  readonly registrationId: string;
  readonly guestLabel: string;
} | null> {
  const listRes = await page.request.get(
    `/api/bookings?status=approved&view=ops&tourId=${encodeURIComponent(TOUR_ID)}&limit=50`,
  );
  if (!listRes.ok()) {
    return null;
  }
  const listBody = (await listRes.json()) as { items?: Array<{ id?: string; guestLabel?: string }> };
  for (const item of listBody.items ?? []) {
    const id = item.id?.trim() ?? "";
    if (id.length === 0) {
      continue;
    }
    const detailRes = await page.request.get(`/api/bookings/${encodeURIComponent(id)}`);
    if (!detailRes.ok()) {
      continue;
    }
    const detail = (await detailRes.json()) as {
      attendanceStatus?: string | null;
      guestLabel?: string;
    };
    if (detail.attendanceStatus !== "present" && detail.attendanceStatus !== "absent") {
      return { registrationId: id, guestLabel: detail.guestLabel ?? item.guestLabel ?? id };
    }
  }
  return null;
}

async function seedApprovedBookingViaOperatorApi(
  page: Page,
  guestName: string,
): Promise<{ readonly registrationId: string; readonly guestLabel: string }> {
  const existing = await findApprovedBookingWithoutAttendance(page);
  if (existing !== null) {
    return { registrationId: existing.registrationId, guestLabel: existing.guestLabel };
  }

  const stamp = uniqueStamp();
  const tourRes = await page.request.get(`/api/tours/${encodeURIComponent(TOUR_ID)}`);
  expect(tourRes.ok(), await tourRes.text()).toBeTruthy();
  const tourBody = (await tourRes.json()) as TourDetailResponse;
  const tourTitle = tourBody.projection?.title?.trim() ?? "";
  const departureAt = tourBody.projection?.departureAt?.trim() ?? "";
  expect(tourTitle.length).toBeGreaterThan(0);
  expect(departureAt.length).toBeGreaterThan(0);

  const createBookingRes = await page.request.post("/api/bookings", {
    headers: { "Content-Type": "application/json" },
    data: {
      tourId: TOUR_ID,
      tourTitle,
      guestLabel: guestName,
      guestEmail: `attendance-${stamp}@denali-smoke.local`,
      guestPhone: `+1555${stamp.replace(/\D/g, "").slice(-10).padStart(10, "0")}`,
      partySize: 1,
      departureAt,
      registrationIntake: { registrantTarget: "other", tourCapacityMax: 50 },
    },
  });
  expect(createBookingRes.ok(), await createBookingRes.text()).toBeTruthy();
  const createdBooking = (await createBookingRes.json()) as BookingCreateResponse;
  const registrationId = createdBooking.id?.trim() ?? "";
  expect(registrationId.length).toBeGreaterThan(0);

  const approveRes = await page.request.post(`/api/bookings/${registrationId}/approve`);
  expect(approveRes.ok(), await approveRes.text()).toBeTruthy();
  return { registrationId, guestLabel: guestName };
}

async function openApprovedBooking(
  page: Page,
  guestLabel: string,
  registrationId: string,
): Promise<void> {
  await page.goto(
    `/bookings?status=approved&view=ops&tourId=${encodeURIComponent(TOUR_ID)}&search=${encodeURIComponent(guestLabel)}&limit=50`,
  );
  await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.page)).toBeVisible({
    timeout: 15_000,
  });

  const markActions = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.markAbsentButton);
  if (!(await markActions.first().isVisible())) {
    await page.getByRole("button", { name: new RegExp(guestLabel, "i") }).first().click({ force: true });
  }
  const isMobile = (page.viewportSize()?.width ?? 1280) < 1024;
  if (isMobile) {
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.mobileInspectionSheet)).toBeVisible({
      timeout: 15_000,
    });
  }

  await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection)).toContainText(
    /approved|تأییدشده/i,
    { timeout: 15_000 },
  );
}

test.describe("operator-booking-attendance.spec.ts — SDE-001 attendance producer UI", () => {
  test("ATT-B01 EN desktop — mark present with aria + badge", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await setOperatorLocale(page, "en");
    const guestName = `ATT B01 ${uniqueStamp()}`;

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    const { registrationId, guestLabel } = await seedApprovedBookingViaOperatorApi(page, guestName);
    await openApprovedBooking(page, guestLabel, registrationId);

    const presentButton = page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.markPresentButton);
    await expect(presentButton).toBeVisible({ timeout: 15_000 });
    await expect(presentButton).toHaveAttribute("aria-label", /present/i);

    const markResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/attendance") &&
        response.request().method() === "POST" &&
        response.ok(),
    );
    await presentButton.click();
    await markResponse;

    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection)).toContainText(
      /present|حاضر/i,
      { timeout: 15_000 },
    );
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.markPresentButton)).toHaveCount(
      0,
    );
  });

  test("ATT-B02 FA mobile RTL — mark absent", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await setOperatorLocale(page, "fa");
    const guestName = `ATT B02 ${uniqueStamp()}`;

    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });
    const { registrationId, guestLabel } = await seedApprovedBookingViaOperatorApi(page, guestName);
    const markRes = await page.request.post(`/api/bookings/${registrationId}/attendance`, {
      headers: { "Content-Type": "application/json" },
      data: { attendanceStatus: "absent" },
    });
    expect(markRes.ok(), await markRes.text()).toBeTruthy();

    await openApprovedBooking(page, guestLabel, registrationId);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.inspection)).toContainText(
      /absent|غایب/i,
      { timeout: 15_000 },
    );
    await expect(
      page.getByTestId(BOOKINGS_COMMAND_CENTER_TEST_IDS.markAbsentButton),
    ).toHaveCount(0);
  });
});
