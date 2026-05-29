import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { normalizeLegacyOverviewTripStyleToTripStyles, type TourFormProfile } from "@repo/types";

import { TourLifecycleStatus } from "@repo/domain-contracts";
import { TOUR_TYPES, type TourType } from "@repo/types";
import type { TourWriteRecord } from "../domain/tour-write-record.types";
import { DifficultyLevel, TourItineraryItem } from "../types/tour-trip-details.types";
import type { TourTripDetails } from "../types/tour-trip-details.types";
import { TOUR_TRANSPORT_MODE_VALUES, type TourTransportMode } from "../tour-transport-modes";

/**
 * GET/POST/PATCH tour projection per `docs/20-architecture/contracts/api_endpoint_contracts_v2_base.md`
 * (camelCase JSON).
 */
export class TourResponseDto {
  @ApiProperty({ example: "22222222-2222-4222-8222-222222222222" })
  id!: string;

  @ApiProperty({
    type: String,
    format: "date-time",
    example: "2026-05-01T08:00:00.000Z",
    description: "Tour row creation time (UTC)."
  })
  createdAt!: Date;

  @ApiProperty({
    type: String,
    format: "date-time",
    example: "2026-05-01T08:05:00.000Z",
    description: "Tour row last update time (UTC)."
  })
  updatedAt!: Date;

  @ApiProperty({ example: "Spring Camp 2026" })
  title!: string;

  @ApiPropertyOptional({
    type: String,
    example: "A two-day nature tour for members.",
    nullable: true,
    description: "Optional long-form description."
  })
  description?: string | null;

  @ApiProperty({ example: 30, description: "Maximum capacity for the tour." })
  totalCapacity!: number;

  @ApiProperty({ example: 10, description: "Number of accepted registrations (capacity consumption)." })
  acceptedCount!: number;

  @ApiProperty({
    enum: TourLifecycleStatus,
    example: TourLifecycleStatus.OPEN,
    description: "Tour lifecycle state."
  })
  lifecycleStatus!: TourLifecycleStatus;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: "https://t.me/joinchat/example",
    description: "Leader-managed communication link (e.g. Telegram)."
  })
  chatLink?: string | null;

  @ApiPropertyOptional({
    example: { currency: "USD", totalCost: 1200 },
    nullable: true,
    type: "object",
    additionalProperties: true,
    description: "Opaque pricing / operational JSON (JSONB)."
  })
  costContext?: Record<string, unknown> | null;

  @ApiPropertyOptional({
    type: Boolean,
    nullable: true,
    example: true,
    description: "When false, registrations are not auto-accepted by tour policy."
  })
  autoAcceptRegistrations?: boolean | null;

  @ApiPropertyOptional({
    enum: [...TOUR_TYPES],
    nullable: true,
    example: TOUR_TYPES[0],
    description:
      "Top-level **category** (mountain, city, desert, nature, cultural). Execution-style selections live in `tripDetails.overview.tripStyles`."
  })
  tourType?: TourType | null;

  @ApiProperty({
    type: [String],
    enum: [...TOUR_TRANSPORT_MODE_VALUES],
    isArray: true,
    example: ["bus", "train"],
    description:
      "Organized transport modes for this tour (multi-select). Empty when unset. No `mixed` slug."
  })
  transportModes!: TourTransportMode[];

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      "Resolved form profile at creation (`general`, `urban_event`, …); optional frozen snapshot on the row.",
  })
  formProfileSnapshot?: TourFormProfile | null;

  @ApiPropertyOptional({
    format: "uuid",
    nullable: true,
    description: "FK to workspace_destinations when the tour is linked to a Settings destination."
  })
  destinationId?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: "Damavand",
    description: "Destination display name (from Settings) when `destinationId` is set."
  })
  destinationName?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: "Mazandaran",
    description: "Region name for the linked destination, for list/detail UI."
  })
  destinationRegionName?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    type: "object",
    properties: {
      destinationName: { type: "string", nullable: true, example: "Damavand" },
      elevationM: { type: "number", nullable: true, example: 5671 },
      difficulty: { enum: Object.values(DifficultyLevel), nullable: true, example: DifficultyLevel.HARD },
      durationDays: { type: "number", nullable: true, example: 3 },
      meetingPoint: { type: "string", nullable: true, example: "Azadi Square, Gate 3" },
      itinerary: {
        type: "array",
        nullable: true,
        items: {
          type: "object",
          properties: {
            day: { type: "number", example: 1 },
            title: { type: "string", nullable: true, example: "Approach" },
            description: { type: "string", nullable: true, example: "Transfer to base camp." },
            distanceKm: { type: "number", nullable: true, example: 8 },
            elevationGainM: { type: "number", nullable: true, example: 450 }
          }
        }
      },
      tripDetails: {
        type: "object",
        nullable: true,
        additionalProperties: true,
        description: "Structured trip details (JSONB). Separate from tour `description`."
      }
    }
  })
  details?: {
    destinationName?: string | null;
    elevationM?: number | null;
    difficulty?: DifficultyLevel | null;
    durationDays?: number | null;
    meetingPoint?: string | null;
    itinerary?: TourItineraryItem[] | null;
    tripDetails?: TourTripDetails | null;
  } | null;
}

/** Tour row shape required for {@link mapTourEntityToResponseDto} (entity or write port record). */
export type TourResponseSource = TourWriteRecord & {
  createdAt: Date;
  updatedAt: Date;
};

/** Maps persisted tour row → contract projection (excludes tenant-only / soft-delete fields). */
export function mapTourEntityToResponseDto(tour: TourResponseSource): TourResponseDto {
  const dto = new TourResponseDto();
  dto.id = tour.id;
  dto.createdAt = tour.createdAt;
  dto.updatedAt = tour.updatedAt;
  dto.title = tour.title;
  dto.description = tour.description ?? null;
  dto.totalCapacity = tour.totalCapacity;
  dto.acceptedCount = tour.acceptedCount;
  dto.lifecycleStatus = tour.lifecycleStatus;
  dto.chatLink = tour.chatLink ?? null;
  dto.costContext = tour.costContext ?? null;
  dto.autoAcceptRegistrations = tour.autoAcceptRegistrations ?? null;
  dto.tourType = tour.tourType ?? null;
  dto.transportModes = Array.isArray(tour.transportModes) ? [...tour.transportModes] : [];
  dto.formProfileSnapshot = tour.formProfileSnapshot ?? null;
  dto.destinationId = tour.destination?.id ?? null;
  dto.destinationName = tour.destination?.name ?? null;
  dto.destinationRegionName = tour.destination?.region?.name ?? null;
  let tripDetailsOut: TourTripDetails | null = tour.details?.tripDetails ?? null;
  if (tripDetailsOut != null) {
    const cloned = JSON.parse(JSON.stringify(tripDetailsOut)) as Record<string, unknown>;
    normalizeLegacyOverviewTripStyleToTripStyles(cloned);
    tripDetailsOut = cloned as TourTripDetails;
  }

  dto.details = tour.details
    ? {
        destinationName: tour.details.destinationName ?? null,
        elevationM: tour.details.elevationM ?? null,
        difficulty: tour.details.difficulty ?? null,
        durationDays: tour.details.durationDays ?? null,
        meetingPoint: tour.details.meetingPoint ?? null,
        itinerary: tour.details.itinerary ?? null,
        tripDetails: tripDetailsOut
      }
    : null;
  return dto;
}
