import type { IncomingMessage, ServerResponse } from "node:http";

import { assertPlatformOpsAuth } from "../../platform/assert-platform-ops-auth.ts";
import { assertPlatformOpsOwnerRole } from "../../platform/assert-platform-ops-role.ts";
import type { PlatformOpsUserRepository } from "../../platform/platform-ops-user.repository.ts";
import { exportPlatformAuditCsv } from "../../platform/export-platform-audit-csv.ts";
import { listPlatformAuditEventsFiltered } from "../../platform/list-platform-audit-events-filtered.ts";
import {
  PlatformForbidden,
  PlatformUnauthorized,
} from "../../platform/platform.errors.ts";

function readAuditExportMaxRows(): number {
  const raw = process.env.PLATFORM_AUDIT_EXPORT_MAX_ROWS?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : 10000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10000;
}

function parseDateParam(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : new Date(parsed);
}

export async function handlePlatformAuditExportGet(
  req: IncomingMessage,
  res: ServerResponse,
  deps: { auth?: { repository?: PlatformOpsUserRepository } } = {}
): Promise<void> {
  try {
    const ctx = await assertPlatformOpsAuth(req.headers as Record<string, string | undefined>, deps.auth);
    assertPlatformOpsOwnerRole(ctx);
  } catch (err: unknown) {
    if (err instanceof PlatformUnauthorized || (err as { code?: string })?.code === "PLATFORM_UNAUTHORIZED") {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized", code: "PLATFORM_UNAUTHORIZED" }));
      return;
    }
    if (err instanceof PlatformForbidden || (err as { code?: string })?.code === "PLATFORM_FORBIDDEN") {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "forbidden", code: "PLATFORM_FORBIDDEN" }));
      return;
    }
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "internal_error" }));
    return;
  }

  try {
    const parsed = new URL(req.url ?? "/platform/v1/audit/export", "http://local");
    const from = parseDateParam(parsed.searchParams.get("from"), new Date("1970-01-01T00:00:00.000Z"));
    const to = parseDateParam(parsed.searchParams.get("to"), new Date("2099-12-31T23:59:59.999Z"));
    const rows = await listPlatformAuditEventsFiltered({
      from,
      to,
      limit: readAuditExportMaxRows(),
    });
    const csv = exportPlatformAuditCsv(rows);
    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="platform-audit-export.csv"',
    });
    res.end(csv);
  } catch {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "internal_error" }));
  }
}
