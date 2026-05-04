/**
 * Mirrors backend `tour_lifecycle_status_enum` / OpenAPI `lifecycleStatus` enum.
 */
export type TourLifecycleStatus = "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED";

/**
 * Mirrors Nest/OpenAPI `TourResponseDto` (`apps/api/openapi.json` components.schemas.TourResponseDto).
 * JSON uses camelCase. Tour schedule dates are not part of the MVP contract.
 */
export interface TourResponseDto {
  id: string;
  createdAt: string;
  updatedAt: string;
  title: string;
  description?: string | null;
  totalCapacity: number;
  acceptedCount: number;
  lifecycleStatus: TourLifecycleStatus;
  chatLink?: string | null;
  costContext?: Record<string, unknown> | null;
}

/**
 * Tour row after client normalization (`mapTourResponseToDto`).
 * Includes optional `communicationLink` as an alias of `chatLink` for existing forms/UI.
 */
export type TourDto = TourResponseDto & {
  communicationLink?: string | null;
};

/** Alias — same shape as {@link TourDto} after mapping. */
export type Tour = TourDto;
