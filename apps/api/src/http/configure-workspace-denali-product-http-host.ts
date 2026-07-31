import { configureDenaliProductHttpHost } from "@app-tour/workspace-denali/host/http";
import { buildDenaliExposureResolverPort } from "../exposure/resolve-denali-surface-exposure";
import { buildDenaliReminderFeedPort } from "../exposure/denali-reminder-activation.repository";
import type {
  DenaliProductRouteDeps,
  BookingPublicPort,
  DenaliPublicDestinationPort,
} from "@app-tour/workspace-denali/host/http";

import { createHostBookingPublicAdapter } from "../bookings/infrastructure/host-booking-public.adapter";
import type { TourStorageRepository as DbTourStorageRepository } from "../db/tour.repository";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { getSettingsResourcesRepository } from "../settings/create-settings-resources-repository";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import type {
  Tour,
  TourStorageRepository as StorageTourStorageRepository,
} from "../storage/tour-storage.interface";
import { runWithHttpRequestContext } from "./bind-request-context";
import { readJsonBody, sendJson } from "./json";

function resolvePublicBookingPort(deps: DenaliProductRouteDeps): BookingPublicPort {
  if (deps.publicBookingPort !== undefined) {
    return deps.publicBookingPort;
  }
  return createHostBookingPublicAdapter();
}

function resolvePublicDestinationPort(
  deps: DenaliProductRouteDeps
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

async function resolveTourStore(deps: DenaliProductRouteDeps) {
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

function resolveExposureResolverPort(deps: DenaliProductRouteDeps) {
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

configureDenaliProductHttpHost({
  runWithHttpRequestContext,
  sendJson,
  sendHttpError,
  handleHttpError,
  resolveWorkspaceTypeForTenant,
  resolveTourStore,
  readDenaliRegistrationRequestBody: readJsonBody,
  resolvePublicBookingPort,
  resolvePublicDestinationPort,
  resolveExposureResolverPort,
  resolveReminderFeedPort,
});
