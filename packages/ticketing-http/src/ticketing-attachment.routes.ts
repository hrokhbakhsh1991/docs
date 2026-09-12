/**
 * Ticketing attachment HTTP handlers — TKT-001 Phase E1.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  assertTicketingIdempotencyKeyPresent,
  parseTicketAttachmentIntentInput,
  type TicketAttachmentIntentInput,
} from "@app-tour/ticketing-http-contracts";

import { getTicketingHttpHost } from "./host-runtime";
import type { TicketingRouteDeps } from "./host-ports";

function requireIdempotencyKey(key: string | undefined): string {
  assertTicketingIdempotencyKeyPresent(key);
  return key;
}

function readHeader(req: IncomingMessage, name: string): string {
  const raw = req.headers[name.toLowerCase()];
  if (raw === undefined) return "";
  return (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";
}

export async function handleTicketingMemberCreateAttachmentIntent(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const host = getTicketingHttpHost();
  const path = `/member/tickets/${ticketId}/attachments/intents`;
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const { parsedBody, rawBody } = await host.readTicketingRequestBody(req);
    const body: TicketAttachmentIntentInput = parseTicketAttachmentIntentInput(parsedBody);
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
          async () => service.createAttachmentIntent(auth, ticketId, body, idempotencyKey),
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

export async function handleTicketingOperatorCreateAttachmentIntent(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const host = getTicketingHttpHost();
  const path = `/tickets/${ticketId}/attachments/intents`;
  try {
    const auth = await host.requireOperatorSession(req);
    const { parsedBody, rawBody } = await host.readTicketingRequestBody(req);
    const body: TicketAttachmentIntentInput = parseTicketAttachmentIntentInput(parsedBody);
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
          async () =>
            service.createAttachmentIntent(auth, ticketId, body, idempotencyKey, {
              operator: true,
            }),
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

async function handleAttachmentUpload(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
  attachmentId: string,
  options: { readonly operator: boolean },
): Promise<void> {
  const host = getTicketingHttpHost();
  try {
    const auth = options.operator
      ? await host.requireOperatorSession(req)
      : await host.resolveTenantContextFromRequest(req);
    const contentType = readHeader(req, "content-type");
    const maxBytes = 10_485_760;
    const body = await host.readBinaryRequestBody(req, maxBytes);
    const service = await host.resolveTicketingService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        await service.uploadAttachment(
          auth,
          ticketId,
          attachmentId,
          body,
          contentType,
          options.operator ? { operator: true } : undefined,
        );
        host.sendJson(res, 204, {});
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleTicketingMemberUploadAttachment(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
  attachmentId: string,
): Promise<void> {
  await handleAttachmentUpload(req, res, deps, ticketId, attachmentId, { operator: false });
}

export async function handleTicketingOperatorUploadAttachment(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
  attachmentId: string,
): Promise<void> {
  await handleAttachmentUpload(req, res, deps, ticketId, attachmentId, { operator: true });
}

async function handleAttachmentComplete(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
  messageId: string,
  attachmentId: string,
  options: { readonly operator: boolean },
): Promise<void> {
  const host = getTicketingHttpHost();
  const path = options.operator
    ? `/tickets/${ticketId}/messages/${messageId}/attachments/${attachmentId}/complete`
    : `/member/tickets/${ticketId}/messages/${messageId}/attachments/${attachmentId}/complete`;
  try {
    const auth = options.operator
      ? await host.requireOperatorSession(req)
      : await host.resolveTenantContextFromRequest(req);
    const idempotencyKey = requireIdempotencyKey(host.readIdempotencyKey(req));
    const requestHash = host.hashIdempotentRequest("POST", path, "");
    const service = await host.resolveTicketingService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await host.runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          async () =>
            service.completeAttachment(
              auth,
              ticketId,
              messageId,
              attachmentId,
              idempotencyKey,
              options.operator ? { operator: true } : undefined,
            ),
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

export async function handleTicketingMemberCompleteAttachment(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
  messageId: string,
  attachmentId: string,
): Promise<void> {
  await handleAttachmentComplete(req, res, deps, ticketId, messageId, attachmentId, {
    operator: false,
  });
}

export async function handleTicketingOperatorCompleteAttachment(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
  messageId: string,
  attachmentId: string,
): Promise<void> {
  await handleAttachmentComplete(req, res, deps, ticketId, messageId, attachmentId, {
    operator: true,
  });
}

async function handleAttachmentDownload(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
  attachmentId: string,
  options: { readonly operator: boolean },
): Promise<void> {
  const host = getTicketingHttpHost();
  try {
    const auth = options.operator
      ? await host.requireOperatorSession(req)
      : await host.resolveTenantContextFromRequest(req);
    const service = await host.resolveTicketingService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await service.getAttachmentDownloadUrl(
          auth,
          ticketId,
          attachmentId,
          options.operator ? { operator: true } : undefined,
        );
        host.sendJson(res, 200, result);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleTicketingMemberGetAttachment(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
  attachmentId: string,
): Promise<void> {
  await handleAttachmentDownload(req, res, deps, ticketId, attachmentId, { operator: false });
}

export async function handleTicketingOperatorGetAttachment(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
  attachmentId: string,
): Promise<void> {
  await handleAttachmentDownload(req, res, deps, ticketId, attachmentId, { operator: true });
}

async function handleAttachmentDelete(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
  attachmentId: string,
  options: { readonly operator: boolean },
): Promise<void> {
  const host = getTicketingHttpHost();
  try {
    const auth = options.operator
      ? await host.requireOperatorSession(req)
      : await host.resolveTenantContextFromRequest(req);
    const service = await host.resolveTicketingService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        await service.deleteAttachment(
          auth,
          ticketId,
          attachmentId,
          options.operator ? { operator: true } : undefined,
        );
        host.sendJson(res, 204, {});
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleTicketingMemberDeleteAttachment(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
  attachmentId: string,
): Promise<void> {
  await handleAttachmentDelete(req, res, deps, ticketId, attachmentId, { operator: false });
}

export async function handleTicketingOperatorDeleteAttachment(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
  attachmentId: string,
): Promise<void> {
  await handleAttachmentDelete(req, res, deps, ticketId, attachmentId, { operator: true });
}
