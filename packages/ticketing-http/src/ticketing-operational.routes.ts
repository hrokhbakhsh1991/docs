/**
 * Ticketing operational HTTP handlers — TKT-001 Phase D1.
 */
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  parseTicketAssignInput,
  parseTicketQueueChangeInput,
  parseTicketQueueCreateInput,
  parseTicketQueueUpdateInput,
  parseTicketTagCreateInput,
  parseTicketTagMutationInput,
  parseTicketTagUpdateInput,
  parseTicketTeamCreateInput,
  parseTicketTeamUpdateInput,
  assertTicketingIdempotencyKeyPresent,
  type TicketAssignInput,
  type TicketQueueChangeInput,
  type TicketQueueCreateInput,
  type TicketQueueUpdateInput,
  type TicketTagCreateInput,
  type TicketTagMutationInput,
  type TicketTagUpdateInput,
  type TicketTeamCreateInput,
  type TicketTeamUpdateInput,
} from "@app-tour/ticketing-http-contracts";

import { getTicketingHttpHost } from "./host-runtime";
import type { TicketingRouteDeps } from "./host-ports";

type TicketingService = Awaited<
  ReturnType<ReturnType<typeof getTicketingHttpHost>["resolveTicketingService"]>
>;
type OperatorAuth = Awaited<
  ReturnType<ReturnType<typeof getTicketingHttpHost>["requireOperatorSession"]>
>;

function requireIdempotencyKey(key: string | undefined): string {
  assertTicketingIdempotencyKeyPresent(key);
  return key;
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

async function adminWrite<TBody extends Record<string, unknown>>(
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

export async function handleTicketingListCategories(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
): Promise<void> {
  const host = getTicketingHttpHost();
  await operatorRead(req, res, deps, async (service, auth) => {
    const result = await service.listTicketCategories(auth);
    host.sendJson(res, 200, { items: result });
  });
}

export async function handleTicketingListTags(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
): Promise<void> {
  const host = getTicketingHttpHost();
  await operatorRead(req, res, deps, async (service, auth) => {
    const result = await service.listTags(auth);
    host.sendJson(res, 200, { items: result });
  });
}

export async function handleTicketingCreateTag(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
): Promise<void> {
  await adminWrite(
    req,
    res,
    deps,
    "/ticket-tags",
    201,
    parseTicketTagCreateInput,
    async (service, auth, body: TicketTagCreateInput, idempotencyKey) =>
      (await service.createTag(auth, body, idempotencyKey)) as Record<string, unknown>,
  );
}

export async function handleTicketingUpdateTag(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  code: string,
): Promise<void> {
  const path = `/ticket-tags/${code}`;
  await adminWrite(
    req,
    res,
    deps,
    path,
    200,
    parseTicketTagUpdateInput,
    async (service, auth, body: TicketTagUpdateInput, idempotencyKey) =>
      (await service.updateTag(auth, code, body, idempotencyKey)) as Record<string, unknown>,
  );
}

export async function handleTicketingListQueues(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
): Promise<void> {
  const host = getTicketingHttpHost();
  await operatorRead(req, res, deps, async (service, auth) => {
    const result = await service.listQueues(auth);
    host.sendJson(res, 200, { items: result });
  });
}

export async function handleTicketingCreateQueue(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
): Promise<void> {
  await adminWrite(
    req,
    res,
    deps,
    "/ticket-queues",
    201,
    parseTicketQueueCreateInput,
    async (service, auth, body: TicketQueueCreateInput, idempotencyKey) =>
      (await service.createQueue(auth, body, idempotencyKey)) as Record<string, unknown>,
  );
}

export async function handleTicketingUpdateQueue(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  code: string,
): Promise<void> {
  const path = `/ticket-queues/${code}`;
  await adminWrite(
    req,
    res,
    deps,
    path,
    200,
    parseTicketQueueUpdateInput,
    async (service, auth, body: TicketQueueUpdateInput, idempotencyKey) =>
      (await service.updateQueue(auth, code, body, idempotencyKey)) as Record<string, unknown>,
  );
}

export async function handleTicketingListTeams(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
): Promise<void> {
  const host = getTicketingHttpHost();
  await operatorRead(req, res, deps, async (service, auth) => {
    const result = await service.listTeams(auth);
    host.sendJson(res, 200, { items: result });
  });
}

export async function handleTicketingCreateTeam(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
): Promise<void> {
  await adminWrite(
    req,
    res,
    deps,
    "/ticket-teams",
    201,
    parseTicketTeamCreateInput,
    async (service, auth, body: TicketTeamCreateInput, idempotencyKey) =>
      (await service.createTeam(auth, body, idempotencyKey)) as Record<string, unknown>,
  );
}

export async function handleTicketingUpdateTeam(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  code: string,
): Promise<void> {
  const path = `/ticket-teams/${code}`;
  await adminWrite(
    req,
    res,
    deps,
    path,
    200,
    parseTicketTeamUpdateInput,
    async (service, auth, body: TicketTeamUpdateInput, idempotencyKey) =>
      (await service.updateTeam(auth, code, body, idempotencyKey)) as Record<string, unknown>,
  );
}

export async function handleTicketingAssignTicket(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const path = `/tickets/${ticketId}/assign`;
  await adminWrite(
    req,
    res,
    deps,
    path,
    200,
    parseTicketAssignInput,
    async (service, auth, body: TicketAssignInput, idempotencyKey) =>
      (await service.assignTicket(auth, ticketId, body, idempotencyKey)) as Record<string, unknown>,
  );
}

export async function handleTicketingChangeTicketQueue(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const path = `/tickets/${ticketId}/queue`;
  await adminWrite(
    req,
    res,
    deps,
    path,
    200,
    parseTicketQueueChangeInput,
    async (service, auth, body: TicketQueueChangeInput, idempotencyKey) =>
      (await service.changeTicketQueue(auth, ticketId, body, idempotencyKey)) as Record<
        string,
        unknown
      >,
  );
}

export async function handleTicketingAddTicketTag(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
): Promise<void> {
  const path = `/tickets/${ticketId}/tags`;
  await adminWrite(
    req,
    res,
    deps,
    path,
    200,
    parseTicketTagMutationInput,
    async (service, auth, body: TicketTagMutationInput, idempotencyKey) =>
      (await service.addTicketTag(auth, ticketId, body, idempotencyKey)) as Record<string, unknown>,
  );
}

export async function handleTicketingRemoveTicketTag(
  req: IncomingMessage,
  res: ServerResponse,
  deps: TicketingRouteDeps,
  ticketId: string,
  tagCode: string,
): Promise<void> {
  const host = getTicketingHttpHost();
  const path = `/tickets/${ticketId}/tags/${tagCode}`;
  try {
    const auth = await host.requireOperatorSession(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const rowVersionRaw = url.searchParams.get("rowVersion");
    if (rowVersionRaw === null || rowVersionRaw.trim() === "") {
      throw new Error("ZOD_VALIDATION_FAILED: rowVersion required");
    }
    const rowVersion = Number.parseInt(rowVersionRaw, 10);
    if (!Number.isFinite(rowVersion) || rowVersion < 1) {
      throw new Error("ZOD_VALIDATION_FAILED: rowVersion invalid");
    }
    const idempotencyKey = requireIdempotencyKey(host.readIdempotencyKey(req));
    const requestHash = host.hashIdempotentRequest("DELETE", path, "");
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
            (await service.removeTicketTag(
              auth,
              ticketId,
              tagCode,
              rowVersion,
              idempotencyKey,
            )) as Record<string, unknown>,
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
