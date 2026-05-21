import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
  ValidateNested
} from "class-validator";
import { TOUR_FORM_PROFILE_VALUES_LIST, type TourFormProfile } from "@repo/types";

import { TourLifecycleStatus, TOUR_TYPES, type TourType } from "../entities/tour.entity";
import { DifficultyLevel, TourItineraryItem } from "../entities/tour-details.entity";
import { CostContextDto } from "./cost-context.dto";
import { TourTripDetailsDto } from "./trip-details.dto";
import { TOUR_TITLE_MAX_LENGTH, TOUR_TITLE_MIN_LENGTH } from "./create-tour.dto";
import {
  TOUR_TRANSPORT_MODE_VALUES,
  normalizeTourTransportModesForDto,
  type TourTransportMode
} from "../tour-transport-modes";
import { TOUR_DURATION_DAYS_MAX, TOUR_DURATION_DAYS_MIN } from "../utils/tour-duration";

export class UpdateTourDto {
  @ApiPropertyOptional({
    example: "Damavand summit — 2-day climb (updated)",
    minLength: TOUR_TITLE_MIN_LENGTH,
    maxLength: TOUR_TITLE_MAX_LENGTH
  })
  @IsOptional()
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @Length(TOUR_TITLE_MIN_LENGTH, TOUR_TITLE_MAX_LENGTH, {
    message: `Title must be between ${TOUR_TITLE_MIN_LENGTH} and ${TOUR_TITLE_MAX_LENGTH} characters.`
  })
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
    example: "Updated description",
    description:
      "Long-form copy for the **tour detail page**. When publishing or opening a tour to the public, this should be populated for consistency with list/detail UX. " +
      "Teaser text for cards belongs in `tripDetails.overview.shortIntro`, not here."
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
    type: () => CostContextDto,
    example: { currency: "USD", totalCost: 1200 }
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
      "Top-level **category** of the tour. Use `tripDetails.overview.tripStyles` for the execution-style selections (adventure, luxury, …)."
  })
  @IsOptional()
  @IsIn([...TOUR_TYPES])
  tourType?: TourType;

  @ApiPropertyOptional({
    enum: TOUR_FORM_PROFILE_VALUES_LIST,
    example: "urban_event",
    description:
      "Optional client hint (ignored on update). The authoritative form profile is resolved server-side from " +
      "`workspace_tour_wizard_templates.base_profile` for strip, invariants, and `formProfileSnapshot`."
  })
  @IsOptional()
  @IsIn(TOUR_FORM_PROFILE_VALUES_LIST)
  formProfile?: TourFormProfile;

  @ApiPropertyOptional({
    type: [String],
    enum: TOUR_TRANSPORT_MODE_VALUES,
    isArray: true,
    example: ["plane"],
    description:
      "Replace tour transport modes (multi-select). Send `[]` or `null` to clear. No `mixed` — combine concrete modes."
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
    description: "Workspace destination from Settings → Locations. Send `null` to clear."
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
      "Inclusive day count. Re-derived server-side from `tripDetails.logistics.departureDate`/`returnDate` when those are part of the patch."
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
