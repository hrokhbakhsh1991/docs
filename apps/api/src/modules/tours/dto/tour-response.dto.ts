import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { TourEntity, TourLifecycleStatus } from "../entities/tour.entity";

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
  return dto;
}
