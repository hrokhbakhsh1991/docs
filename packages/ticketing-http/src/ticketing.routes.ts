/**
 * Ticketing-owned HTTP handlers — TKT-001 Phase C1.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  parseMemberAddMessageInput,
  parseMemberCreateTicketInput,
  parseMemberReopenTicketInput,
  parseMemberTicketListQuery,
  parseOperatorInternalNoteInput,
  parseOperatorReplyInput,
  parseOperatorTicketListQuery,
  parseOperatorTicketPatchInput,
  parseOperatorTicketBulkInput,
  assertTicketingIdempotencyKeyPresent,
  type MemberAddMessageInput,
  type MemberCreateTicketInput,
  type MemberReopenTicketInput,
  type OperatorInternalNoteInput,
  type OperatorReplyInput,
  type OperatorTicketPatchInput,
  type OperatorTicketBulkInput,
} from "@app-tour/ticketing-http-contracts";

import { getTicketingHttpHost } from "./host-runtime";
import type { TicketingRouteDeps } from "./host-ports";

export type { TicketingRouteDeps } from "./host-ports";

type TicketingService = Awaited<
  ReturnType<ReturnType<typeof getTicketingHttpHost>["resolveTicketingService"]>
>;
type TenantAuth = Awaited<
  ReturnType<ReturnType<typeof getTicketingHttpHost>["resolveTenantContextFromRequest"]>
>;
type OperatorAuth = Awaited<
  ReturnType<ReturnType<typeof getTicketingHttpHost>["requireOperatorSession"]>
>;

function requireIdempotencyKey(key: string | undefined): string {
  assertTicketingIdempotencyKeyPresent(key);
  return key;
}

async function memberRead(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  handler: (service: TicketingService, auth: TenantAuth) => Promise<void>,
): Promise<void> {
  const host = getTicketingHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const service = await host.resolveTicketingService(deps, auth);
    await host.runWithHttpRequestContext(req, auth, () => handler(service, auth), {
      rateLimit: "read",
    });
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

async function operatorRead(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  handler: (service: TicketingService, auth: OperatorAuth) => Promise<void>,
): Promise<void> {
  const host = getTicketingHttpHost();
  try {
    const auth = await host.requireOperatorSession(req);
    const service = await host.resolveTicketingService(deps, auth);
    await host.runWithHttpRequestContext(req, auth, () => handler(service, auth), {
      rateLimit: "read",
    });
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

async function operatorWrite<TBody extends Record<string, unknown>>(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  path: string,
  statusCode: number,
  parseBody: (raw: unknown) => TBody,
  handler: (
    service: TicketingService,
    auth: OperatorAuth,
    body: TBody,
    idempotencyKey: string,
  ) => Promise<Record<string, unknown>>,
): Promise<void> {
  const host = getTicketingHttpHost();
  try {
    const auth = await host.requireOperatorSession(req);
    const { parsedBody, rawBody } = await host.readTicketingRequestBody(req);
    const body = parseBody(parsedBody);
    const idempotencyKey = requireIdempotencyKey(host.readIdempotencyKey(req));
    const requestHash = host.hashIdempotentRequest(req.method ?? "POST", path, rawBody);
    const service = await host.resolveTicketingService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await host.runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          async () => handler(service, auth, body, idempotencyKey),
          { statusCode },
        );
        host.sendJson(res, statusCode, result);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleTicketingMemberListTickets(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
): Promise<void> {
  const host = getTicketingHttpHost();
  await memberRead(req, res, deps, async (service, auth) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const query = parseMemberTicketListQuery(url);
    const result = await service.listMemberTickets(auth, query);
    host.sendJson(res, 200, result);
  });
}

export async function handleTicketingMemberCreateTicket(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
): Promise<void> {
  const host = getTicketingHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const { parsedBody, rawBody } = await host.readTicketingRequestBody(req);
    const body: MemberCreateTicketInput = parseMemberCreateTicketInput(parsedBody);
    const idempotencyKey = requireIdempotencyKey(host.readIdempotencyKey(req));
    const requestHash = host.hashIdempotentRequest("POST", "/member/tickets", rawBody);
    const service = await host.resolveTicketingService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await host.runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          async () => service.createMemberTicket(auth, body, idempotencyKey),
          { statusCode: 201 },
        );
        host.sendJson(res, 201, result);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleTicketingMemberGetTicket(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const host = getTicketingHttpHost();
  await memberRead(req, res, deps, async (service, auth) => {
    const result = await service.getMemberTicket(auth, ticketId);
    host.sendJson(res, 200, result);
  });
}

export async function handleTicketingMemberAddMessage(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const host = getTicketingHttpHost();
  const path = `/member/tickets/${ticketId}/messages`;
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const { parsedBody, rawBody } = await host.readTicketingRequestBody(req);
    const body: MemberAddMessageInput = parseMemberAddMessageInput(parsedBody);
    const idempotencyKey = requireIdempotencyKey(host.readIdempotencyKey(req));
    const requestHash = host.hashIdempotentRequest("POST", path, rawBody);
    const service = await host.resolveTicketingService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await host.runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          async () => service.addMemberMessage(auth, ticketId, body, idempotencyKey),
          { statusCode: 201 },
        );
        host.sendJson(res, 201, result);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleTicketingMemberReopenTicket(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const host = getTicketingHttpHost();
  const path = `/member/tickets/${ticketId}/reopen`;
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const { parsedBody, rawBody } = await host.readTicketingRequestBody(req);
    const body: MemberReopenTicketInput = parseMemberReopenTicketInput(parsedBody);
    const idempotencyKey = requireIdempotencyKey(host.readIdempotencyKey(req));
    const requestHash = host.hashIdempotentRequest("POST", path, rawBody);
    const service = await host.resolveTicketingService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await host.runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          async () => service.reopenMemberTicket(auth, ticketId, body, idempotencyKey),
          { statusCode: 200 },
        );
        host.sendJson(res, 200, result);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleTicketingOperatorListTickets(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
): Promise<void> {
  const host = getTicketingHttpHost();
  await operatorRead(req, res, deps, async (service, auth) => {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const query = parseOperatorTicketListQuery(url);
    const result = await service.listOperatorTickets(auth, query);
    host.sendJson(res, 200, result);
  });
}

export async function handleTicketingOperatorGetTicket(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const host = getTicketingHttpHost();
  await operatorRead(req, res, deps, async (service, auth) => {
    const result = await service.getOperatorTicket(auth, ticketId);
    host.sendJson(res, 200, result);
  });
}

export async function handleTicketingOperatorReply(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const path = `/tickets/${ticketId}/replies`;
  await operatorWrite(
    req,
    res,
    deps,
    path,
    201,
    parseOperatorReplyInput,
    async (service, auth, body: OperatorReplyInput, idempotencyKey) =>
      (await service.operatorReply(auth, ticketId, body, idempotencyKey)) as Record<
        string,
        unknown
      >,
  );
}

export async function handleTicketingOperatorInternalNote(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const path = `/tickets/${ticketId}/internal-notes`;
  await operatorWrite(
    req,
    res,
    deps,
    path,
    201,
    parseOperatorInternalNoteInput,
    async (service, auth, body: OperatorInternalNoteInput, idempotencyKey) =>
      (await service.operatorInternalNote(auth, ticketId, body, idempotencyKey)) as Record<
        string,
        unknown
      >,
  );
}

export async function handleTicketingOperatorPatchTicket(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const path = `/tickets/${ticketId}`;
  await operatorWrite(
    req,
    res,
    deps,
    path,
    200,
    parseOperatorTicketPatchInput,
    async (service, auth, body: OperatorTicketPatchInput, idempotencyKey) =>
      (await service.patchOperatorTicket(auth, ticketId, body, idempotencyKey)) as Record<
        string,
        unknown
      >,
  );
}

export async function handleTicketingOperatorReopenTicket(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const path = `/tickets/${ticketId}/reopen`;
  await operatorWrite(
    req,
    res,
    deps,
    path,
    200,
    parseMemberReopenTicketInput,
    async (service, auth, body: MemberReopenTicketInput, idempotencyKey) =>
      (await service.reopenOperatorTicket(auth, ticketId, body, idempotencyKey)) as Record<
        string,
        unknown
      >,
  );
}

export async function handleTicketingOperatorBulkTickets(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
): Promise<void> {
  const path = "/tickets/bulk";
  await operatorWrite(
    req,
    res,
    deps,
    path,
    200,
    parseOperatorTicketBulkInput,
    async (service, auth, body: OperatorTicketBulkInput, idempotencyKey) =>
      (await service.bulkOperatorTickets(auth, body, idempotencyKey)) as Record<string, unknown>,
  );
}
