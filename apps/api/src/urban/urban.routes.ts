import type { IncomingMessage, ServerResponse } from "node:http";

import type { TourStorageRepository as DbTourStorageRepository } from "../db/tour.repository";
import type {
  Tour,
  TourStorageRepository as StorageTourStorageRepository,
} from "../storage/tour-storage.interface";
import { runWithHttpRequestContext } from "../http/bind-request-context";
import { sendJson } from "../http/json";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { listUrbanCatalog, getUrbanCatalogTour } from "./urban-catalog.service";
import { resolveUrbanPublicAuth } from "./resolve-urban-public-auth";
import { readUrbanRegistrationRequestBody } from "./read-urban-registration-request-body";
import { parseUrbanRegistrationPostBody } from "./schemas/urban-registration-post.schema";
import { createUrbanRegistration } from "./urban-registration.service";

type StorageLayerTourRepo = StorageTourStorageRepository & {
  createTour(data: { tenantId: string; canonical: Tour["canonical"] }): Promise<Tour>;
  updateIfRowVersion(input: {
    tenantId: string;
    id: string;
    canonical: Tour["canonical"];
    expectedRowVersion: number;
  }): Promise<Tour>;
};

export type UrbanProductRouteDeps = {
  readonly tourStore?: DbTourStorageRepository | StorageTourStorageRepository;
};

function isStorageLayerTourRepo(
  store: DbTourStorageRepository | StorageTourStorageRepository
): store is StorageLayerTourRepo {
  return typeof (store as StorageTourStorageRepository).listByTenant === "function";
}

async function resolveTourStore(deps: UrbanProductRouteDeps): Promise<DbTourStorageRepository> {
  const [{ TourStorageDbAdapter }, { createTourStorageRepository }] = await Promise.all([
    import("../db/tour-storage.adapter"),
    import("../storage/create-tour-storage"),
  ]);
  if (deps.tourStore !== undefined) {
    if (isStorageLayerTourRepo(deps.tourStore)) {
      return new TourStorageDbAdapter(deps.tourStore);
    }
    return deps.tourStore as DbTourStorageRepository;
  }
  return new TourStorageDbAdapter(createTourStorageRepository());
}

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
  try {
    const auth = resolveUrbanPublicAuth(req);
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const query = parseCatalogListQuery(url);
    const store = await resolveTourStore(deps);
    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const result = await listUrbanCatalog({
          tenantId: auth.tenantId,
          workspaceType,
          store,
          ...query,
        });
        sendJson(res, 200, {
          success: true,
          data: { items: result.items },
          metadata: { nextCursor: result.nextCursor },
        });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handleGetUrbanCatalogTour(
  req: IncomingMessage,
  res: ServerResponse,
  tourId: string,
  deps: UrbanProductRouteDeps = {}
): Promise<void> {
  try {
    const auth = resolveUrbanPublicAuth(req);
    const store = await resolveTourStore(deps);
    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const card = await getUrbanCatalogTour({
          tenantId: auth.tenantId,
          workspaceType,
          store,
          tourId,
        });
        if (card === null) {
          sendHttpError(res, 404, { error: "not_found", code: "NOT_FOUND" });
          return;
        }
        sendJson(res, 200, { success: true, data: card });
      },
      { rateLimit: "read" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}

export async function handlePostUrbanRegistration(
  req: IncomingMessage,
  res: ServerResponse,
  deps: UrbanProductRouteDeps = {}
): Promise<void> {
  try {
    const auth = resolveUrbanPublicAuth(req);
    const rawBody = await readUrbanRegistrationRequestBody(req);
    const body = parseUrbanRegistrationPostBody(rawBody);
    const store = await resolveTourStore(deps);
    const workspaceType = await resolveWorkspaceTypeForTenant(auth.tenantId);

    await runWithHttpRequestContext(
      req,
      auth,
      async () => {
        const created = await createUrbanRegistration({
          tenantId: auth.tenantId,
          workspaceType,
          body,
          store,
        });
        sendJson(res, 201, { success: true, data: created });
      },
      { rateLimit: "write" }
    );
  } catch (error) {
    handleHttpError(res, error);
  }
}
