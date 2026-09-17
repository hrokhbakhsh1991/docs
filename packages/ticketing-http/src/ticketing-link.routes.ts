/**
 * Ticketing business-entity link HTTP handlers — TKT-001 Phase E1.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  assertTicketingIdempotencyKeyPresent,
  parseTicketLinkCreateInput,
  type TicketLinkCreateInput,
} from "@app-tour/ticketing-http-contracts";

import { getTicketingHttpHost } from "./host-runtime";
import type { TicketingRouteDeps } from "./host-ports";

function requireIdempotencyKey(key: string | undefined): string {
  assertTicketingIdempotencyKeyPresent(key);
  return key;
}

export async function handleTicketingMemberListLinks(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const host = getTicketingHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const service = await host.resolveTicketingService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await service.listTicketLinks(auth, ticketId);
        host.sendJson(res, 200, result);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleTicketingOperatorListLinks(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const host = getTicketingHttpHost();
  try {
    const auth = await host.requireOperatorSession(req);
    const service = await host.resolveTicketingService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await service.listTicketLinks(auth, ticketId, { operator: true });
        host.sendJson(res, 200, result);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleTicketingMemberCreateLink(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const host = getTicketingHttpHost();
  const path = `/member/tickets/${ticketId}/links`;
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const { parsedBody, rawBody } = await host.readTicketingRequestBody(req);
    const body: TicketLinkCreateInput = parseTicketLinkCreateInput(parsedBody);
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
          async () => service.createTicketLink(auth, ticketId, body, idempotencyKey),
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

export async function handleTicketingOperatorCreateLink(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const host = getTicketingHttpHost();
  const path = `/tickets/${ticketId}/links`;
  try {
    const auth = await host.requireOperatorSession(req);
    const { parsedBody, rawBody } = await host.readTicketingRequestBody(req);
    const body: TicketLinkCreateInput = parseTicketLinkCreateInput(parsedBody);
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
            service.createTicketLink(auth, ticketId, body, idempotencyKey, { operator: true }),
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

export async function handleTicketingOperatorDeleteLink(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
  linkId: string,
): Promise<void> {
  const host = getTicketingHttpHost();
  try {
    const auth = await host.requireOperatorSession(req);
    const service = await host.resolveTicketingService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        await service.deleteTicketLink(auth, ticketId, linkId);
        host.sendJson(res, 204, {});
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}
