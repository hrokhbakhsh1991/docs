import ExcelJS from "exceljs";

import type { BookingActorContext } from "../bookings/ports/booking-actor-context";
import { listTourOperationalRoster } from "./operational-roster.service";
import type {
  OperationalRosterListQuery,
  OperationalRosterListResponse,
  TourOperationalRosterRow,
} from "@app-tour/workspace-denali/roster";
import { parseMinorUnits } from "@app-tour/workspace-denali/roster";

const EXPORT_PAGE_SIZE = 100;

const DATA_COLUMNS = [
  { header: "نام و نام خانوادگی", key: "guestLabel", width: 28 },
  { header: "شماره تماس", key: "phone", width: 18 },
  { header: "شناسه ثبت‌نام", key: "registrationId", width: 38 },
  { header: "تعداد نفرات", key: "partySize", width: 12 },
  { header: "وضعیت نهایی‌شدن", key: "finalizationStatus", width: 18 },
  { header: "وضعیت پرداخت", key: "paymentStatus", width: 18 },
  { header: "مبلغ کل", key: "totalMinor", width: 18 },
  { header: "مبلغ پرداخت‌شده", key: "paidMinor", width: 18 },
  { header: "مانده", key: "remainingMinor", width: 18 },
  { header: "مهلت پرداخت", key: "paymentDueAt", width: 24 },
  { header: "نوع حمل‌ونقل", key: "transportKind", width: 22 },
  { header: "تاریخ ثبت‌نام", key: "submittedAt", width: 24 },
  { header: "تاریخ نهایی‌شدن", key: "finalizedAt", width: 24 },
] as const;

export type FinalRosterExportResult = {
  readonly filename: string;
  readonly contentType: string;
  readonly body: Buffer;
};

export async function listAllFinalRosterRows(
  auth: BookingActorContext,
  tourId: string,
  loadPage: (
    auth: BookingActorContext,
    tourId: string,
    query: OperationalRosterListQuery
  ) => Promise<OperationalRosterListResponse> = listTourOperationalRoster
): Promise<readonly TourOperationalRosterRow[]> {
  const rows: TourOperationalRosterRow[] = [];
  let cursor: string | undefined;

  do {
    const query: OperationalRosterListQuery = {
      view: "ops",
      filter: "final",
      limit: EXPORT_PAGE_SIZE,
      ...(cursor === undefined ? {} : { cursor }),
    };
    const page = await loadPage(auth, tourId, query);
    rows.push(...page.items);
    cursor = page.nextCursor ?? undefined;
  } while (cursor !== undefined);

  return rows;
}

export async function buildFinalRosterWorkbook(input: {
  readonly tourId: string;
  readonly tourTitle?: string | null;
  readonly generatedAt?: Date;
  readonly rows: readonly TourOperationalRosterRow[];
}): Promise<Buffer> {
  const generatedAt = input.generatedAt ?? new Date();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Denali";
  workbook.created = generatedAt;
  workbook.modified = generatedAt;

  const finalRows = input.rows.filter((row) => row.isFinalParticipant);
  const unpaidRows = finalRows.filter((row) => !row.isFinanciallySettled);
  const paidRows = finalRows.filter((row) => row.isFinanciallySettled);
  const totalMinor = sumMinor(finalRows.map((row) => totalForRow(row)));
  const paidMinor = sumMinor(finalRows.map((row) => row.paidMinor));
  const remainingMinor = sumMinor(finalRows.map((row) => row.remainingMinor));

  const summary = workbook.addWorksheet("خلاصه گزارش");
  summary.views = [{ rightToLeft: true }];
  summary.columns = [
    { header: "عنوان", key: "label", width: 30 },
    { header: "مقدار", key: "value", width: 42 },
  ];
  summary.addRows([
    ["نام تور", safeCell(input.tourTitle ?? input.tourId)],
    ["شناسه تور", safeCell(input.tourId)],
    ["زمان تولید", generatedAt.toISOString()],
    ["تعداد کل نهایی‌شده", finalRows.length],
    ["تعداد تسویه‌شده", paidRows.length],
    ["تعداد بدهکار یا پرداخت ناقص", unpaidRows.length],
    ["مبلغ کل", totalMinor],
    ["مبلغ پرداخت‌شده", paidMinor],
    ["مبلغ مانده", remainingMinor],
  ]);
  summary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };

  addDataSheet(workbook, "لیست نهایی", finalRows);
  addDataSheet(workbook, "نیازمند تسویه", unpaidRows);
  addDataSheet(workbook, "تسویه‌شده", paidRows);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function createFinalRosterExport(
  auth: BookingActorContext,
  tourId: string,
  tourTitle?: string | null
): Promise<FinalRosterExportResult> {
  const normalizedTourId = tourId.trim();
  if (normalizedTourId.length === 0) {
    throw new Error("TOUR_NOT_FOUND");
  }
  const rows = await listAllFinalRosterRows(auth, normalizedTourId);
  const generatedAt = new Date();
  const timestamp = generatedAt
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return {
    filename: `denali-tour-${normalizedTourId}-final-roster-${timestamp}.xlsx`,
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    body: await buildFinalRosterWorkbook({
      tourId: normalizedTourId,
      tourTitle,
      generatedAt,
      rows,
    }),
  };
}

