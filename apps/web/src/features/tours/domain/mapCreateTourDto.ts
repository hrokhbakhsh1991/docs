import type { CreateTourDto } from "@/lib/services/tours.service";

import type { SocialLink } from "../models/tourCreateModel";
import { compactTripDetailsForApi } from "../models/tourTripDetails.schema";
import type { TourTripDetails } from "../models/tourTripDetails.schema";

/**
 * Fields accepted by {@link mapCreateTourDto}.
 * Optional API fields use `Partial` so alternate create entry points (e.g. tour form mappers) stay loose.
 */
export type MapCreateTourDtoInput = Pick<
  CreateTourDto,
  "title" | "capacity" | "price" | "lifecycle_status"
> &
  Partial<
    Pick<
      CreateTourDto,
      | "autoAcceptRegistrations"
      | "durationDays"
      | "meetingPoint"
      | "tripDetails"
      | "tourType"
      | "primaryTransportMode"
    >
  > & {
    description?: string;
    location?: string;
    communicationLink?: string;
    socialLinks?: SocialLink[];
  };

export type CreateTourDtoPrepared = CreateTourDto & {
  /** Prepared for future backend support; currently ignored by API serializer. */
  socialLinks?: SocialLink[];
};

/**
 * Single mapping from domain/UI inputs → {@link CreateTourDto} for `POST /api/v2/tours`.
 * Trimming and optional `description` / `location` behavior must stay aligned across all create flows.
 */
export function mapCreateTourDto(payload: MapCreateTourDtoInput): CreateTourDtoPrepared {
  const primarySocialLink = payload.socialLinks?.[0]?.url?.trim();
  const fallbackCommunicationLink = payload.communicationLink?.trim();
  const communicationLink = primarySocialLink || fallbackCommunicationLink;
  /** Wire-safe `tripDetails` (trimmed strings, filtered arrays, valid `dayPlans`, no `undefined` keys). */
  const tripDetailsCompact = compactTripDetailsForApi(payload.tripDetails) as TourTripDetails | undefined;

  return {
    title: payload.title.trim(),
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
    ...(payload.location?.trim() ? { location: payload.location.trim() } : {}),
    ...(communicationLink ? { communicationLink } : {}),
    autoAcceptRegistrations: payload.autoAcceptRegistrations ?? true,
    ...(payload.tourType ? { tourType: payload.tourType } : {}),
    ...(payload.primaryTransportMode ? { primaryTransportMode: payload.primaryTransportMode } : {}),
    ...(typeof payload.durationDays === "number" && Number.isFinite(payload.durationDays)
      ? { durationDays: payload.durationDays }
      : {}),
    ...(payload.meetingPoint?.trim() ? { meetingPoint: payload.meetingPoint.trim() } : {}),
    ...(tripDetailsCompact ? { tripDetails: tripDetailsCompact } : {}),
    ...(payload.socialLinks && payload.socialLinks.length > 0 ? { socialLinks: payload.socialLinks } : {}),
    capacity: payload.capacity,
    price: payload.price,
    lifecycle_status: payload.lifecycle_status,
  };
}
