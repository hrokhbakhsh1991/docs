/**
 * Runtime proof — bookings inbox avatar identity (mocked list API).
 */
import { expect, test } from "@playwright/test";

import { bookingsRowAvatarTestId } from "../src/features/bookings/bookings-command-center-types";
import { loginOperatorOwner } from "./fixtures/operator-owner-session";

const AVATAR_A =
  "data:image/svg+xml," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect fill="red" width="32" height="32"/></svg>');
const AVATAR_B =
  "data:image/svg+xml," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect fill="blue" width="32" height="32"/></svg>');
const BROKEN_AVATAR = "https://invalid.example.test/bookings-avatar-broken.png";

const BOOKING_A = "00000000-0000-4000-8000-000000000401";
const BOOKING_B = "00000000-0000-4000-8000-000000000402";
const BOOKING_C = "00000000-0000-4000-8000-000000000403";
const BOOKING_D = "00000000-0000-4000-8000-000000000404";
const MEMBER_A = "00000000-0000-4000-8000-000000000201";
const MEMBER_B = "00000000-0000-4000-8000-000000000202";
const MEMBER_C = "00000000-0000-4000-8000-000000000203";

const MATRIX_ITEMS = [
  {
    id: BOOKING_A,
    guestLabel: "Guest A",
    memberUserId: MEMBER_A,
    memberAvatarUrl: AVATAR_A,
    tourTitle: "Matrix Trek",
    tourId: "00000000-0000-4000-8000-000000000210",
    partySize: 1,
    status: "pending",
    paymentStatus: "unpaid",
    departureAt: "2026-12-01T10:00:00.000Z",
    submittedAt: "2026-08-01T10:00:00.000Z",
    registrantTarget: "other",
    capacitySnapshot: { occupied: 0, max: 12 },
    financialDisplayState: "none",
  },
  {
    id: BOOKING_B,
    guestLabel: "Guest B",
    memberUserId: MEMBER_B,
    memberAvatarUrl: AVATAR_B,
    tourTitle: "Matrix Trek",
    tourId: "00000000-0000-4000-8000-000000000210",
    partySize: 1,
    status: "pending",
    paymentStatus: "unpaid",
    departureAt: "2026-12-02T10:00:00.000Z",
    submittedAt: "2026-08-02T10:00:00.000Z",
    registrantTarget: "other",
    capacitySnapshot: { occupied: 0, max: 12 },
    financialDisplayState: "none",
  },
  {
    id: BOOKING_C,
    guestLabel: "Guest C",
    memberUserId: MEMBER_C,
    memberAvatarUrl: null,
    tourTitle: "Matrix Trek",
    tourId: "00000000-0000-4000-8000-000000000210",
    partySize: 1,
    status: "pending",
    paymentStatus: "unpaid",
    departureAt: "2026-12-03T10:00:00.000Z",
    submittedAt: "2026-08-03T10:00:00.000Z",
    registrantTarget: "other",
    capacitySnapshot: { occupied: 0, max: 12 },
    financialDisplayState: "none",
  },
  {
    id: BOOKING_D,
    guestLabel: "Guest D",
    memberUserId: MEMBER_A,
    memberAvatarUrl: AVATAR_A,
    tourTitle: "Matrix Trek",
    tourId: "00000000-0000-4000-8000-000000000210",
    partySize: 1,
    status: "pending",
    paymentStatus: "unpaid",
    departureAt: "2026-12-04T10:00:00.000Z",
    submittedAt: "2026-08-04T10:00:00.000Z",
    registrantTarget: "other",
    capacitySnapshot: { occupied: 0, max: 12 },
    financialDisplayState: "none",
  },
] as const;

type RowCapture = {
  readonly bookingId: string;
  readonly guestLabel: string;
  readonly memberUserId: string;
  readonly imageSrc: string | null;
  readonly fallbackVisible: boolean;
};

