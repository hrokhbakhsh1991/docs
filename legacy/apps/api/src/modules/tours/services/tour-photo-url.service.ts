import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { tenantScopedResourceNotFoundError } from "../../../common/errors/error-response-builders";
import { FILE_STORAGE_PORT, type FileStoragePort } from "../../../infra/storage/file-storage.port";
import type { TourTripDetails } from "../types/tour-trip-details.types";
import {
  findTourPhotoInTripDetails,
  TOUR_PHOTO_PRESIGNED_URL_TTL_SECONDS,
  tourPhotoStorageKey,
  type TourGalleryPhotoRef,
} from "../utils/tour-photo-storage.util";

export type TourPhotoPresignedUrlResponse = {
  url: string;
  expiresInSeconds: number;
};

@Injectable()
export class TourPhotoUrlService {
  constructor(@Inject(FILE_STORAGE_PORT) private readonly fileStorage: FileStoragePort) {}

  async resolvePresignedUrl(
    tenantId: string,
    tourId: string,
    photoRef: TourGalleryPhotoRef,
  ): Promise<string | null> {
    const filename = photoRef.filename?.trim();
    if (!filename) {
      return null;
    }
    const key = tourPhotoStorageKey(tenantId, tourId, photoRef.id, filename);
    return this.fileStorage.getSignedUrl(key, TOUR_PHOTO_PRESIGNED_URL_TTL_SECONDS);
  }

  async getPhotoPresignedUrl(
    tenantId: string,
    tourId: string,
    tripDetails: TourTripDetails | null | undefined,
    photoId: string,
  ): Promise<TourPhotoPresignedUrlResponse> {
    const photoRef = findTourPhotoInTripDetails(tripDetails, photoId);
    if (!photoRef?.filename?.trim()) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    const url = await this.resolvePresignedUrl(tenantId, tourId, photoRef);
    if (!url) {
      throw new NotFoundException(tenantScopedResourceNotFoundError());
    }
    return { url, expiresInSeconds: TOUR_PHOTO_PRESIGNED_URL_TTL_SECONDS };
  }

  async enrichTripDetailsForResponse(
    tenantId: string,
    tourId: string,
    tripDetails: TourTripDetails | null | undefined,
  ): Promise<TourTripDetails | null | undefined> {
    if (tripDetails == null) {
      return tripDetails;
    }
    const cloned = JSON.parse(JSON.stringify(tripDetails)) as TourTripDetails;

    const enrichArray = async (photos: TourGalleryPhotoRef[] | undefined) => {
      if (!Array.isArray(photos)) {
        return;
      }
      for (const photo of photos) {
        const url = await this.resolvePresignedUrl(tenantId, tourId, photo);
        if (url) {
          photo.url = url;
        }
      }
    };

    await enrichArray(cloned.photos as TourGalleryPhotoRef[] | undefined);

    if (cloned.itinerary?.dayPlans) {
      for (const day of cloned.itinerary.dayPlans) {
        await enrichArray(day.photos as TourGalleryPhotoRef[] | undefined);
      }
    }

    const segmentDays = (
      cloned.itinerary as { segmentActivities?: Array<{ photos?: TourGalleryPhotoRef[] }> } | undefined
    )?.segmentActivities;
    if (Array.isArray(segmentDays)) {
      for (const day of segmentDays) {
        await enrichArray(day.photos);
      }
    }

    return cloned;
  }
}
