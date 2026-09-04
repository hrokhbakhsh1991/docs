import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";

import type { TicketTemplateChannel, TicketTemplateLocale } from "@app-tour/ticketing-core";
import type { TenantAuthContext } from "@app-tour/workspace-sdk";

import { handleHttpError } from "../middleware/error-interceptor";
import { requireOperatorSession } from "../identity/require-operator-session";
import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { assertTicketingWorkspaceGate } from "./assert-ticketing-access";
import {
  createTicketTemplate,
  findTicketTemplate,
  listTicketTemplateRevisions,
  listTicketTemplates,
  rollbackTicketTemplate,
  toTicketTemplateHttp,
  updateTicketTemplate,
} from "./ticket-template.repository";

function assertAdminRole(auth: TenantAuthContext): void {
  if (auth.role !== "owner" && auth.role !== "admin") {
    throw new Error("FORBIDDEN_OPERATOR_ENDPOINT");
  }
}

function parseChannelLocale(url: URL): {
  channel: TicketTemplateChannel;
  locale: TicketTemplateLocale;
} {
  const channel = url.searchParams.get("channel")?.trim() as TicketTemplateChannel;
  const locale = url.searchParams.get("locale")?.trim() as TicketTemplateLocale;
  if (!channel || !locale) {
    throw new Error("INVALID_TEMPLATE_SCOPE");
  }
  return { channel, locale };
}

function parseTemplateBody(raw: unknown): {
  title: string;
  body: string;
  channel: TicketTemplateChannel;
  locale: TicketTemplateLocale;
  enabled?: boolean;
  workspaceType?: string | null;
} {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("INVALID_TEMPLATE_BODY");
  }
  const body = raw as Record<string, unknown>;
  return {
    title: String(body.title ?? ""),
    body: String(body.body ?? ""),
    channel: String(body.channel ?? "") as TicketTemplateChannel,
    locale: String(body.locale ?? "") as TicketTemplateLocale,
    enabled: body.enabled === undefined ? undefined : Boolean(body.enabled),
    workspaceType: body.workspaceType === null ? null : String(body.workspaceType ?? "") || null,
  };
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

export async function handleListTicketTemplates(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    const url = new URL(req.url ?? "/", "http://local");
    const channel = url.searchParams.get("channel")?.trim() as TicketTemplateChannel | undefined;
    const locale = url.searchParams.get("locale")?.trim() as TicketTemplateLocale | undefined;
    const items = await listTicketTemplates(auth.tenantId, {
      ...(channel ? { channel } : {}),
      ...(locale ? { locale } : {}),
    });
    sendJson(res, 200, { items: items.map(toTicketTemplateHttp) });
  });
}

export async function handleGetTicketTemplate(
  req: IncomingMessage,
  res: ServerResponse,
  code: string,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    const { channel, locale } = parseChannelLocale(new URL(req.url ?? "/", "http://local"));
    const template = await findTicketTemplate(auth.tenantId, code, channel, locale);
    if (template === null) {
      sendJson(res, 404, { ok: false, code: "TEMPLATE_NOT_FOUND" });
      return;
    }
    sendJson(res, 200, { template: toTicketTemplateHttp(template) });
  });
}

export async function handleCreateTicketTemplate(
  req: IncomingMessage,
  res: ServerResponse,
  code: string,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    assertAdminRole(auth);
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const parsed = parseTemplateBody(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
    const created = await createTicketTemplate(auth.tenantId, {
      code,
      title: parsed.title,
      body: parsed.body,
      channel: parsed.channel,
      locale: parsed.locale,
      enabled: parsed.enabled,
      workspaceType: parsed.workspaceType,
      createdByUserId: auth.userId,
    });
    sendJson(res, 201, { template: toTicketTemplateHttp(created) });
  });
}

export async function handlePatchTicketTemplate(
  req: IncomingMessage,
  res: ServerResponse,
  code: string,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    assertAdminRole(auth);
    const url = new URL(req.url ?? "/", "http://local");
    const { channel, locale } = parseChannelLocale(url);
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
    const parsed = parseTemplateBody({ ...raw, channel, locale });
    const rowVersion = Number(raw.rowVersion);
    const updated = await updateTicketTemplate(auth.tenantId, code, channel, locale, {
      ...(raw.title !== undefined ? { title: parsed.title } : {}),
      ...(raw.body !== undefined ? { body: parsed.body } : {}),
      ...(raw.enabled !== undefined ? { enabled: parsed.enabled } : {}),
      rowVersion,
      updatedByUserId: auth.userId,
    });
    if (updated === null) {
      sendJson(res, 409, { ok: false, code: "ROW_VERSION_CONFLICT" });
      return;
    }
    sendJson(res, 200, { template: toTicketTemplateHttp(updated) });
  });
}

export async function handleRollbackTicketTemplate(
  req: IncomingMessage,
  res: ServerResponse,
  code: string,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    assertAdminRole(auth);
    const url = new URL(req.url ?? "/", "http://local");
    const { channel, locale } = parseChannelLocale(url);
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
    const version = Number(raw.version);
    const rolled = await rollbackTicketTemplate(
      auth.tenantId,
      code,
      channel,
      locale,
      version,
      auth.userId,
    );
    if (rolled === null) {
      sendJson(res, 404, { ok: false, code: "TEMPLATE_REVISION_NOT_FOUND" });
      return;
    }
    sendJson(res, 200, { template: toTicketTemplateHttp(rolled) });
  });
}

export async function handleListTicketTemplateRevisions(
  req: IncomingMessage,
  res: ServerResponse,
  code: string,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    const { channel, locale } = parseChannelLocale(new URL(req.url ?? "/", "http://local"));
    const revisions = await listTicketTemplateRevisions(auth.tenantId, code, channel, locale);
    sendJson(res, 200, { revisions });
  });
}

export async function handlePreviewTicketTemplate(
  req: IncomingMessage,
  res: ServerResponse,
  code: string,
): Promise<void> {
  await operatorHandler(req, res, async (auth) => {
    const { channel, locale } = parseChannelLocale(new URL(req.url ?? "/", "http://local"));
    const template = await findTicketTemplate(auth.tenantId, code, channel, locale);
    if (template === null) {
      sendJson(res, 404, { ok: false, code: "TEMPLATE_NOT_FOUND" });
      return;
    }
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    const raw = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as Record<string, unknown>;
    const { interpolateTicketTemplate } = await import("@app-tour/ticketing-core");
    const rendered = interpolateTicketTemplate(template.body, {
      ticketId: String(raw.ticketId ?? ""),
      ticketSubject: String(raw.ticketSubject ?? ""),
      categoryCode: String(raw.categoryCode ?? ""),
      priority: String(raw.priority ?? ""),
      status: String(raw.status ?? ""),
      requesterUserId: String(raw.requesterUserId ?? ""),
      assigneeUserId: String(raw.assigneeUserId ?? ""),
      clock: String(raw.clock ?? ""),
      escalationLevel: String(raw.escalationLevel ?? ""),
      eventType: String(raw.eventType ?? ""),
    }, { escapeHtml: channel === "email" });
    sendJson(res, 200, { rendered });
  });
}
