import assert from "node:assert/strict";
import { describe, it } from "node:test";

import ExcelJS from "exceljs";

import {
  buildFinalRosterWorkbook,
  listAllOperationalRosterRowsForExport,
} from "./final-roster-export";
import type { TourOperationalRosterRow } from "@app-tour/workspace-denali/roster";

function row(input: Partial<TourOperationalRosterRow>): TourOperationalRosterRow {
  return {
    registrationId: "reg-1",
    tourId: "tour-1",
    guestLabel: "Normal guest",
    guestPhone: "+989121234567",
    approvedAt: "2026-09-18T08:05:00.000Z",
    finalizedAt: "2026-09-18T08:10:00.000Z",
    partySize: 1,
    registrationStatus: "approved",
    finalizationStatus: "finalized",
    financialDisplayState: "PAID",
    remainingMinor: "0",
    paidMinor: "100000",
    currency: "IRR",
    paymentDueAt: null,
    holdStatus: null,
    transportKind: "primary",
    personalCarOccupants: null,
    isDriverOffer: false,
    passengerAssignmentStatus: "not_implemented",
    refundDisplayState: "none",
    isFinalParticipant: true,
    isOperationalParticipant: true,
    isFinanciallySettled: true,
    occupiesCapacity: true,
    departureAt: "2026-09-20T08:00:00.000Z",
    submittedAt: "2026-09-18T08:00:00.000Z",
    ...input,
  };
}

describe("final roster Excel export", () => {
  it("drains every roster cursor page", async () => {
    const calls: Array<string | undefined> = [];
    const first = row({ registrationId: "first" });
    const second = row({ registrationId: "second" });
    const rows = await listAllOperationalRosterRowsForExport(
      { tenantId: "tenant-1", userId: "user-1", role: "owner", status: "ACTIVE" },
      "tour-1",
      async (_auth, _tourId, query) => {
        calls.push(query.cursor);
        return query.cursor === undefined
          ? {
              tourId: "tour-1",
              filter: "operational",
              items: [first],
              total: 101,
              nextCursor: "next",
            }
          : {
              tourId: "tour-1",
              filter: "operational",
              items: [second],
              total: 101,
              nextCursor: null,
            };
      }
    );
    assert.deepEqual(calls, [undefined, "next"]);
    assert.deepEqual(
      rows.map((item) => item.registrationId),
      ["first", "second"]
    );
  });

  it("BUG-STG-EXPORT-SUMMARY / BUG-STG-014/015/016 keeps approved debt in the participant roster and exports finance separately", async () => {
    const workbook = await buildFinalRosterWorkbook({
      tourId: "tour-1",
      tourTitle: "Denali test tour",
      generatedAt: new Date("2026-09-18T08:00:00.000Z"),
      rows: [
        row({
          registrationId: "paid-1",
          guestLabel: "Paid guest",
          isFinanciallySettled: true,
          financialDisplayState: "PAID",
        }),
        row({
          registrationId: "debt-1",
          guestLabel: '=HYPERLINK("https://evil.example")',
          isFinalParticipant: true,
          finalizedAt: null,
          finalizationStatus: "not_final",
          isFinanciallySettled: false,
          financialDisplayState: "PARTIALLY_PAID",
          remainingMinor: "50000",
          paidMinor: "50000",
        }),
        row({
          registrationId: "not-final-1",
          isFinalParticipant: false,
          finalizationStatus: "not_final",
        }),
        row({
          registrationId: "waived-1",
          guestLabel: "Waived guest",
          currency: null,
          finalizedAt: null,
          financialDisplayState: "WAIVED",
          transportKind: "personal_car",
          personalCarOccupants: 3,
          isFinanciallySettled: true,
        }),
      ],
    });

    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(workbook);
    assert.deepEqual(
      loaded.worksheets.map((sheet) => sheet.name),
      ["خلاصه گزارش", "لیست نهایی", "منتظر پرداخت", "پرداخت‌شده", "بدون دریافت وجه"]
    );

    const finalSheet = loaded.getWorksheet("لیست نهایی")!;
    const unpaidSheet = loaded.getWorksheet("منتظر پرداخت")!;
    const paidSheet = loaded.getWorksheet("پرداخت‌شده")!;
    const waivedSheet = loaded.getWorksheet("بدون دریافت وجه")!;
    assert.equal(finalSheet.rowCount, 4);
    assert.equal(unpaidSheet.rowCount, 2);
    assert.equal(paidSheet.rowCount, 2);
    assert.equal(waivedSheet.rowCount, 2);
    const summary = loaded.getWorksheet("خلاصه گزارش")!;
    const summaryRows = summary.getColumn(1).values as Array<unknown>;
    const summaryValue = (label: string): string => {
      const rowIndex = summaryRows.findIndex((value) => value === label);
      assert.ok(rowIndex > 0, `missing summary label: ${label}`);
      return summary.getCell(rowIndex, 2).text;
    };
    assert.equal(summaryValue("تعداد بدهکار یا پرداخت ناقص"), "1");
    assert.match(summaryValue("مبلغ مانده نهایی‌شده"), /۵۰٬۰۰۰ تومان/);
    assert.match(summaryValue("مبلغ مانده بدهکار یا پرداخت ناقص"), /۵۰٬۰۰۰ تومان/);
    assert.equal(finalSheet.getCell("A1").text, "ردیف");
    assert.equal(finalSheet.getCell("B2").text, "Paid guest");
    assert.match(finalSheet.getCell("G2").text, /تومان/);
    assert.match(finalSheet.getCell("M2").text, /۱۴۰۵|2026/);
    assert.match(finalSheet.getCell("G3").text, /۰ تومان/);
    assert.equal(finalSheet.getCell("N3").text, "—");
    assert.equal(finalSheet.getCell("K2").text, "حمل سازمان‌یافته");
    assert.equal(unpaidSheet.getCell("B2").text.startsWith("'="), true);
    assert.equal(finalSheet.getCell("L4").text, "۳ نفر");
    assert.equal(finalSheet.tables["RosterFinal"]?.name, "RosterFinal");
  });

  it("creates filterable empty data sheets for a tour without final registrations", async () => {
    const workbook = await buildFinalRosterWorkbook({
      tourId: "tour-empty",
      rows: [],
      generatedAt: new Date("2026-09-18T08:00:00.000Z"),
    });
    const loaded = new ExcelJS.Workbook();
    await loaded.xlsx.load(workbook);
    for (const name of ["لیست نهایی", "منتظر پرداخت", "پرداخت‌شده", "بدون دریافت وجه"]) {
      const sheet = loaded.getWorksheet(name)!;
      assert.equal(sheet.rowCount, 1);
      assert.ok(Object.keys(sheet.tables).length > 0);
    }
  });
});
