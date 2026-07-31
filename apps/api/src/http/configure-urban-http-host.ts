import { configureUrbanHttpHost } from "@app-tour/workspace-urban/host/http";
import type { UrbanProductRouteDeps } from "@app-tour/workspace-urban/host/http";
import type { CanonicalDocument, TenantAuthContext } from "@app-tour/workspace-sdk";
import {
  mapUrbanExposureSurfaceToFieldPolicySurface,
  resolveUrbanSurfaceDefaultFieldIds,
  type UrbanExposureCoordinate,
} from "@app-tour/workspace-urban/exposure";

/** Re-export for host AppDeps — keeps branded type import inside product-adapter. */
export type { UrbanProductRouteDeps };

import { buildFieldExposureEngineDecisionMap } from "../exposure/build-field-exposure-engine-input";
import { resolveSeededExposureProfile } from "../exposure/exposure-profile";
import { createExposureIntentRepository } from "../exposure/prisma-exposure-intent.repository";
import { resolvePersistedExposureProfileForContext } from "../exposure/resolve-persisted-exposure-profile";
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
import {
  hashIdempotentRequest,
  IDEMPOTENCY_KEY_REQUIRED,
  readIdempotencyKey,
  runIdempotentHttpMutation,
} from "./http-idempotency";
import { assertPublicRegistrationThrottle } from "../registrations/public-registration-throttle.ts";
import {
  assertRegistrationCapacityDecision,
  resolveRegistrationCapacityDecision,
} from "../registrations/registration-capacity.service.ts";

// --- Urban surface exposure (folded from configure-urban-surface-exposure; PSR-4b-configure-2) ---

export type ResolveUrbanSurfaceExposureInput = {
  readonly tenantId: string;
  readonly workspaceType: string;
  readonly tourId: string;
  readonly canonical: CanonicalDocument;
  readonly coordinate: UrbanExposureCoordinate;
};

function canonicalPayload(canonical: CanonicalDocument): Readonly<Record<string, unknown>> {
  const data = canonical.data;
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    return data as Readonly<Record<string, unknown>>;
  }
  return {};
}

function resolveUrbanSurfaceExposureProfile(input: {
  readonly workspaceType: string;
  readonly coordinate: UrbanExposureCoordinate;
}) {
  const defaultFieldIds = resolveUrbanSurfaceDefaultFieldIds({
    surface: input.coordinate.surface,
  });

  return resolveSeededExposureProfile({
    workspaceType: input.workspaceType,
    entityType: "tour",
    surface: input.coordinate.surface,
    audience: input.coordinate.audience,
    trigger: "always",
    defaultFieldIds,
  });
}

async function tryResolvePersistedExposureProfile(input: {
  readonly tenantId: string;
  readonly context: {
    readonly workspaceType: string;
    readonly entityType: string;
    readonly surface: string;
    readonly audience: string;
    readonly trigger: string;
  };
}) {
  try {
    return await resolvePersistedExposureProfileForContext(input);
  } catch {
    return null;
  }
}

async function tryFindExposureIntent(input: {
  readonly tenantId: string;
  readonly profileId: string;
  readonly surface: string;
  readonly audience: string;
  readonly trigger: string;
  readonly scope: { readonly tourSurface: string };
}) {
  try {
    return await createExposureIntentRepository().findForContext(input);
  } catch {
    return null;
  }
}

export async function resolveUrbanSurfaceVisibleFieldIds(
  auth: TenantAuthContext,
  input: ResolveUrbanSurfaceExposureInput,
): Promise<readonly string[]> {
  const payload = canonicalPayload(input.canonical);
  const seededProfile = resolveUrbanSurfaceExposureProfile({
    workspaceType: input.workspaceType,
    coordinate: input.coordinate,
  });
  const persistedProfile =
    seededProfile === null
      ? null
      : await tryResolvePersistedExposureProfile({
          tenantId: auth.tenantId,
          context: {
            workspaceType: input.workspaceType,
            entityType: seededProfile.entityType,
            surface: seededProfile.surface,
            audience: seededProfile.audience,
            trigger: seededProfile.trigger,
          },
        });
  const profile = persistedProfile ?? seededProfile;

  const nativeIntent =
    profile === null
      ? null
      : await tryFindExposureIntent({
          tenantId: auth.tenantId,
          profileId: profile.id,
          surface: input.coordinate.surface,
          audience: input.coordinate.audience,
          trigger: "always",
          scope: { tourSurface: input.coordinate.surface },
        });

  const decisionMap = await buildFieldExposureEngineDecisionMap({
    tenantId: auth.tenantId,
    workspaceType: input.workspaceType,
    eventType: "TourPublished",
    surface: input.coordinate.surface,
    fieldPolicySurface: mapUrbanExposureSurfaceToFieldPolicySurface(input.coordinate.surface),
    audience: input.coordinate.audience,
    normalizedTrigger: input.coordinate.trigger,
    payload,
    exposureIntent: nativeIntent,
    exposureProfile: profile,
  });

  return [...decisionMap.entries()]
    .filter(([, decision]) => decision.state === "visible")
    .map(([fieldId]) => fieldId)
    .sort((left, right) => left.localeCompare(right));
}

export function buildUrbanExposureResolverPort(): {
  resolveVisibleFieldIds(input: {
    readonly tenantId: string;
    readonly tourId: string;
    readonly canonical: CanonicalDocument;
    readonly coordinate: UrbanExposureCoordinate;
  }): Promise<readonly string[]>;
} {
  return {
    async resolveVisibleFieldIds(input) {
      return resolveUrbanSurfaceVisibleFieldIds(
        {
          tenantId: input.tenantId,
          userId: "urban-exposure-resolver",
          role: "none",
          status: "ACTIVE",
        },
        {
          tenantId: input.tenantId,
          workspaceType: "urban",
          tourId: input.tourId,
          canonical: input.canonical,
          coordinate: input.coordinate,
        },
      );
    },
  };
}

// --- Urban HTTP host wiring ---

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

function resolveExposureResolverPort(deps: UrbanProductRouteDeps) {
  if (deps.exposureResolverPort !== undefined) {
    return deps.exposureResolverPort;
  }
  return buildUrbanExposureResolverPort();
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
  resolveExposureResolverPort,
  settings: {
    resolveTenantThemeJsonById,
    persistTenantTheme,
    requireActiveTraceId,
  },
  registration: {
    assertPublicRegistrationThrottle,
    readIdempotencyKey,
    hashIdempotentRequest,
    runIdempotentHttpMutation: ((tenantId, idempotencyKey, requestHash, finish) =>
      runIdempotentHttpMutation(
        tenantId,
        idempotencyKey,
        requestHash,
        finish as () => Promise<Record<string, unknown>>,
      )) as import("@app-tour/workspace-urban/host/http").UrbanHttpHostPorts["registration"]["runIdempotentHttpMutation"],
    idempotencyKeyRequiredCode: IDEMPOTENCY_KEY_REQUIRED,
    decideRegistrationStatus: (input) =>
      assertRegistrationCapacityDecision(resolveRegistrationCapacityDecision(input)),
  },
});
