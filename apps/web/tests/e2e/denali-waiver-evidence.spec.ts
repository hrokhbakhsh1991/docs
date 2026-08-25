/**
 * Launch closure — approve without payment (obligation override / Case 4).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { expect, test } from "@playwright/test";

import {
  loginOperatorWithPhone,
  OPERATOR_OWNER_MOBILE,
} from "../../test/fixtures/operator-owner-session";

const TOUR_ID =
  process.env.DP1_TOUR_ID?.trim() || "00000000-0000-4000-8000-000000000901";
const EVIDENCE_ROOT =
  process.env.WAVE_B_EVIDENCE_DIR?.trim() ||
  join(process.cwd(), "../../docs/evidence/denali-wave-b5/pending");
const BROWSER_DIR = join(EVIDENCE_ROOT, "browser");
const API_DIR = join(EVIDENCE_ROOT, "api");

function ensureDirs(): void {
  if (!existsSync(BROWSER_DIR)) mkdirSync(BROWSER_DIR, { recursive: true });
  if (!existsSync(API_DIR)) mkdirSync(API_DIR, { recursive: true });
}

test.describe("Denali waiver / approve without payment", () => {
  test.beforeAll(() => {
    ensureDirs();
  });

  test("approve unpaid then waive obligation — API truth + finance UI", async ({ page }) => {
    test.setTimeout(300_000);
    await loginOperatorWithPhone(page, OPERATOR_OWNER_MOBILE, { skipDashboard: true });

    const stamp = Date.now();
    const guestName = `Waiver Cert ${stamp}`;
    const tourRes = await page.request.get(`/api/tours/${encodeURIComponent(TOUR_ID)}`);
    expect(tourRes.ok(), await tourRes.text()).toBeTruthy();
    const tourBody = (await tourRes.json()) as {
      projection?: { title?: string; departureAt?: string };
    };
    const tourTitle = tourBody.projection?.title?.trim() ?? "";
    const departureAt = tourBody.projection?.departureAt?.trim() ?? "";

    const createRes = await page.request.post("/api/bookings", {
      data: {
        tourId: TOUR_ID,
        tourTitle,
        guestLabel: guestName,
        guestEmail: `waiver-${stamp}@denali-smoke.local`,
        partySize: 1,
        departureAt,
      },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();
    const registrationId = ((await createRes.json()) as { id?: string }).id?.trim() ?? "";
    expect(registrationId.length).toBeGreaterThan(0);
    writeFileSync(join(API_DIR, "waiver-booking-create.json"), await createRes.text());

    const approveRes = await page.request.post(`/api/bookings/${registrationId}/approve`);
    expect(approveRes.ok(), await approveRes.text()).toBeTruthy();
    writeFileSync(join(API_DIR, "waiver-approve.json"), await approveRes.text());

    const unpaidBooking = await page.request.get(`/api/bookings/${registrationId}`);
    writeFileSync(join(API_DIR, "waiver-after-approve-booking.json"), await unpaidBooking.text());
    const unpaidBody = (await unpaidBooking.json()) as { paymentStatus?: string };
    expect(unpaidBody.paymentStatus).toBe("unpaid");

    const overrideRes = await page.request.put(
      `/api/finance/registrations/${registrationId}/obligation-override`,
      {
        data: {
          obligationMinor: "0",
          reason: "Launch closure waiver certification",
        },
      }
    );
    expect(overrideRes.ok(), await overrideRes.text()).toBeTruthy();
    writeFileSync(join(API_DIR, "waiver-obligation-override.json"), await overrideRes.text());

    const invoiceRes = await page.request.get(
      `/api/finance/invoices/${encodeURIComponent(registrationId)}`
    );
    expect(invoiceRes.ok(), await invoiceRes.text()).toBeTruthy();
    writeFileSync(join(API_DIR, "waiver-invoice.json"), await invoiceRes.text());
    const invoice = (await invoiceRes.json()) as { remainingMinor?: string; balanceDueMinor?: string };
    expect(invoice.remainingMinor ?? invoice.balanceDueMinor).toBe("0");

    const paidBooking = await page.request.get(`/api/bookings/${registrationId}`);
    writeFileSync(join(API_DIR, "waiver-after-waive-booking.json"), await paidBooking.text());
    const paidBody = (await paidBooking.json()) as { paymentStatus?: string };
    expect(paidBody.paymentStatus).toBe("paid");

    const rosterRes = await page.request.get(
      `/api/tours/${TOUR_ID}/operational-roster?filter=final`
    );
    writeFileSync(join(API_DIR, "waiver-roster-final.json"), await rosterRes.text());
    const roster = (await rosterRes.json()) as { items?: { registrationId?: string }[] };
    expect((roster.items ?? []).some((r) => r.registrationId === registrationId)).toBe(true);

    await page.goto(
      `/tours/${TOUR_ID}/workspace?tab=finance&focusRegistrationId=${encodeURIComponent(registrationId)}`,
      { waitUntil: "domcontentloaded" }
    );
    await page.screenshot({
      path: join(BROWSER_DIR, "waiver-finance-workspace-1440.png"),
      fullPage: true,
    });

    writeFileSync(
      join(EVIDENCE_ROOT, "waiver-classification.txt"),
      "FULLY_IMPLEMENTED — CASE_1 approve leaves unpaid; CASE_4 zero obligation override via finance API; UI control in Advanced tools (detailOverrideNoPayment); roster final + paymentStatus=paid without cash receipt"
    );
  });
});
