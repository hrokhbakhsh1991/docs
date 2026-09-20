import type { IncomingMessage, ServerResponse } from "node:http";

import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { handleHttpError } from "../middleware/error-interceptor";
import { resolveTenantContextFromRequest } from "../tenant-kernel/tenant-kernel";
import { requireOperatorSession } from "../identity/require-operator-session";
import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import {
  countUnreadTicketNotifications,
  listTicketNotifications,
  markAllTicketNotificationsRead,
  markTicketNotificationRead,
} from "./ticket-notification.repository";
import { assertTicketingWorkspaceGate } from "./assert-ticketing-access";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

function parseLimit(raw: string | null, fallback = 20): number {
  const parsed = raw === null ? fallback : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, 50);
}

function parseListQuery(url: URL): {
  readonly limit: number;
  readonly cursor: string | null;
  readonly unreadOnly: boolean;
} {
  return {
    limit: parseLimit(url.searchParams.get("limit")),
    cursor: url.searchParams.get("cursor"),
    unreadOnly: url.searchParams.get("unreadOnly") === "true",
  };
}

function sendNotificationJson(
  res: ServerResponse,
  statusCode: number,
  body: Record<string, unknown>,
): void {
  for (const [key, value] of Object.entries(PRIVATE_NO_STORE)) {
    res.setHeader(key, value);
  }
  sendJson(res, statusCode, body);
}

function assertMemberCanMutate(auth: TenantAuthContext): void {
  if (auth.role === "viewer") {
    throw new Error("TICKET_VIEWER_READ_ONLY");
  }
}

async function memberHandler(
  req: IncomingMessage,
  res: ServerResponse,
  handler: (auth: TenantAuthContext) => Promise<void>,
): Promise<void> {
  try {
    const auth = await resolveTenantContextFromRequest(req);
    await assertTicketingWorkspaceGate(auth.tenantId);
    await runWithHttpRequestContext(req, auth, () => handler(auth), { rateLimit: "read" });
  } catch (error) {
    handleHttpError(res, error);
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

export async function handleMemberListTicketNotifications(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await memberHandler(req, res, async (auth) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const query = parseListQuery(url);
    const result = await listTicketNotifications({
      tenantId: auth.tenantId,
      userId: auth.role === "viewer" ? undefined : auth.userId,
      viewerTenantWide: auth.role === "viewer",
      unreadOnly: query.unreadOnly,
      cursor: query.cursor,
      limit: query.limit,
    });
    sendNotificationJson(res, 200, {
      items: result.items,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    });
  });
}

export async function handleMemberUnreadTicketNotificationCount(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await memberHandler(req, res, async (auth) => {
    const count = await countUnreadTicketNotifications({
      tenantId: auth.tenantId,
      userId: auth.role === "viewer" ? undefined : auth.userId,
      viewerTenantWide: auth.role === "viewer",
    });
    sendNotificationJson(res, 200, { count });
  });
}

export async function handleMemberMarkTicketNotificationRead(
  req: IncomingMessage,
  res: ServerResponse,
  notificationId: string,
): Promise<void> {
  await memberHandler(req, res, async (auth) => {
    assertMemberCanMutate(auth);
    const row = await markTicketNotificationRead({
      tenantId: auth.tenantId,
      notificationId,
      userId: auth.userId,
    });
    if (row === null) {
      sendNotificationJson(res, 404, { ok: false, code: "TICKET_NOTIFICATION_NOT_FOUND" });
      return;
    }
    sendNotificationJson(res, 200, { ok: true, notification: row });
  });
}

export async function handleMemberMarkAllTicketNotificationsRead(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await memberHandler(req, res, async (auth) => {
    assertMemberCanMutate(auth);
    const updated = await markAllTicketNotificationsRead({
      tenantId: auth.tenantId,
      userId: auth.userId,
    });
    sendNotificationJson(res, 200, { ok: true, updated });
  });
}

export async function handleOperatorListTicketNotifications(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const query = parseListQuery(url);
    const result = await listTicketNotifications({
      tenantId: auth.tenantId,
      userId: auth.userId,
      unreadOnly: query.unreadOnly,
      cursor: query.cursor,
      limit: query.limit,
    });
    sendNotificationJson(res, 200, {
      items: result.items,
      hasMore: result.hasMore,
      nextCursor: result.nextCursor,
    });
  });
}

export async function handleOperatorUnreadTicketNotificationCount(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    const count = await countUnreadTicketNotifications({
      tenantId: auth.tenantId,
      userId: auth.userId,
    });
    sendNotificationJson(res, 200, { count });
  });
}

export async function handleOperatorMarkTicketNotificationRead(
  req: IncomingMessage,
  res: ServerResponse,
  notificationId: string,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    const row = await markTicketNotificationRead({
      tenantId: auth.tenantId,
      notificationId,
      userId: auth.userId,
    });
    if (row === null) {
      sendNotificationJson(res, 404, { ok: false, code: "TICKET_NOTIFICATION_NOT_FOUND" });
      return;
    }
    sendNotificationJson(res, 200, { ok: true, notification: row });
  });
}

export async function handleOperatorMarkAllTicketNotificationsRead(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    const updated = await markAllTicketNotificationsRead({
      tenantId: auth.tenantId,
      userId: auth.userId,
    });
    sendNotificationJson(res, 200, { ok: true, updated });
  });
}