function addDataSheet(
  workbook: ExcelJS.Workbook,
  name: string,
  rows: readonly TourOperationalRosterRow[]
): void {
  const sheet = workbook.addWorksheet(name);
  sheet.views = [{ rightToLeft: true }];
  sheet.columns = [...DATA_COLUMNS];
  sheet.addRows(rows.map(toExportRow));
  const tableEnd = Math.max(2, rows.length + 1);
  sheet.addTable({
    name: `Roster${tableNameSuffix(name)}`,
    ref: `A1:M${tableEnd}`,
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: DATA_COLUMNS.map((column) => ({ name: column.header })),
    rows: rows.map((row) => DATA_COLUMNS.map((column) => toExportRow(row)[column.key])),
  });
  sheet.autoFilter = { from: "A1", to: `M${tableEnd}` };
}

function toExportRow(row: TourOperationalRosterRow): Record<string, string | number> {
  const paid = parseMinorUnits(row.paidMinor) ?? BigInt(0);
  const remaining = parseMinorUnits(row.remainingMinor) ?? BigInt(0);
  return {
    guestLabel: safeCell(row.guestLabel),
    phone: safeCell(row.guestPhone ?? "—"),
    registrationId: safeCell(row.registrationId),
    partySize: row.partySize,
    finalizationStatus: row.finalizationStatus,
    paymentStatus: row.financialDisplayState,
    totalMinor: (paid + remaining).toString(),
    paidMinor: paid.toString(),
    remainingMinor: remaining.toString(),
    paymentDueAt: row.paymentDueAt ?? "—",
    transportKind: row.transportKind ?? "—",
    submittedAt: row.submittedAt,
    finalizedAt: row.finalizationStatus === "finalized" ? (row.finalizedAt ?? "—") : "—",
  };
}

function totalForRow(row: TourOperationalRosterRow): string | null {
  const paid = parseMinorUnits(row.paidMinor) ?? BigInt(0);
  const remaining = parseMinorUnits(row.remainingMinor) ?? BigInt(0);
  return (paid + remaining).toString();
}

function sumMinor(values: readonly (string | null)[]): string {
  return values
    .reduce((sum, value) => sum + (parseMinorUnits(value) ?? BigInt(0)), BigInt(0))
    .toString();
}

function safeCell(value: string): string {
  const trimmed = value.trim();
  return /^[=+\-@]/.test(trimmed) ? `'${trimmed}` : trimmed;
}

function tableNameSuffix(name: string): string {
  if (name === "لیست نهایی") return "Final";
  if (name === "نیازمند تسویه") return "Unpaid";
  return "Paid";
}