async function captureRows(page: import("@playwright/test").Page): Promise<RowCapture[]> {
  const rows = page.locator("[data-booking-row]");
  const count = await rows.count();
  const out: RowCapture[] = [];
  for (let index = 0; index < count; index += 1) {
    const row = rows.nth(index);
    const guestLabel =
      (await row.locator("p.truncate.text-sm.font-medium").first().textContent())?.trim() ?? "";
    const bookingId = MATRIX_ITEMS.find((item) => item.guestLabel === guestLabel)?.id ?? guestLabel;
    const memberUserId =
      MATRIX_ITEMS.find((item) => item.guestLabel === guestLabel)?.memberUserId ?? "unknown";
    const avatar = row.locator("[data-operator-profile-avatar-image]");
    const imageSrc = (await avatar.count()) > 0 ? await avatar.getAttribute("src") : null;
    const fallbackVisible = await row.locator("[data-operator-profile-avatar-icon]").isVisible();
    out.push({ bookingId, guestLabel, memberUserId, imageSrc, fallbackVisible });
  }
  return out;
}

function installBookingsMock(
  page: import("@playwright/test").Page,
  items: readonly (typeof MATRIX_ITEMS)[number][]
): void {
  page.route(/\/api\/bookings\/summary/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        pending: items.length,
        approvedToday: 0,
        departures7d: items.length,
        waitlist: 0,
        tourChips: [],
      }),
    });
  });
  page.route(/\/api\/bookings(\?|$)/, async (route) => {
    if (route.request().url().includes("/summary")) {
      return route.continue();
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ items, total: items.length, nextCursor: null }),
    });
  });
}

test.describe("bookings avatar row identity", () => {
  test.describe.configure({ retries: 1 });
  test("WEB-BKG-AVT-RT-01 renders four rows with correct avatar mapping", async ({ page }) => {
    installBookingsMock(page, MATRIX_ITEMS);
    await loginOperatorOwner(page);
    await page.goto("/bookings?status=all");
    await page.getByRole("textbox").first().fill("Guest");
    await page.waitForSelector(`[data-testid="${bookingsRowAvatarTestId(BOOKING_A)}"]`);

    const rows = await captureRows(page);
    expect(rows.length).toBeGreaterThanOrEqual(3);

    const guestA = rows.find((row) => row.bookingId === BOOKING_A);
    const guestB = rows.find((row) => row.bookingId === BOOKING_B);
    const guestC = rows.find((row) => row.bookingId === BOOKING_C);
    const guestD = rows.find((row) => row.bookingId === BOOKING_D);

    expect(guestA).toMatchObject({
      memberUserId: MEMBER_A,
      imageSrc: AVATAR_A,
      fallbackVisible: false,
    });
    expect(guestB).toMatchObject({
      memberUserId: MEMBER_B,
      imageSrc: AVATAR_B,
      fallbackVisible: false,
    });
    expect(guestC).toMatchObject({
      memberUserId: MEMBER_C,
      imageSrc: null,
      fallbackVisible: true,
    });
    expect(guestD).toMatchObject({
      memberUserId: MEMBER_A,
      imageSrc: AVATAR_A,
      fallbackVisible: false,
    });
  });

  test("WEB-BKG-AVT-RT-02 filter out/in does not leak avatar state", async ({ page }) => {
    installBookingsMock(page, MATRIX_ITEMS);
    await loginOperatorOwner(page);
    await page.goto("/bookings?status=all");
    const search = page.getByRole("textbox").first();
    await search.fill("Guest A");
    await page.waitForTimeout(500);
    let rows = await captureRows(page);
    expect(rows.some((row) => row.bookingId === BOOKING_A && row.imageSrc === AVATAR_A)).toBe(true);

    await search.fill("");
    await page.waitForTimeout(500);
    rows = await captureRows(page);
    expect(rows.find((row) => row.bookingId === BOOKING_B)?.imageSrc).toBe(AVATAR_B);
    expect(rows.find((row) => row.bookingId === BOOKING_C)?.imageSrc).toBeNull();
  });

  test("WEB-BKG-AVT-RT-03 broken avatar on one row does not affect siblings", async ({ page }) => {
    const broken = MATRIX_ITEMS.map((item) =>
      item.id === BOOKING_B ? { ...item, memberAvatarUrl: BROKEN_AVATAR } : item
    );
    installBookingsMock(page, broken);
    await loginOperatorOwner(page);
    await page.goto("/bookings?status=all");
    await page.getByRole("textbox").first().fill("Guest");
    await page.waitForTimeout(800);

    const rows = await captureRows(page);
    expect(rows.find((row) => row.bookingId === BOOKING_A)?.imageSrc).toBe(AVATAR_A);
    expect(rows.find((row) => row.bookingId === BOOKING_B)?.fallbackVisible).toBe(true);
    expect(rows.find((row) => row.bookingId === BOOKING_C)?.imageSrc).toBeNull();
  });
});
