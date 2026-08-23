/**
 * Platform-neutral product HTTP host wiring (PSR-4b-configure-3b).
 * Branded configure symbols + route-deps types come only from the generated façade —
 * this file must not import workspace package host paths directly.
 */
import {
  configureDenaliProductHttpHost,
  configureHarborHttpHost,
  configureUrbanHttpHost,
  type BookingPublicPort,
  type DenaliProductRouteDeps,
  type DenaliPublicDestinationPort,
  type HarborProductRouteDeps,
  type UrbanHttpHostPorts,
  type UrbanProductRouteDeps,
} from "./workspace-product-http-host-bindings.generated";
import {
  buildDenaliExposureResolverPort,
  buildUrbanExposureResolverPort,
} from "../exposure/workspace-exposure-host-bindings.generated";
import { buildDenaliReminderFeedPort } from "../exposure/denali-reminder-activation.repository";
import { createHostBookingPublicAdapter } from "../bookings/infrastructure/host-booking-public.adapter";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { getSettingsResourcesRepository } from "../settings/create-settings-resources-repository";
import { requireActiveTraceId } from "../observability/trace-request-context";
import { resolveTenantThemeJsonById } from "../tenant/resolve-registered-tenant";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import { isPersistedTenantUuid } from "../tenant/tenant-id-format";
import { isStaticTenantRegistryAllowed } from "../tenant/tenant-registry";
import { setCachedTenantThemeById } from "../tenant/tenant-registry-cache";
import { updateTenantRegistryRow } from "../tenant/update-tenant-registry-row";
import { resolveTenantContextFromRequest } from "../tenant-kernel/tenant-kernel";
import { assertPublicRegistrationThrottle } from "../registrations/public-registration-throttle.ts";
import { decideUrbanRegistrationStatus } from "../registrations/registration-capacity.service.ts";
import { runWithHttpRequestContext } from "./bind-request-context";
import {
  hashIdempotentRequest,
  IDEMPOTENCY_KEY_REQUIRED,
  readIdempotencyKey,
  runIdempotentHttpMutation,
} from "./http-idempotency";
import { parseJsonBody, readJsonBody, readRequestBodyRaw, sendJson } from "./json";
import { resolveProductTourStore } from "./resolve-product-tour-store";

/** Re-export for host AppDeps — type stays behind the generated façade. */
export type { UrbanProductRouteDeps };

function resolvePublicBookingPort(deps: DenaliProductRouteDeps): BookingPublicPort {
  if (deps.publicBookingPort !== undefined) {
    return deps.publicBookingPort;
  }
  return createHostBookingPublicAdapter();
}

function resolvePublicDestinationPort(
  deps: DenaliProductRouteDeps,
): DenaliPublicDestinationPort | undefined {
  if (deps.publicDestinationPort !== undefined) {
    return deps.publicDestinationPort;
  }
  return {
    async getDestinationNamesByIds(tenantId, destinationIds) {
      if (destinationIds.length === 0) {
        return {};
      }
      const wanted = new Set(destinationIds);
      const repo = getSettingsResourcesRepository();
      const destinations = await repo.listDestinations(tenantId);
      const names: Record<string, string> = {};
      for (const destination of destinations) {
        if (destination.isActive === false || !wanted.has(destination.id)) {
          continue;
        }
        const name = destination.name.trim();
        if (name.length > 0) {
          names[destination.id] = name;
        }
      }
      return names;
    },
  };
}

function resolveDenaliExposureResolverPort(deps: DenaliProductRouteDeps) {
  if (deps.exposureResolverPort !== undefined) {
    return deps.exposureResolverPort;
  }
  return buildDenaliExposureResolverPort();
}

function resolveReminderFeedPort(deps: DenaliProductRouteDeps) {
  if (deps.reminderFeedPort !== undefined) {
    return deps.reminderFeedPort;
  }
  return buildDenaliReminderFeedPort();
}

function resolveUrbanExposureResolverPort(deps: UrbanProductRouteDeps) {
  if (deps.exposureResolverPort !== undefined) {
    return deps.exposureResolverPort;
  }
  return buildUrbanExposureResolverPort();
}

async function persistTenantTheme(
  tenantId: string,
  mergedTheme: Record<string, unknown>,
): Promise<void> {
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

configureDenaliProductHttpHost({
  runWithHttpRequestContext,
  sendJson,
  sendHttpError,
  handleHttpError,
  resolveWorkspaceTypeForTenant,
  resolveTourStore: resolveProductTourStore,
  readDenaliRegistrationRequestBody: readJsonBody,
  resolvePublicBookingPort,
  resolvePublicDestinationPort,
  resolveExposureResolverPort: resolveDenaliExposureResolverPort,
  resolveReminderFeedPort,
});

configureHarborHttpHost({
  runWithHttpRequestContext,
  sendJson,
  sendHttpError,
  handleHttpError,
  resolveWorkspaceTypeForTenant,
  resolveTourStore: (deps: HarborProductRouteDeps) => resolveProductTourStore(deps),
  resolvePublicBookingPort: (deps: HarborProductRouteDeps) => {
    if (deps.publicBookingPort !== undefined) {
      return deps.publicBookingPort;
    }
    return createHostBookingPublicAdapter();
  },
  readHarborRegistrationRequestBody: readJsonBody,
});

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
  resolveTourStore: resolveProductTourStore,
  resolveExposureResolverPort: resolveUrbanExposureResolverPort,
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
      )) as UrbanHttpHostPorts["registration"]["runIdempotentHttpMutation"],
    idempotencyKeyRequiredCode: IDEMPOTENCY_KEY_REQUIRED,
    decideRegistrationStatus: decideUrbanRegistrationStatus,
  },
});
