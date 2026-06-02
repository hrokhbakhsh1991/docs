import type { FileStoragePort } from "../../../infra/storage/file-storage.port";
import {
  findTourPhotoInTripDetails,
  tourPhotoStorageKey,
} from "./tour-photo-storage.util";
import type { TourTripDetails } from "../types/tour-trip-details.types";

export type TourPhotoCloneCopyPlan = {
  sourcePhotoId: string;
  destPhotoId: string;
  filename: string;
  sourceKey: string;
  destKey: string;
};

/** Builds storage copy plans for reminted gallery / itinerary photo ids. */
export function buildTourPhotoCloneCopyPlans(input: {
  workspaceId: string;
  sourceTourId: string;
  destTourId: string;
  sourceTripDetails: TourTripDetails | null | undefined;
  photoIdRemap: ReadonlyMap<string, string>;
}): TourPhotoCloneCopyPlan[] {
  const plans: TourPhotoCloneCopyPlan[] = [];
  for (const [sourcePhotoId, destPhotoId] of input.photoIdRemap) {
    const ref = findTourPhotoInTripDetails(input.sourceTripDetails, sourcePhotoId);
    const filename = ref?.filename?.trim();
    if (!filename) {
      continue;
    }
    plans.push({
      sourcePhotoId,
      destPhotoId,
      filename,
      sourceKey: tourPhotoStorageKey(
        input.workspaceId,
        input.sourceTourId,
        sourcePhotoId,
        filename,
      ),
      destKey: tourPhotoStorageKey(input.workspaceId, input.destTourId, destPhotoId, filename),
    });
  }
  return plans;
}

/**
 * @deprecated Use {@link TourClonePendingStorageService.executeCloneCopiesWithSaga} so
 * pending keys are logged in Postgres and orphans are cleaned by the scheduler.
 */
export async function executeTourPhotoCloneCopies(
  fileStorage: FileStoragePort,
  plans: readonly TourPhotoCloneCopyPlan[],
): Promise<void> {
  for (const plan of plans) {
    await fileStorage.copyObject({ sourceKey: plan.sourceKey, destKey: plan.destKey });
  }
}
