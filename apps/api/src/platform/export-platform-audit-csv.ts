import type { PlatformAuditEventDto } from "./list-platform-audit-events.ts";

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportPlatformAuditCsv(rows: readonly PlatformAuditEventDto[]): string {
  const header = "id,action,entityType,entityId,actorId,createdAt";
  const lines = rows.map((row) =>
    [
      csvEscape(row.id),
      csvEscape(row.action),
      csvEscape(row.entityType),
      csvEscape(row.entityId),
      csvEscape(row.actorId ?? ""),
      csvEscape(row.createdAt),
    ].join(",")
  );
  return [header, ...lines].join("\n");
}
