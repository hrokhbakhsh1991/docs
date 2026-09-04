import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { handleHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { assertTicketingWorkspaceGate } from "./assert-ticketing-access";
import {
  exportTicketReportRows,
  getTicketReportSummary,
  MAX_TICKET_REPORT_EXPORT_ROWS,
  parseTicketReportWindow,
} from "./ticket-report.repository";

function assertAdminRole(auth: TenantAuthContext): void {
  if (auth.role !== "owner" && auth.role !== "admin") {
    throw new Error("FORBIDDEN_OPERATOR_ENDPOINT");
  }
}

async function operatorHandler(
  req: IncomingMessage,
  res: ServerResponse,
  handler: (auth: TenantAuthContext) => Promise<void>,
): Promise<void> {
  try {
    const auth = await requireOperatorSession(req);
    await assertTicketingWorkspaceGate(auth.tenantId);
    await runWithHttpRequestContext(req, auth, () => handler(auth), { rateLimit: "read" });
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleGetTicketReportSummary(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    const url = new URL(req.url ?? "/", "http://local");
    const window = parseTicketReportWindow({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    const summary = await getTicketReportSummary(auth.tenantId, window);
    sendJson(res, 200, { summary });
  });
}

export async function handleExportTicketReport(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    assertAdminRole(auth);
    const url = new URL(req.url ?? "/", "http://local");
    const format = (url.searchParams.get("format") ?? "json").trim().toLowerCase();
    if (format !== "json" && format !== "csv") {
      throw new Error("INVALID_EXPORT_FORMAT");
    }
    const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "", 10);
    const limit = Number.isFinite(limitRaw) ? limitRaw : MAX_TICKET_REPORT_EXPORT_ROWS;
    const window = parseTicketReportWindow({
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    });
    const rows = await exportTicketReportRows(auth.tenantId, window, limit);
    if (format === "json") {
      sendJson(res, 200, { rows, count: rows.length, window });
      return;
    }
    const headers = [
      "ticketCode",
      "id",
      "subject",
      "status",
      "priority",
      "categoryCode",
      "requesterUserId",
      "createdAt",
      "resolvedAt",
    ];
    const escape = (value: unknown): string => {
      const text = value === null || value === undefined ? "" : String(value);
      if (text.includes(",") || text.includes('"') || text.includes("\n")) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    };
    const csv = [
      headers.join(","),
      ...rows.map((row) => headers.map((header) => escape(row[header])).join(",")),
    ].join("\n");
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="ticket-report.csv"');
    res.end(csv);
  });
}
