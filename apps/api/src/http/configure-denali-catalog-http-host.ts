import { configureDenaliProductHttpHost } from "@app-tour/workspace-denali/http";
import type {
  DenaliProductRouteDeps,
  DenaliPublicBookingPort,
} from "@app-tour/workspace-denali/http";

import {
  createPublicGuestBooking,
  findGuestBookingDuplicate,
  sumApprovedPartySizeByTourIds,
} from "../bookings/bookings.service";
import type { TourStorageRepository as DbTourStorageRepository } from "../db/tour.repository";
import { handleHttpError, sendHttpError } from "../middleware/error-interceptor";
import { resolveWorkspaceTypeForTenant } from "../tenant/resolve-workspace-type";
import type {
  Tour,
  TourStorageRepository as StorageTourStorageRepository,
} from "../storage/tour-storage.interface";
import { runWithHttpRequestContext } from "./bind-request-context";
import { readJsonBody, sendJson } from "./json";

function resolvePublicBookingPort(deps: DenaliProductRouteDeps): DenaliPublicBookingPort {
  if (deps.publicBookingPort !== undefined) {
    return deps.publicBookingPort;
  }
  return {
    async findDuplicateByTourEmail(tenantId, tourId, email) {
      const duplicate = await findGuestBookingDuplicate(tenantId, tourId, email);
      return duplicate === null ? null : { id: duplicate.id };
    },
    async createPendingBooking(input) {
      const created = await createPublicGuestBooking(
        {
          tenantId: input.tenantId,
          userId: input.guestUserId,
          role: "none",
          status: "ACTIVE",
        },
        {
          tourId: input.tourId,
          tourTitle: input.tourTitle,
          guestLabel: input.guestLabel,
          guestEmail: input.guestEmail,
          guestPhone: input.guestPhone,
          partySize: input.partySize,
          departureAt: input.departureAt,
        }
      );
      return { id: created.id, status: created.status };
    },
    async sumApprovedPartySizeByTourIds(tenantId, tourIds) {
      return sumApprovedPartySizeByTourIds(tenantId, tourIds);
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

configureDenaliProductHttpHost({
  runWithHttpRequestContext,
  sendJson,
  sendHttpError,
  handleHttpError,
  resolveWorkspaceTypeForTenant,
  resolveTourStore,
  readDenaliRegistrationRequestBody: readJsonBody,
  resolvePublicBookingPort,
});
