import type { CreateTourDto } from "@/lib/services/tours.service";

import type { SocialLink } from "../models/tourCreateModel";

/** Fields required to build {@link CreateTourDto}; optional strings omit from payload when empty after trim. */
export type MapCreateTourDtoInput = Pick<
  CreateTourDto,
  "title" | "capacity" | "price" | "lifecycle_status" | "autoAcceptRegistrations"
> & {
  description?: string;
  location?: string;
  communicationLink?: string;
  tourType?: CreateTourDto["tourType"];
  primaryTransportMode?: CreateTourDto["primaryTransportMode"];
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

  return {
    title: payload.title.trim(),
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
    ...(payload.location?.trim() ? { location: payload.location.trim() } : {}),
    ...(communicationLink ? { communicationLink } : {}),
    autoAcceptRegistrations: payload.autoAcceptRegistrations,
    ...(payload.tourType ? { tourType: payload.tourType } : {}),
    ...(payload.primaryTransportMode ? { primaryTransportMode: payload.primaryTransportMode } : {}),
    ...(payload.socialLinks && payload.socialLinks.length > 0 ? { socialLinks: payload.socialLinks } : {}),
    capacity: payload.capacity,
    price: payload.price,
    lifecycle_status: payload.lifecycle_status,
  };
}
