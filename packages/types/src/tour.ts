/**
 * Mirrors Nest/OpenAPI `TourResponseDto` (`apps/api/openapi.json` components.schemas.TourResponseDto).
 * JSON uses camelCase for response fields (`totalCapacity`, `costContext`, `startDate`, …).
 */
export interface TourResponseDto {
  id: string;
  title: string;
  description?: string | null;
  totalCapacity: number;
  acceptedCount: number;
  costContext?: Record<string, unknown> | null;
  /** ISO-8601 date/time string when present (spec marks nullable object — runtime is serialized instant). */
  startDate?: string | null;
  endDate?: string | null;
}

/** Alias for docs/product vocabulary — identical to `TourResponseDto`. */
export type TourDto = TourResponseDto;

/** Alias — same backend shape as `TourResponseDto`. */
export type Tour = TourResponseDto;

/**
 * Mirrors UpdateTourDto.lifecycle_status enum from OpenAPI (`DRAFT` | `OPEN` | `CLOSED` | `CANCELLED`).
 * GET `/tours/:id` response does not currently expose lifecycle in the spec; mock store carries it for UI parity.
 */
export type TourLifecycleStatus = "DRAFT" | "OPEN" | "CLOSED" | "CANCELLED";
