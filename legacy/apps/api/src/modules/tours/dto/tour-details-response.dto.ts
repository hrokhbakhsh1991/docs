import { ApiPropertyOptional } from "@nestjs/swagger";

import { DifficultyLevel, type TourTripDetails } from "../types/tour-trip-details.types";
import { TourItineraryItemDto } from "./tour-itinerary-item.dto";
import { TourTripDetailsDto } from "./trip-details.dto";

/** Nested tour detail projection on {@link TourResponseDto}. */
export class TourDetailsResponseDto {
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: "Damavand",
  })
  destinationName?: string | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 5671,
  })
  elevationM?: number | null;

  @ApiPropertyOptional({
    enum: DifficultyLevel,
    nullable: true,
    example: DifficultyLevel.HARD,
  })
  difficulty?: DifficultyLevel | null;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    example: 3,
  })
  durationDays?: number | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: "Azadi Square, Gate 3",
  })
  meetingPoint?: string | null;

  @ApiPropertyOptional({
    type: () => TourItineraryItemDto,
    isArray: true,
    nullable: true,
  })
  itinerary?: TourItineraryItemDto[] | null;

  @ApiPropertyOptional({
    type: () => TourTripDetailsDto,
    nullable: true,
    description: "Structured trip details (JSONB). Separate from tour `description`.",
  })
  tripDetails?: TourTripDetails | null;
}
