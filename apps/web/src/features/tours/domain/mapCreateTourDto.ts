import type { CreateTourDto } from "@/lib/services/tours.service";

/** Fields required to build {@link CreateTourDto}; optional strings omit from payload when empty after trim. */
export type MapCreateTourDtoInput = Pick<
  CreateTourDto,
  "title" | "capacity" | "price" | "lifecycle_status"
> & {
  description?: string;
  location?: string;
  communicationLink?: string;
};

/**
 * Single mapping from domain/UI inputs → {@link CreateTourDto} for `POST /api/v2/tours`.
 * Trimming and optional `description` / `location` behavior must stay aligned across all create flows.
 */
export function mapCreateTourDto(payload: MapCreateTourDtoInput): CreateTourDto {
  return {
    title: payload.title.trim(),
    ...(payload.description?.trim() ? { description: payload.description.trim() } : {}),
    ...(payload.location?.trim() ? { location: payload.location.trim() } : {}),
    ...(payload.communicationLink?.trim() ? { communicationLink: payload.communicationLink.trim() } : {}),
    capacity: payload.capacity,
    price: payload.price,
    lifecycle_status: payload.lifecycle_status,
  };
}
