import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested
} from "class-validator";
import { PrimaryTransportMode, TourLifecycleStatus, TourType } from "../entities/tour.entity";
import { DifficultyLevel, TourItineraryItem } from "../entities/tour-details.entity";
import { TourTripDetailsDto } from "./trip-details.dto";

export class UpdateTourDto {
  @ApiPropertyOptional({
    example: "Spring Camp 2026 - Updated"
  })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    example: 40,
    minimum: 0
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  total_capacity?: number;

  @ApiPropertyOptional({
    example: "OPEN",
    enum: ["DRAFT", "OPEN", "CLOSED", "CANCELLED"]
  })
  @IsOptional()
  @IsIn([
    TourLifecycleStatus.DRAFT,
    TourLifecycleStatus.OPEN,
    TourLifecycleStatus.CLOSED,
    TourLifecycleStatus.CANCELLED
  ])
  lifecycle_status?:
    | TourLifecycleStatus.DRAFT
    | TourLifecycleStatus.OPEN
    | TourLifecycleStatus.CLOSED
    | TourLifecycleStatus.CANCELLED;

  @ApiPropertyOptional({
    example: "Updated description"
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: "https://t.me/joinchat/updated"
  })
  @IsOptional()
  @IsString()
  chat_link?: string;

  @ApiPropertyOptional({
    example: { currency: "USD", discount: 10 }
  })
  @IsOptional()
  @IsObject()
  cost_context?: Record<string, unknown>;

  @ApiPropertyOptional({
    example: true
  })
  @IsOptional()
  @IsBoolean()
  autoAcceptRegistrations?: boolean;

  @ApiPropertyOptional({
    enum: TourType,
    example: TourType.CAMP
  })
  @IsOptional()
  @IsEnum(TourType)
  tourType?: TourType;

  @ApiPropertyOptional({
    enum: PrimaryTransportMode,
    example: PrimaryTransportMode.BUS
  })
  @IsOptional()
  @IsEnum(PrimaryTransportMode)
  primaryTransportMode?: PrimaryTransportMode;

  @ApiPropertyOptional({ example: "Damavand" })
  @IsOptional()
  @IsString()
  destinationName?: string;

  @ApiPropertyOptional({ example: 5671 })
  @IsOptional()
  @IsInt()
  elevationM?: number;

  @ApiPropertyOptional({ enum: DifficultyLevel, example: DifficultyLevel.MODERATE })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficulty?: DifficultyLevel;

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  durationDays?: number;

  @ApiPropertyOptional({ example: "Azadi Square, Gate 3" })
  @IsOptional()
  @IsString()
  meetingPoint?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ["Hiking boots", "Waterproof jacket"]
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredGear?: string[];

  @ApiPropertyOptional({
    type: "array",
    items: {
      type: "object",
      properties: {
        day: { type: "number", example: 1 },
        title: { type: "string", example: "Base camp approach" },
        description: { type: "string", example: "Drive and acclimatization hike." },
        distanceKm: { type: "number", example: 8 },
        elevationGainM: { type: "number", example: 450 }
      }
    }
  })
  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  itinerary?: TourItineraryItem[];

  @ApiPropertyOptional({
    description:
      "Structured trip details (JSON). Patches are deep-merged into the stored document (omit a key to leave it unchanged; arrays replace when sent). Pass root `null` to clear the whole blob. Separate from `description` marketing text.",
    type: () => TourTripDetailsDto,
    nullable: true
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @ValidateNested()
  @Type(() => TourTripDetailsDto)
  tripDetails?: TourTripDetailsDto | null;
}
