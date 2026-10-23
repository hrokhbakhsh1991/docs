/** Multi-state artifact contract for the final-roster XLSX workbook. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import ExcelJS from "exceljs";

import type { TourOperationalRosterRow } from "@app-tour/workspace-denali/roster";
import {
  buildFinalRosterWorkbook,
  listAllOperationalRosterRowsForExport,
} from "./final-roster-export.ts";

function rosterRow(
  id: string,
  overrides: Partial<TourOperationalRosterRow> = {}
): TourOperationalRosterRow {
  return {
    registrationId: id,
    tourId: "qa-tour",
    guestLabel: id,
    guestPhone: null,
    approvedAt: "2031-07-01T00:00:00.000Z",
    finalizedAt: "2031-07-01T00:00:00.000Z",
    partySize: 1,
    registrationStatus: "approved",
    finalizationStatus: "finalized",
    financialDisplayState: "UNPAID",
    remainingMinor: "1000",
    amountDueNowMinor: "1000",
    paidMinor: "0",
    currency: "IRR",
    paymentDueAt: "2031-07-02T00:00:00.000Z",
    holdStatus: "open",
    transportKind: null,
    personalCarOccupants: null,
    isDriverOffer: false,
    passengerAssignmentStatus: "not_implemented",
    refundDisplayState: "none",
    isFinalParticipant: true,
    isOperationalParticipant: true,
    isFinanciallySettled: false,
    occupiesCapacity: true,
    departureAt: "2031-08-01T00:00:00.000Z",
    submittedAt: "2031-06-30T00:00:00.000Z",
    ...overrides,
  };
}

async function workbookSheets(rows: readonly TourOperationalRosterRow[]) {
  const bytes = await buildFinalRosterWorkbook({
    tourId: "qa-tour",
    tourTitle: "QA workbook parity",
    tourCapacityMax: 10,
    generatedAt: new Date("2031-07-01T00:00:00.000Z"),
    rows,
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  return workbook;
}

function labels(sheet: ExcelJS.Worksheet): string[] {
  return (sheet.getColumn(2).values as unknown[])
    .slice(2)
    .filter((value): value is string => typeof value === "string");
}

describe("final roster export multi-state matrix", () => {
  it("follows every roster page instead of truncating downloads at the first 100 rows", async () => {
    const sourceRows = Array.from({ length: 205 }, (_, index) => rosterRow(`guest-${index + 1}`));
    const calls: Array<{ cursor?: string; filter: string; limit: number; view: string }> = [];
    const rows = await listAllOperationalRosterRowsForExport(
      {
        userId: "qa-admin",
        tenantId: "qa-tenant",
        role: "admin",
        status: "ACTIVE",
      },
      "qa-tour",
      async (_auth, tourId, query) => {
        assert.equal(tourId, "qa-tour");
        calls.push(query);
        const pageIndex = query.cursor === undefined ? 0 : Number(query.cursor);
        const start = pageIndex * 100;
        return {
          tourId,
          filter: "operational",
          items: sourceRows.slice(start, start + 100),
          total: sourceRows.length,
          nextCursor: start + 100 < sourceRows.length ? String(pageIndex + 1) : null,
        };
      }
    );

    assert.equal(rows.length, 205);
    assert.deepEqual(
      rows.map((row) => row.registrationId),
      sourceRows.map((row) => row.registrationId)
    );
    assert.deepEqual(calls, [
      { view: "ops", filter: "operational", limit: 100 },
      { view: "ops", filter: "operational", limit: 100, cursor: "1" },
      { view: "ops", filter: "operational", limit: 100, cursor: "2" },
    ]);
  });

  it("keeps final, payment, paid, waived, and non-final rows in the correct sheets", async () => {
    const rows = [
      rosterRow("final-unpaid"),
      rosterRow("final-partial", {
        financialDisplayState: "PARTIALLY_PAID",
        paidMinor: "400",
        remainingMinor: "600",
        amountDueNowMinor: "600",
      }),
      rosterRow("final-paid", {
        financialDisplayState: "PAID",
        paidMinor: "1000",
        remainingMinor: "0",
        amountDueNowMinor: "0",
        isFinanciallySettled: true,
        holdStatus: "satisfied",
      }),
      rosterRow("final-waived", {
        financialDisplayState: "WAIVED",
        paidMinor: "0",
        remainingMinor: "0",
        amountDueNowMinor: "0",
        isFinanciallySettled: true,
      }),
      rosterRow("approved-not-final", {
        finalizationStatus: "not_final",
        finalizedAt: null,
        isFinalParticipant: false,
      }),
      rosterRow("waitlisted", {
        registrationStatus: "waitlisted",
        finalizationStatus: "not_final",
        financialDisplayState: "NOT_APPLICABLE",
        remainingMinor: null,
        amountDueNowMinor: null,
        paidMinor: null,
        paymentDueAt: null,
        holdStatus: null,
        isFinalParticipant: false,
        isOperationalParticipant: false,
        isFinanciallySettled: false,
        occupiesCapacity: false,
      }),
      rosterRow("cancelled", {
        registrationStatus: "cancelled",
        finalizationStatus: "not_final",
        financialDisplayState: "NOT_APPLICABLE",
        remainingMinor: null,
        amountDueNowMinor: null,
        paidMinor: null,
        paymentDueAt: null,
        holdStatus: null,
        isFinalParticipant: false,
        isOperationalParticipant: false,
        isFinanciallySettled: false,
        occupiesCapacity: false,
      }),
    ];

    const workbook = await workbookSheets(rows);
    const finalSheet = workbook.getWorksheet("لیست نهایی");
    const followupSheet = workbook.getWorksheet("منتظر پرداخت");
    const paidSheet = workbook.getWorksheet("پرداخت‌شده");
    const waivedSheet = workbook.getWorksheet("بدون دریافت وجه");
    const summarySheet = workbook.getWorksheet("خلاصه گزارش");
    assert.ok(finalSheet && followupSheet && paidSheet && waivedSheet && summarySheet);

    assert.deepEqual(labels(finalSheet), [
      "final-unpaid",
      "final-partial",
      "final-paid",
      "final-waived",
    ]);
    assert.deepEqual(labels(followupSheet), [
      "final-unpaid",
      "final-partial",
      "approved-not-final",
    ]);
    assert.deepEqual(labels(paidSheet), ["final-paid"]);
    assert.deepEqual(labels(waivedSheet), ["final-waived"]);

    const summary = new Map<string, unknown>();
    for (let row = 2; row <= summarySheet.rowCount; row += 1) {
      summary.set(String(summarySheet.getCell(row, 1).value), summarySheet.getCell(row, 2).value);
    }
    assert.equal(summary.get("تعداد کل نهایی‌شده"), 4);
    assert.equal(summary.get("تعداد پرداخت‌شده"), 1);
    assert.equal(summary.get("تعداد بدون دریافت وجه"), 1);
    assert.equal(summary.get("تعداد بدهکار یا پرداخت ناقص"), 3);
    assert.equal(summary.get("مبلغ کل نهایی‌شده"), "۳٬۰۰۰ تومان");
    assert.equal(summary.get("مبلغ پرداخت‌شده نهایی‌شده"), "۱٬۴۰۰ تومان");
    assert.equal(summary.get("مبلغ مانده نهایی‌شده"), "۱٬۶۰۰ تومان");
    assert.equal(summary.get("مبلغ مانده بدهکار یا پرداخت ناقص"), "۲٬۶۰۰ تومان");
  });

  it("exports readable bus/car capacity and prevents formula injection in guest names", async () => {
    const workbook = await workbookSheets([
      rosterRow('=HYPERLINK("https://example.invalid")', {
        transportKind: "primary",
      }),
      rosterRow("car-driver", {
        transportKind: "personal_car",
        personalCarOccupants: 2,
        isDriverOffer: true,
      }),
    ]);
    const finalSheet = workbook.getWorksheet("لیست نهایی");

    assert.ok(finalSheet);
    assert.equal(finalSheet.getCell(2, 2).value, '\'=HYPERLINK("https://example.invalid")');
    assert.equal(finalSheet.getCell(2, 12).value, "اتوبوس: ۱۰ نفر · باقی‌مانده: ۸ نفر");
    assert.equal(finalSheet.getCell(3, 12).value, "۲ نفر");
  });
});
