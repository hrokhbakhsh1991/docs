import type { IncomingMessage, ServerResponse } from "node:http";

import {
  buildWorkspaceCatalogListSuccessBody,
  buildWorkspaceSuccessDataBody,
  createWorkspaceGuestSmokeHttpHandlers,
  parseWorkspaceCatalogCursorLimitQuery,
  resolveWorkspacePublicAuthFromRequest,
  sendWorkspaceGuestStub,
  sendWorkspaceJson,
  sendWorkspaceNotFound,
  type WorkspaceGuestSmokeCatalogPort,
} from "@app-tour/workspace-sdk";

import {
  buildHarborSmokeCatalogCard,
  HARBOR_SMOKE_PUBLISHED_TOUR_ID,
  type HarborSmokeCatalogCard,
} from "../catalog/harbor-smoke-catalog.fixture";
import { getHarborSmokeCatalogStore } from "../catalog/harbor-smoke-catalog.store";
import {
  isHarborTourPublished,
  toHarborCatalogCard,
} from "../catalog/to-harbor-catalog-card";
import { createHarborRegistration } from "../registration/create-harbor-registration";
import type { HarborProductRouteDeps } from "./host-ports";
import { tryGetHarborHttpHost } from "./host-runtime";

function isHarborSmokeSeedEnabled(): boolean {
  return process.env.HARBOR_SMOKE_E2E_SEED === "1";
}

function filterHarborSmokeCardsByCity(
  items: readonly HarborSmokeCatalogCard[],
  url: URL,
): readonly HarborSmokeCatalogCard[] {
  const city = url.searchParams.get("city") ?? undefined;
  if (city === undefined || city.trim().length === 0) {
    return items;
  }
  const needle = city.trim().toLowerCase();
  return items.filter((card) => card.city.toLowerCase() === needle);
}

/** Resolve store per call so test resets replace the singleton safely. */
const harborCatalogPort: WorkspaceGuestSmokeCatalogPort<HarborSmokeCatalogCard> = {
  listPublished: () => getHarborSmokeCatalogStore().listPublished(),
  getPublished: (tourId) => getHarborSmokeCatalogStore().getPublished(tourId),
  createRegistration: (input) => getHarborSmokeCatalogStore().createRegistration(input),
};

const smokeHandlers = createWorkspaceGuestSmokeHttpHandlers({
  isSeedEnabled: isHarborSmokeSeedEnabled,
  publishedTourId: HARBOR_SMOKE_PUBLISHED_TOUR_ID,
  buildCard: buildHarborSmokeCatalogCard,
  catalogPort: harborCatalogPort,
  filterListItems: filterHarborSmokeCardsByCity,
  applyListLimit: true,
});

const DURABLE_LIST_LIMIT_CAP = 100;

