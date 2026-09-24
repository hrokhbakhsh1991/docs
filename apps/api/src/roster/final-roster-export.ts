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
  { header: "ردیف", key: "rowNumber", width: 8 },
  { header: "نام و نام خانوادگی", key: "guestLabel", width: 28 },
  { header: "شماره تماس", key: "phone", width: 18 },
  { header: "تعداد نفرات", key: "partySize", width: 12 },
  { header: "وضعیت نهایی", key: "finalizationStatus", width: 18 },
  { header: "وضعیت مالی", key: "paymentStatus", width: 20 },
  { header: "مبلغ کل", key: "totalAmount", width: 22 },
  { header: "مبلغ پرداخت‌شده", key: "paidAmount", width: 22 },
  { header: "مانده", key: "remainingAmount", width: 22 },
  { header: "مهلت پرداخت", key: "paymentDueAt", width: 24 },
  { header: "نوع حمل‌ونقل", key: "transportKind", width: 28 },
  { header: "ظرفیت قابل سوارکردن", key: "personalCarOccupants", width: 24 },
  { header: "تاریخ ثبت‌نام", key: "submittedAt", width: 24 },
  { header: "تاریخ نهایی‌شدن", key: "finalizedAt", width: 24 },
] as const;

export type FinalRosterExportResult = {
  readonly filename: string;
  readonly contentType: string;
  readonly body: Buffer;
};

export async function listAllOperationalRosterRowsForExport(
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
      filter: "operational",
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

  const finalRows = input.rows.filter(
    (row) =>
      row.isFinalParticipant &&
      row.isFinanciallySettled &&
      (row.financialDisplayState === "PAID" || row.financialDisplayState === "WAIVED")
  );
  const unpaidRows = input.rows.filter(
    (row) => row.isOperationalParticipant && !row.isFinanciallySettled
  );
  const paidRows = finalRows.filter(
    (row) => row.isFinanciallySettled && row.financialDisplayState === "PAID"
  );
  const waivedRows = finalRows.filter((row) => row.financialDisplayState === "WAIVED");
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
    ["زمان تولید", formatAdminDate(generatedAt.toISOString())],
    ["تعداد کل نهایی‌شده", finalRows.length],
    ["تعداد پرداخت‌شده", paidRows.length],
    ["تعداد بدون دریافت وجه", waivedRows.length],
    ["تعداد بدهکار یا پرداخت ناقص", unpaidRows.length],
    ["مبلغ کل", formatAmount(totalMinor, finalRows[0]?.currency ?? null)],
    ["مبلغ پرداخت‌شده", formatAmount(paidMinor, finalRows[0]?.currency ?? null)],
    ["مبلغ مانده", formatAmount(remainingMinor, finalRows[0]?.currency ?? null)],
  ]);
  summary.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  summary.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2563EB" } };

  addDataSheet(workbook, "لیست نهایی", finalRows);
  addDataSheet(workbook, "منتظر پرداخت", unpaidRows);
  addDataSheet(workbook, "پرداخت‌شده", paidRows);
  addDataSheet(workbook, "بدون دریافت وجه", waivedRows);

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
  const rows = await listAllOperationalRosterRowsForExport(auth, normalizedTourId);
  const generatedAt = new Date();
  const timestamp = generatedAt
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  return {
    filename: `denali-final-roster-${timestamp}.xlsx`,
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
  sheet.addRows(rows.map((row, index) => toExportRow(row, index + 1)));
  const tableEnd = Math.max(2, rows.length + 1);
  sheet.addTable({
    name: `Roster${tableNameSuffix(name)}`,
    ref: `A1:N${tableEnd}`,
    headerRow: true,
    totalsRow: false,
    style: { theme: "TableStyleMedium2", showRowStripes: true },
    columns: DATA_COLUMNS.map((column) => ({ name: column.header })),
    rows: rows.map((row, index) =>
      DATA_COLUMNS.map((column) => toExportRow(row, index + 1)[column.key])
    ),
  });
  sheet.autoFilter = { from: "A1", to: `N${tableEnd}` };
}

function toExportRow(
  row: TourOperationalRosterRow,
  rowNumber: number
): Record<string, string | number> {
  const paid = parseMinorUnits(row.paidMinor) ?? BigInt(0);
  const remaining = parseMinorUnits(row.remainingMinor) ?? BigInt(0);
  return {
    rowNumber,
    guestLabel: safeCell(row.guestLabel),
    phone: safeCell(row.guestPhone ?? "—"),
    partySize: row.partySize,
    finalizationStatus:
      row.finalizationStatus === "finalized" ? "نهایی‌شده" : "در انتظار نهایی‌سازی",
    paymentStatus: paymentStatusLabel(row.financialDisplayState),
    totalAmount: formatAmount((paid + remaining).toString(), row.currency),
    paidAmount: formatAmount(paid.toString(), row.currency),
    remainingAmount: formatAmount(remaining.toString(), row.currency),
    paymentDueAt: formatAdminDate(row.paymentDueAt),
    transportKind: transportKindLabel(row.transportKind),
    personalCarOccupants: formatOccupants(row),
    submittedAt: formatAdminDate(row.submittedAt),
    finalizedAt: row.finalizationStatus === "finalized" ? formatAdminDate(row.finalizedAt) : "—",
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
  if (name === "منتظر پرداخت") return "Unpaid";
  if (name === "پرداخت‌شده") return "Paid";
  return "Waived";
}

function paymentStatusLabel(status: TourOperationalRosterRow["financialDisplayState"]): string {
  switch (status) {
    case "PAID":
      return "پرداخت کامل";
    case "PARTIALLY_PAID":
      return "پرداخت ناقص";
    case "UNPAID":
      return "پرداخت‌نشده";
    case "WAIVED":
      return "بدون دریافت وجه";
    default:
      return "قابل اعمال نیست";
  }
}

function transportKindLabel(kind: TourOperationalRosterRow["transportKind"]): string {
  switch (kind) {
    case "primary":
      return "حمل‌ونقل اصلی تور";
    case "personal_car":
      return "ماشین شخصی خودش";
    case "no_car_dong":
      return "ماشین شخصی دیگران — با هزینه دونگ";
    case "no_car_acquaintance":
      return "ماشین شخصی دیگران — آشنا";
    default:
      return "ثبت نشده";
  }
}

function formatOccupants(row: TourOperationalRosterRow): string {
  if (row.transportKind !== "personal_car" || row.personalCarOccupants === null) {
    return "—";
  }
  return `${new Intl.NumberFormat("fa-IR").format(row.personalCarOccupants)} نفر`;
}

function formatAmount(value: string | null, currency: string | null): string {
  const parsed = parseMinorUnits(value);
  if (parsed === null) return "—";
  const unit = currency === "IRT" ? "تومان" : currency === "IRR" ? "ریال" : (currency ?? "");
  const formatted = new Intl.NumberFormat("fa-IR").format(parsed);
  return unit.length > 0 ? `${formatted} ${unit}` : formatted;
}

function formatAdminDate(value: string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Tehran",
  }).format(date);
}
