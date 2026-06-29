import type { IncomingMessage, ServerResponse } from "node:http";

import { getDenaliCatalogTour, listDenaliCatalog } from "./catalog.service";
import { getDenaliDashboardTour } from "./dashboard.service";
import { getDenaliProductHttpHost } from "./product-host-runtime";
import type { DenaliProductRouteDeps } from "./product-host-ports";
import { createDenaliRegistration } from "./registration.service";
import { listDenaliReminderFeed } from "./reminder-feed.service";
import { resolveDenaliPublicAuth } from "./resolve-denali-public-auth";
import { resolveDenaliRegisteredAuth } from "./resolve-denali-registered-auth";
import { parseDenaliRegistrationPostBody } from "./schemas/denali-registration-post.schema";

function parseCatalogListQuery(url: URL) {
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw === null ? undefined : Number.parseInt(limitRaw, 10);
  return {
    cursor: url.searchParams.get("cursor") ?? undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  };
}

export async function handleGetDenaliCatalog(
  req: IncomingMessage,
  res: ServerResponse,
  deps: DenaliProductRouteDeps = {}
): Promise<void> {
  const host = getDenaliProductHttpHost();
  try {
    const auth = resolveDenaliPublicAuth(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const query = parseCatalogListQuery(url);
    const store = await host.resolveTourStore(deps);
    const bookingPort = host.resolvePublicBookingPort(deps);
    const destinationPort = host.resolvePublicDestinationPort(deps);
    const exposurePort = host.resolveExposureResolverPort(deps);
    const workspaceType = await host.resolveWorkspaceTypeForTenant(auth.tenantId);

    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await listDenaliCatalog({
          tenantId: auth.tenantId,
          workspaceType,
          store,
          bookingPort,
          destinationPort,
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

export async function handleGetDenaliCatalogTour(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
  deps: DenaliProductRouteDeps = {}
): Promise<void> {
  const host = getDenaliProductHttpHost();
  try {
    const auth = resolveDenaliPublicAuth(req);
    const store = await host.resolveTourStore(deps);
    const bookingPort = host.resolvePublicBookingPort(deps);
    const destinationPort = host.resolvePublicDestinationPort(deps);
    const exposurePort = host.resolveExposureResolverPort(deps);
    const workspaceType = await host.resolveWorkspaceTypeForTenant(auth.tenantId);

    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const card = await getDenaliCatalogTour({
          tenantId: auth.tenantId,
          workspaceType,
          store,
          bookingPort,
          destinationPort,
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

export async function handlePostDenaliRegistration(
  req: IncomingMessage,
  res: ServerResponse,
  deps: DenaliProductRouteDeps = {}
): Promise<void> {
  const host = getDenaliProductHttpHost();
  try {
    const auth = resolveDenaliPublicAuth(req);
    const rawBody = await host.readDenaliRegistrationRequestBody(req);
    const body = parseDenaliRegistrationPostBody(rawBody);
    const store = await host.resolveTourStore(deps);
    const bookingPort = host.resolvePublicBookingPort(deps);
    const workspaceType = await host.resolveWorkspaceTypeForTenant(auth.tenantId);

    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const created = await createDenaliRegistration({
          tenantId: auth.tenantId,
          workspaceType,
          guestUserId: auth.userId,
          body,
          store,
          bookingPort,
        });
        host.sendJson(res, 201, { success: true, data: created });
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleGetDenaliDashboardTour(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
  deps: DenaliProductRouteDeps = {},
): Promise<void> {
  const host = getDenaliProductHttpHost();
  try {
    const auth = resolveDenaliRegisteredAuth(req);
    const store = await host.resolveTourStore(deps);
    const destinationPort = host.resolvePublicDestinationPort(deps);
    const exposurePort = host.resolveExposureResolverPort(deps);
    const workspaceType = await host.resolveWorkspaceTypeForTenant(auth.tenantId);

    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const card = await getDenaliDashboardTour({
          tenantId: auth.tenantId,
          workspaceType,
          store,
          destinationPort,
          exposurePort,
          tourId,
        });
        if (card === null) {
          host.sendHttpError(res, 404, { error: "not_found", code: "NOT_FOUND" });
          return;
        }
        host.sendJson(res, 200, { success: true, data: card });
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

function parseReminderFeedLimit(url: URL): number | undefined {
  const limitRaw = url.searchParams.get("limit");
  if (limitRaw === null) {
    return undefined;
  }
  const limit = Number.parseInt(limitRaw, 10);
  return Number.isFinite(limit) ? limit : undefined;
}

export async function handleGetDenaliReminderFeed(
  req: IncomingMessage,
  res: ServerResponse,
  deps: DenaliProductRouteDeps = {},
): Promise<void> {
  const host = getDenaliProductHttpHost();
  try {
    const auth = resolveDenaliRegisteredAuth(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const store = await host.resolveTourStore(deps);
    const exposurePort = host.resolveExposureResolverPort(deps);
    const reminderPort = host.resolveReminderFeedPort(deps);
    const workspaceType = await host.resolveWorkspaceTypeForTenant(auth.tenantId);

    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const items = await listDenaliReminderFeed({
          tenantId: auth.tenantId,
          workspaceType,
          store,
          reminderPort,
          exposurePort,
          limit: parseReminderFeedLimit(url),
        });
        host.sendJson(res, 200, { success: true, data: { items } });
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}
