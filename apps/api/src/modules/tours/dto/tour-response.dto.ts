import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import {
  PrimaryTransportMode,
  TourEntity,
  TourLifecycleStatus,
  TourType
} from "../entities/tour.entity";
import { DifficultyLevel, TourItineraryItem } from "../entities/tour-details.entity";

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
    enum: TourType,
    nullable: true,
    example: TourType.CAMP,
    description: "Optional tour classification for specialized UX."
  })
  tourType?: TourType | null;

  @ApiPropertyOptional({
    enum: PrimaryTransportMode,
    nullable: true,
    example: PrimaryTransportMode.BUS,
    description: "Primary transport mode for the tour."
  })
  primaryTransportMode?: PrimaryTransportMode | null;

  @ApiPropertyOptional({
    nullable: true,
    type: "object",
    properties: {
      destinationName: { type: "string", nullable: true, example: "Damavand" },
      elevationM: { type: "number", nullable: true, example: 5671 },
      difficulty: { enum: Object.values(DifficultyLevel), nullable: true, example: DifficultyLevel.HARD },
      durationDays: { type: "number", nullable: true, example: 3 },
      meetingPoint: { type: "string", nullable: true, example: "Azadi Square, Gate 3" },
      requiredGear: {
        type: "array",
        items: { type: "string" },
        nullable: true,
        example: ["Hiking boots", "Headlamp"]
      },
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
      }
    }
  })
  details?: {
    destinationName?: string | null;
    elevationM?: number | null;
    difficulty?: DifficultyLevel | null;
    durationDays?: number | null;
    meetingPoint?: string | null;
    requiredGear?: string[] | null;
    itinerary?: TourItineraryItem[] | null;
  } | null;
}

/** Maps persisted tour row → contract projection (excludes tenant-only / soft-delete fields). */
export function mapTourEntityToResponseDto(tour: TourEntity): TourResponseDto {
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
  dto.primaryTransportMode = tour.primaryTransportMode ?? null;
  dto.details = tour.details
    ? {
        destinationName: tour.details.destinationName ?? null,
        elevationM: tour.details.elevationM ?? null,
        difficulty: tour.details.difficulty ?? null,
        durationDays: tour.details.durationDays ?? null,
        meetingPoint: tour.details.meetingPoint ?? null,
        requiredGear: tour.details.requiredGear ?? null,
        itinerary: tour.details.itinerary ?? null
      }
    : null;
  return dto;
}
