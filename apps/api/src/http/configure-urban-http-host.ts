import { configureUrbanHttpHost } from "@app-tour/workspace-urban/http";

import type { TourStorageRepository as DbTourStorageRepository } from "../db/tour.repository";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { requireActiveTraceId } from "../observability/trace-request-context";
import type { TourStorageRepository as StorageTourStorageRepository } from "../storage/tour-storage.interface";
import type { Tour } from "../storage/tour-storage.interface";
import { resolveTenantThemeJsonById } from "../tenant/resolve-registered-tenant";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { isPersistedTenantUuid } from "../tenant/tenant-id-format";
import { isStaticTenantRegistryAllowed } from "../tenant/tenant-registry";
import { setCachedTenantThemeById } from "../tenant/tenant-registry-cache";
import { updateTenantRegistryRow } from "../tenant/update-tenant-registry-row";
import { resolveTenantContextFromRequest } from "../tenant-kernel/tenant-kernel";
import { runWithHttpRequestContext } from "./bind-request-context";
import { parseJsonBody, readJsonBody, readRequestBodyRaw, sendJson } from "./json";
import type { UrbanProductRouteDeps } from "@app-tour/workspace-urban/http";

type StorageLayerTourRepo = StorageTourStorageRepository & {
  createTour(data: { tenantId: string; canonical: Tour["canonical"] }): Promise<Tour>;
  updateIfRowVersion(input: {
    tenantId: string;
    id: string;
    canonical: Tour["canonical"];
    expectedRowVersion: number;
  }): Promise<Tour>;
};

function isStorageLayerTourRepo(
  store: DbTourStorageRepository | StorageTourStorageRepository
): store is StorageLayerTourRepo {
  return typeof (store as StorageTourStorageRepository).listByTenant === "function";
}

async function resolveTourStore(deps: UrbanProductRouteDeps) {
  const [{ TourStorageDbAdapter }, { createTourStorageRepository }] = await Promise.all([
    import("../db/tour-storage.adapter"),
    import("../storage/create-tour-storage"),
  ]);
  if (deps.tourStore !== undefined) {
    const tourStore = deps.tourStore as DbTourStorageRepository | StorageTourStorageRepository;
    if (isStorageLayerTourRepo(tourStore)) {
      return new TourStorageDbAdapter(tourStore);
    }
    return tourStore as DbTourStorageRepository;
  }
  return new TourStorageDbAdapter(createTourStorageRepository());
}

async function persistTenantTheme(tenantId: string, mergedTheme: Record<string, unknown>): Promise<void> {
  const normalized = tenantId.trim().toLowerCase();
  setCachedTenantThemeById(normalized, mergedTheme);
  if (
    process.env.DATABASE_URL?.trim() &&
    isPersistedTenantUuid(normalized) &&
    !isStaticTenantRegistryAllowed()
  ) {
    await updateTenantRegistryRow(normalized, {
      theme: JSON.parse(JSON.stringify(mergedTheme)) as Parameters<
        typeof updateTenantRegistryRow
      >[1]["theme"],
    });
  }
}

configureUrbanHttpHost({
  runWithHttpRequestContext,
  sendJson,
  sendHttpError,
  handleHttpError,
  resolveWorkspaceTypeForTenant,
  resolveTenantContextFromRequest,
  readUrbanSettingsRequestBody: async (req) => {
    const rawBody = await readRequestBodyRaw(req);
    return parseJsonBody(rawBody);
  },
  readUrbanRegistrationRequestBody: readJsonBody,
  resolveTourStore,
  settings: {
    resolveTenantThemeJsonById,
    persistTenantTheme,
    requireActiveTraceId,
  },
});
