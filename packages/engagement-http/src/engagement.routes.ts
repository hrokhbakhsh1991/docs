import type { IncomingMessage, ServerResponse } from "node:http";

import {
  parseEngagementListLimit,
  parseOperatorAdjustmentBody,
  parseOperatorReversalBody,
  parseOptionalListCursor,
} from "@app-tour/engagement-http-contracts";

import { getEngagementHttpHost } from "./host-runtime";
import type { EngagementRouteDeps } from "./host-ports";

export type { EngagementRouteDeps, EngagementServicePort } from "./host-ports";
export { ENGAGEMENT_HTTP_ROUTE_MANIFEST } from "./routes-manifest";
export { configureEngagementHttpHost, resetEngagementHttpHostForTests } from "./host-runtime";

export async function handleEngagementMemberSummary(
  req: IncomingMessage,
  res: ServerResponse,
  deps: EngagementRouteDeps,
): Promise<void> {
  const host = getEngagementHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const service = await host.resolveEngagementService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const summary = await service.getMemberSummary(auth);
        host.sendJson(res, 200, summary);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleEngagementMemberPoints(
  req: IncomingMessage,
  res: ServerResponse,
  deps: EngagementRouteDeps,
): Promise<void> {
  const host = getEngagementHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const limit = parseEngagementListLimit(url.searchParams.get("limit"));
    const cursor = parseOptionalListCursor(url.searchParams.get("cursor"));
    const service = await host.resolveEngagementService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const page = await service.getMemberPointHistory(auth, {
          limit,
          ...(cursor !== undefined ? { cursor } : {}),
        });
        host.sendJson(res, 200, page);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleEngagementMemberBadges(
  req: IncomingMessage,
  res: ServerResponse,
  deps: EngagementRouteDeps,
): Promise<void> {
  const host = getEngagementHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const service = await host.resolveEngagementService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const badges = await service.getMemberBadges(auth);
        host.sendJson(res, 200, { badges });
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleEngagementOperatorOverview(
  req: IncomingMessage,
  res: ServerResponse,
  deps: EngagementRouteDeps,
): Promise<void> {
  const host = getEngagementHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const service = await host.resolveEngagementService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const overview = await service.getOperatorOverview(auth);
        host.sendJson(res, 200, overview);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleEngagementOperatorPolicy(
  req: IncomingMessage,
  res: ServerResponse,
  deps: EngagementRouteDeps,
): Promise<void> {
  const host = getEngagementHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const service = await host.resolveEngagementService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const policy = await service.getOperatorPolicy(auth);
        host.sendJson(res, 200, policy);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleEngagementOperatorMemberLookup(
  req: IncomingMessage,
  res: ServerResponse,
  deps: EngagementRouteDeps,
  userId: string,
): Promise<void> {
  const host = getEngagementHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const service = await host.resolveEngagementService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const lookup = await service.getOperatorMemberLookup(auth, userId);
        host.sendJson(res, 200, lookup);
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleEngagementOperatorAdjust(
  req: IncomingMessage,
  res: ServerResponse,
  deps: EngagementRouteDeps,
  userId: string,
): Promise<void> {
  const host = getEngagementHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const idempotencyKey = host.readIdempotencyKey(req);
    if (idempotencyKey === undefined) {
      host.sendJson(res, 400, { code: host.idempotencyKeyRequiredCode });
      return;
    }
    const { parsedBody, rawBody } = await host.readEngagementRequestBody(req);
    const body = parseOperatorAdjustmentBody(parsedBody);
    const requestHash = host.hashIdempotentRequest(req.method ?? "POST", req.url ?? "", rawBody);
    const service = await host.resolveEngagementService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await host.runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          async () =>
            service.adjustMemberPoints(auth, userId, {
              pointsDelta: body.pointsDelta,
              reason: body.reason,
              idempotencyKey,
              ...(body.sourceEntityId !== undefined
                ? { sourceEntityId: body.sourceEntityId }
                : {}),
            }),
        );
        host.sendJson(res, 200, result);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleEngagementOperatorReverse(
  req: IncomingMessage,
  res: ServerResponse,
  deps: EngagementRouteDeps,
  userId: string,
): Promise<void> {
  const host = getEngagementHttpHost();
  try {
    const auth = await host.resolveTenantContextFromRequest(req);
    const idempotencyKey = host.readIdempotencyKey(req);
    if (idempotencyKey === undefined) {
      host.sendJson(res, 400, { code: host.idempotencyKeyRequiredCode });
      return;
    }
    const { parsedBody, rawBody } = await host.readEngagementRequestBody(req);
    const body = parseOperatorReversalBody(parsedBody);
    const requestHash = host.hashIdempotentRequest(req.method ?? "POST", req.url ?? "", rawBody);
    const service = await host.resolveEngagementService(deps, auth);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await host.runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          async () =>
            service.reversePointEvent(auth, userId, {
              originalEventId: body.originalEventId,
              reason: body.reason,
              idempotencyKey,
            }),
        );
        host.sendJson(res, 200, result);
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}
