import type { IncomingMessage, ServerResponse } from "node:http";

import { listUrbanCatalog, getUrbanCatalogTour } from "./catalog.service";
import { getUrbanHttpHost } from "./host-runtime";
import type { UrbanProductRouteDeps } from "./host-ports";
import { resolveUrbanPublicAuth } from "./resolve-urban-public-auth";
import { parseUrbanRegistrationPostBody } from "./schemas/urban-registration-post.schema";
import { createUrbanRegistration } from "./registration.service";
import { readUrbanRegistrationPolicyForTenant } from "./settings.service";

function parseCatalogListQuery(url: URL) {
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw === null ? undefined : Number.parseInt(limitRaw, 10);
  return {
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
    city: url.searchParams.get("city") ?? undefined,
  };
}

export async function handleGetUrbanCatalog(
  req: IncomingMessage,
  res: ServerResponse,
  deps: UrbanProductRouteDeps = {}
): Promise<void> {
  const host = getUrbanHttpHost();
  try {
    const auth = resolveUrbanPublicAuth(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const query = parseCatalogListQuery(url);
    const store = await host.resolveTourStore(deps);
    const exposurePort = host.resolveExposureResolverPort(deps);
    const workspaceType = await host.resolveWorkspaceTypeForTenant(auth.tenantId);

    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await listUrbanCatalog({
          tenantId: auth.tenantId,
          workspaceType,
          store,
          exposurePort,
          ...query,
        });
        host.sendJson(res, 200, {
          success: true,
          data: { items: result.items },
          metadata: { nextCursor: result.nextCursor },
        });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleGetUrbanCatalogTour(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
  deps: UrbanProductRouteDeps = {}
): Promise<void> {
  const host = getUrbanHttpHost();
  try {
    const auth = resolveUrbanPublicAuth(req);
    const store = await host.resolveTourStore(deps);
    const exposurePort = host.resolveExposureResolverPort(deps);
    const workspaceType = await host.resolveWorkspaceTypeForTenant(auth.tenantId);

    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const card = await getUrbanCatalogTour({
          tenantId: auth.tenantId,
          workspaceType,
          store,
          exposurePort,
          tourId,
        });
        if (card === null) {
          host.sendHttpError(res, 404, { error: "not_found", code: "NOT_FOUND" });
          return;
        }
        host.sendJson(res, 200, { success: true, data: card });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handlePostUrbanRegistration(
  req: IncomingMessage,
  res: ServerResponse,
  deps: UrbanProductRouteDeps = {}
): Promise<void> {
  const host = getUrbanHttpHost();
  try {
    const auth = resolveUrbanPublicAuth(req);
    await host.registration.assertPublicRegistrationThrottle(
      req.headers["x-forwarded-for"]?.toString() ?? req.socket.remoteAddress ?? undefined
    );
    const idempotencyKey = host.registration.readIdempotencyKey(req);
    if (idempotencyKey === undefined) {
      host.sendHttpError(res, 400, {
        error: host.registration.idempotencyKeyRequiredCode,
        code: host.registration.idempotencyKeyRequiredCode,
      });
      return;
    }
    const rawBody = await host.readUrbanRegistrationRequestBody(req);
    const body = parseUrbanRegistrationPostBody(rawBody);
    const store = await host.resolveTourStore(deps);
    const workspaceType = await host.resolveWorkspaceTypeForTenant(auth.tenantId);
    const registrationPolicy = await readUrbanRegistrationPolicyForTenant(auth.tenantId);
    const requestHash = host.registration.hashIdempotentRequest(
      req.method ?? "POST",
      "/urban/registrations",
      typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody)
    );

    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const responseBody = await host.registration.runIdempotentHttpMutation(
          auth.tenantId,
          idempotencyKey,
          requestHash,
          async () => {
            const created = await createUrbanRegistration({
              tenantId: auth.tenantId,
              workspaceType,
              body,
              store,
              registrationPolicy,
            });
            return { success: true as const, data: created };
          }
        );
        host.sendJson(res, 201, responseBody);
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}
