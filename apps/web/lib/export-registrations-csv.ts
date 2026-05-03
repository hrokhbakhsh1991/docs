import type { BookingDto } from "@repo/types";

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

const HEADERS = [
  "id",
  "tenantId",
  "tourId",
  "tourTitle",
  "participantFullName",
  "participantContactPhone",
  "transportMode",
  "entryMode",
  "status",
  "paymentStatus",
  "paidAmount",
  "createdAt",
  "updatedAt",
] as const;

export type RegistrationCsvRow = BookingDto & {
  tourTitle: string;
};

/** Builds CSV from live registration projections (RFC-style escaping). */
export function registrationsToCsv(rows: RegistrationCsvRow[]): string {
  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    const cells = HEADERS.map((key) => {
      if (key === "tourTitle") return escapeCsvCell(r.tourTitle);
      const v = r[key as keyof BookingDto];
      if (v == null) return "";
      return escapeCsvCell(String(v));
    });
    lines.push(cells.join(","));
  }
  return lines.join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
