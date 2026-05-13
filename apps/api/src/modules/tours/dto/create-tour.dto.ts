import { Transform, Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  ValidateIf,
  Max,
  Min,
  ValidateNested
} from "class-validator";
import { TOUR_FORM_PROFILE_VALUES_LIST, type TourFormProfile } from "@repo/types";

import { TourLifecycleStatus, TOUR_TYPES, type TourType } from "../entities/tour.entity";
import { DifficultyLevel, TourItineraryItem } from "../entities/tour-details.entity";
import { CostContextDto } from "./cost-context.dto";
import { TourTripDetailsDto } from "./trip-details.dto";
import {
  TOUR_TRANSPORT_MODE_VALUES,
  normalizeTourTransportModesForDto,
  type TourTransportMode
} from "../tour-transport-modes";
import { TOUR_DURATION_DAYS_MAX, TOUR_DURATION_DAYS_MIN } from "../utils/tour-duration";

/** Title length contract (kept in sync with web `tours-new-validation-messages`). */
export const TOUR_TITLE_MIN_LENGTH = 10;
export const TOUR_TITLE_MAX_LENGTH = 120;

export class CreateTourDto {
  @ApiProperty({
    example: "Damavand summit — 2-day climb from the south face",
    minLength: TOUR_TITLE_MIN_LENGTH,
    maxLength: TOUR_TITLE_MAX_LENGTH
  })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @Length(TOUR_TITLE_MIN_LENGTH, TOUR_TITLE_MAX_LENGTH, {
    message: `Title must be between ${TOUR_TITLE_MIN_LENGTH} and ${TOUR_TITLE_MAX_LENGTH} characters.`
  })
  title!: string;

  @ApiProperty({
    example: 30,
    minimum: 0
  })
  @IsInt()
  @Min(0)
  total_capacity!: number;

  @ApiProperty({
    example: "Draft",
    description: "Accepted values: Draft or Open"
  })
  @Transform(({ value }) => {
    if (value === "Draft") {
      return TourLifecycleStatus.DRAFT;
    }
    if (value === "Open") {
      return TourLifecycleStatus.OPEN;
    }
    return value;
  })
  @IsIn([TourLifecycleStatus.DRAFT, TourLifecycleStatus.OPEN])
  lifecycle_status!: TourLifecycleStatus.DRAFT | TourLifecycleStatus.OPEN;

  @ApiPropertyOptional({
    example: "A two-day nature tour for members.",
    description:
      "Long-form marketing copy for the **tour detail page** (not list cards). " +
      "For **public** tours (`lifecycle_status` = Open), treat this as **required** by product policy so detail pages stay complete. " +
      "Distinct from `tripDetails.overview.shortIntro`, which is a short teaser for cards/previews."
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: "https://t.me/joinchat/example"
  })
  @IsOptional()
  @IsString()
  chat_link?: string;

  @ApiPropertyOptional({
    type: () => CostContextDto,
    example: {
      currency: "USD",
      totalCost: 1200
    }
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CostContextDto)
  cost_context?: CostContextDto;

  @ApiPropertyOptional({
    example: true
  })
  @IsOptional()
  @IsBoolean()
  autoAcceptRegistrations?: boolean;

  @ApiPropertyOptional({
    enum: [...TOUR_TYPES],
    example: TOUR_TYPES[0],
    description:
      "Top-level **category** of the tour (mountain, city, desert, nature, cultural). " +
      "Distinct from `tripDetails.overview.tripStyles`, which describes the execution style (adventure, luxury, …)."
  })
  @IsOptional()
  @IsIn([...TOUR_TYPES])
  tourType?: TourType;

  @ApiPropertyOptional({
    enum: TOUR_FORM_PROFILE_VALUES_LIST,
    example: "mountain_outdoor",
    description:
      "Canonical **tour creation form profile**. When present, takes precedence over theme-derived profile " +
      "and `tourType` fallbacks for server strip, invariants, and persisted `formProfileSnapshot`. " +
      "Omit to resolve from `tripDetails.overview.tourThemeIds[0]` then `tourType`."
  })
  @IsOptional()
  @IsIn(TOUR_FORM_PROFILE_VALUES_LIST)
  formProfile?: TourFormProfile;

  @ApiPropertyOptional({
    type: [String],
    enum: TOUR_TRANSPORT_MODE_VALUES,
    isArray: true,
    example: ["bus", "train"],
    description:
      "Organized transport modes for this tour (multi-select: bus, train, plane, private_car). " +
      "Omit or send `[]` when not applicable. There is no `mixed` value — select every mode that applies."
  })
  @IsOptional()
  @Transform(({ value }) => normalizeTourTransportModesForDto(value) as TourTransportMode[] | undefined)
  @IsArray()
  @ArrayUnique()
  @IsIn([...TOUR_TRANSPORT_MODE_VALUES], { each: true })
  transportModes?: TourTransportMode[];

  @ApiPropertyOptional({
    format: "uuid",
    nullable: true,
    description: "Workspace destination from Settings → Locations (optional)."
  })
  @IsOptional()
  @Transform(({ value }) => (value === "" ? undefined : value))
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  destinationId?: string | null;

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

  @ApiPropertyOptional({
    example: 3,
    minimum: TOUR_DURATION_DAYS_MIN,
    maximum: TOUR_DURATION_DAYS_MAX,
    description:
      "Inclusive day count. **Derived** from `tripDetails.logistics.departureDate`/`returnDate` " +
      "when both are present; the server overrides any value sent here in that case. " +
      "Direct API callers may still send it without dates."
  })
  @IsOptional()
  @IsInt()
  @Min(TOUR_DURATION_DAYS_MIN)
  @Max(TOUR_DURATION_DAYS_MAX)
  durationDays?: number;

  @ApiPropertyOptional({ example: "Azadi Square, Gate 3" })
  @IsOptional()
  @IsString()
  meetingPoint?: string;

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
      "Structured trip details (JSON). On create, the payload is persisted as given (no prior document to merge). Separate from `description` marketing text.",
    type: () => TourTripDetailsDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TourTripDetailsDto)
  tripDetails?: TourTripDetailsDto;
}
