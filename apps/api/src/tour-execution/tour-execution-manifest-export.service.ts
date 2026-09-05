import * as XLSX from "xlsx";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { withTenantRls } from "../db/with-tenant-rls";
import {
  assertTourExecutionAdmin,
  TourExecutionInvalidStateError,
  TourExecutionNotFoundError,
} from "./tour-execution-authorization";
import {
  resolveManifestExportContact,
  resolveTourLeaderPublicDisplayName,
} from "./tour-execution-leader.util";

export type TourExecutionManifestExportLocale = "en" | "fa";

const COLUMN_LABELS: Record<
  TourExecutionManifestExportLocale,
  {
    guest: string;
    contact: string;
    registrationStatus: string;
    payment: string;
    insurance: string;
    attendance: string;
    group: string;
    tourLeader: string;
  }
> = {
  en: {
    guest: "Guest",
    contact: "Contact",
    registrationStatus: "Registration",
    payment: "Payment",
    insurance: "Insurance",
    attendance: "Attendance",
    group: "Group",
    tourLeader: "Tour leader",
  },
  fa: {
    guest: "نام شرکت‌کننده",
    contact: "تماس",
    registrationStatus: "ثبت‌نام",
    payment: "پرداخت",
    insurance: "بیمه",
    attendance: "حضور",
    group: "گروه",
    tourLeader: "سرپرست تور",
  },
};

function normalizeLocale(value: string | undefined): TourExecutionManifestExportLocale {
  return value?.trim().toLowerCase().startsWith("fa") ? "fa" : "en";
}

export async function exportTourExecutionManifestXlsx(input: {
  auth: TenantAuthContext;
  tourId: string;
  locale?: string;
  includeGroups?: boolean;
}): Promise<{ buffer: Buffer; filename: string }> {
  assertTourExecutionAdmin(input.auth);
  const locale = normalizeLocale(input.locale);
  const labels = COLUMN_LABELS[locale];

  const execution = await withTenantRls(input.auth.tenantId, async (tx) =>
    tx.tourExecution.findFirst({
      where: {
        tenantId: input.auth.tenantId,
        tourId: input.tourId,
        state: { notIn: ["completed", "cancelled"] },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
  if (execution === null) {
    throw new TourExecutionNotFoundError();
  }
  if (execution.state === "draft" || execution.manifestLockedAt === null) {
    throw new TourExecutionInvalidStateError("draft");
  }

  const tourLeaderDisplayName = await resolveTourLeaderPublicDisplayName(
    input.auth.tenantId,
    execution.tourLeaderUserId,
  );

  const rows = await withTenantRls(input.auth.tenantId, async (tx) => {
    const manifestRows = await tx.tourExecutionManifestRow.findMany({
      where: { tenantId: input.auth.tenantId, executionId: execution.id },
      orderBy: [{ sortOrder: "asc" }, { guestLabel: "asc" }],
    });
    const registrationIds = manifestRows.map((row) => row.registrationId);
    const registrations =
      registrationIds.length > 0
        ? await tx.operatorRegistration.findMany({
            where: { tenantId: input.auth.tenantId, id: { in: registrationIds } },
            select: {
              id: true,
              guestPhone: true,
              guestEmail: true,
              attendanceStatus: true,
            },
          })
        : [];
    const registrationById = new Map(registrations.map((row) => [row.id, row]));

    const groups =
      input.includeGroups === true
        ? await tx.tourExecutionGroup.findMany({
            where: { tenantId: input.auth.tenantId, executionId: execution.id },
          })
        : [];
    const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

    return manifestRows.map((row) => {
      const registration = registrationById.get(row.registrationId);
      const contact = registration ? resolveManifestExportContact(registration) : "";
      const attendanceStatus = registration?.attendanceStatus ?? row.attendanceStatus ?? "";
      const groupName =
        input.includeGroups === true && row.groupId
          ? (groupNameById.get(row.groupId) ?? "")
          : "";
      return {
        [labels.guest]: row.guestLabel,
        [labels.contact]: contact,
        [labels.registrationStatus]: row.registrationStatus,
        [labels.payment]: row.paymentStatus,
        [labels.insurance]: row.insuranceStatus ?? "",
        [labels.attendance]: attendanceStatus ?? "",
        ...(input.includeGroups === true ? { [labels.group]: groupName } : {}),
      };
    });
  });

  const headerRow = {
    [labels.guest]: labels.guest,
    [labels.contact]: labels.contact,
    [labels.registrationStatus]: labels.registrationStatus,
    [labels.payment]: labels.payment,
    [labels.insurance]: labels.insurance,
    [labels.attendance]: labels.attendance,
    ...(input.includeGroups === true ? { [labels.group]: labels.group } : {}),
  };

  const sheet = XLSX.utils.json_to_sheet(
    [{ [labels.tourLeader]: tourLeaderDisplayName ?? "" }, headerRow, ...rows],
    { skipHeader: true },
  );
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, locale === "fa" ? "مانيفست" : "Manifest");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return { buffer, filename: `manifest-${input.tourId.slice(0, 8)}.xlsx` };
}

/** Parse manifest data rows (skips tour-leader meta row + header row). */
export function parseTourExecutionManifestXlsx(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (sheetName === undefined) {
    return [];
  }
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]!, {
    header: 1,
    defval: "",
  }) as unknown[][];
  if (matrix.length < 3) {
    return [];
  }
  const headers = matrix[1]?.map((cell) => String(cell ?? "").trim()) ?? [];
  return matrix.slice(2).map((cells) => {
    const row: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      if (header.length > 0) {
        row[header] = cells[index] ?? "";
      }
    });
    return row;
  });
}