async function listDurableHarborCatalog(
  req: IncomingMessage,
  res: ServerResponse,
  deps: HarborProductRouteDeps,
): Promise<void> {
  const host = tryGetHarborHttpHost();
  if (host === null) {
    sendWorkspaceGuestStub(res);
    return;
  }
  try {
    const auth = resolveWorkspacePublicAuthFromRequest(req);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const url = new URL(req.url ?? "/", "http://127.0.0.1");
        const store = await host.resolveTourStore(deps);
        const page = await store.listPage(
          { tenantId: auth.tenantId },
          { limit: DURABLE_LIST_LIMIT_CAP },
        );
        const cards = page.items
          .filter((tour) => isHarborTourPublished(tour.canonical))
          .map((tour) =>
            toHarborCatalogCard({
              id: tour.id,
              canonical: tour.canonical,
              catalogUpdatedAt: tour.createdAt,
            }),
          );
        const filtered = filterHarborSmokeCardsByCity(cards, url);
        const { limit } = parseWorkspaceCatalogCursorLimitQuery(url);
        const items =
          typeof limit === "number"
            ? filtered.slice(0, Math.max(limit, 0))
            : filtered;
        host.sendJson(
          res,
          200,
          buildWorkspaceCatalogListSuccessBody({ items, nextCursor: null }),
        );
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

async function getDurableHarborCatalogTour(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
  deps: HarborProductRouteDeps,
): Promise<void> {
  const host = tryGetHarborHttpHost();
  if (host === null) {
    sendWorkspaceGuestStub(res);
    return;
  }
  try {
    const auth = resolveWorkspacePublicAuthFromRequest(req);
    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const store = await host.resolveTourStore(deps);
        const tour = await store.findFirst({
          tenantId: auth.tenantId,
          id: tourId.trim(),
        });
        if (tour === null || !isHarborTourPublished(tour.canonical)) {
          sendWorkspaceNotFound(res);
          return;
        }
        const card = toHarborCatalogCard({
          id: tour.id,
          canonical: tour.canonical,
          catalogUpdatedAt: tour.createdAt,
        });
        host.sendJson(res, 200, buildWorkspaceSuccessDataBody(card));
      },
      { rateLimit: "read" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

/** Seed path for e2e; durable BookingPublicPort path when host configured. */
export async function handlePostHarborRegistration(
  req: IncomingMessage,
  res: ServerResponse,
  deps: HarborProductRouteDeps = {},
): Promise<void> {
  if (isHarborSmokeSeedEnabled()) {
    return smokeHandlers.handleRegister(req, res);
  }
  return postDurableHarborRegistration(req, res, deps);
}

async function postDurableHarborRegistration(
  req: IncomingMessage,
  res: ServerResponse,
  deps: HarborProductRouteDeps,
): Promise<void> {
  const host = tryGetHarborHttpHost();
  if (host === null) {
    sendWorkspaceGuestStub(res);
    return;
  }
  try {
    const auth = resolveWorkspacePublicAuthFromRequest(req);
    const raw = (await host.readHarborRegistrationRequestBody(req)) as {
      tourId?: unknown;
      contact?: { fullName?: unknown; email?: unknown; phone?: unknown };
      partySize?: unknown;
      notes?: unknown;
    };
    const tourId = typeof raw.tourId === "string" ? raw.tourId.trim() : "";
    const fullName =
      typeof raw.contact?.fullName === "string" ? raw.contact.fullName.trim() : "";
    const email =
      typeof raw.contact?.email === "string" ? raw.contact.email.trim() : "";
    const phone =
      typeof raw.contact?.phone === "string" ? raw.contact.phone.trim() : undefined;
    const notes = typeof raw.notes === "string" ? raw.notes.trim() : undefined;
    const partySize =
      typeof raw.partySize === "number"
        ? raw.partySize
        : Number.parseInt(String(raw.partySize ?? ""), 10);

    if (
      tourId.length === 0 ||
      fullName.length === 0 ||
      email.length === 0 ||
      !Number.isFinite(partySize) ||
      partySize < 1
    ) {
      sendWorkspaceJson(res, 400, { success: false, code: "INVALID_PAYLOAD" });
      return;
    }

    await host.runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const store = await host.resolveTourStore(deps);
        const bookingPort = host.resolvePublicBookingPort(deps);
        const workspaceType = await host.resolveWorkspaceTypeForTenant(
          auth.tenantId,
        );
        const created = await createHarborRegistration({
          tenantId: auth.tenantId,
          workspaceType,
          guestUserId: auth.userId,
          body: {
            tourId,
            contact: {
              fullName,
              email,
              ...(phone !== undefined && phone.length > 0 ? { phone } : {}),
            },
            partySize,
            ...(notes !== undefined && notes.length > 0 ? { notes } : {}),
          },
          store,
          bookingPort,
        });
        host.sendJson(res, 201, buildWorkspaceSuccessDataBody(created));
      },
      { rateLimit: "write" },
    );
  } catch (error) {
    host.handleHttpError(res, error);
  }
}

export async function handleGetHarborCatalog(
  req: IncomingMessage,
  res: ServerResponse,
  deps: HarborProductRouteDeps = {},
): Promise<void> {
  if (isHarborSmokeSeedEnabled()) {
    return smokeHandlers.handleList(req, res);
  }
  return listDurableHarborCatalog(req, res, deps);
}

export async function handleGetHarborCatalogTour(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
  deps: HarborProductRouteDeps = {},
): Promise<void> {
  if (isHarborSmokeSeedEnabled()) {
    return smokeHandlers.handleDetail(req, res, tourId);
  }
  return getDurableHarborCatalogTour(req, res, tourId, deps);
}
