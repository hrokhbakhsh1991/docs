import {
  ACCOMMODATION_TYPE_VALUES,
  DENALI_TOUR_KIND_VALUES,
  MEAL_PLAN_VALUES,
  normalizeAccommodationTypesForDto,
  normalizeMealPlanForDto,
  type AccommodationTypeSlug,
  type MealPlanSlug
} from "@repo/types";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
  registerDecorator,
  type ValidationArguments,
  type ValidationOptions
} from "class-validator";

import { DifficultyLevel } from "../entities/tour-details.entity";
import {
  EXPERIENCE_LEVEL_VALUES,
  GENDER_RESTRICTION_VALUES,
  TRIP_STYLE_VALUES,
  type TripStyle
} from "../types/tour-trip-details.types";
import {
  DIFFICULTY_RATING_MAX,
  DIFFICULTY_RATING_MIN,
  DIFFICULTY_RATING_STEP,
  DIFFICULTY_RATING_VALUES,
  type DifficultyRating
} from "../tour-difficulty-rating";
import {
  AUDIENCE_GROUP_VALUES,
  findAudienceOverlap,
  normalizeAudienceGroupsForDto,
  type AudienceGroup
} from "../audience-groups";

/** Maximum length of `tripDetails.overview.shortIntro` (used for tour cards / meta description). */
export const TRIP_SHORT_INTRO_MAX_LENGTH = 250;

/** Wizard primary transport mode (orthogonal to root `transportModes`; persisted in logistics JSONB). */
export const PRIMARY_LOGISTICS_TRANSPORT_MODE_VALUES = [
  "plane",
  "train",
  "bus",
  "midibus",
  "private_car"
] as const;

/** Denali wizard `transport.privateCarMode` persisted on logistics JSONB. */
export const DENALI_PRIVATE_CAR_MODE_VALUES = [
  "no_private_car",
  "car_share_fixed_dong",
  "car_share_friends_only",
  "driver_gets_dong"
] as const;

/**
 * Trim/lowercase incoming `tripStyles` entries before validation; preserves order
 * and lets `@IsIn` flag unknown values. Returns `undefined` when the field is omitted.
 */
function normalizeTripStylesInput(value: unknown): TripStyle[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value)) return value as never;
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : entry))
    .filter((entry) => typeof entry === "string" && entry.length > 0) as TripStyle[];
}

/** Denali 5-zone location pin (Phase 7). Declared before nested DTOs that reference it (emitDecoratorMetadata order). */
export class TripDetailsLocationDataDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID("4")
  id?: string;

  @ApiPropertyOptional({ description: "Human-readable address or place label." })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressText?: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsNumber()
  latitude?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, v) => v != null)
  @IsNumber()
  longitude?: number | null;
}

/** Multi-station pickup row (`tripDetails.logistics.gatheringPoints`). */
export class TripDetailsGatheringPickupStationDto {
  @ApiProperty({ description: "Human label for the pickup station." })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiPropertyOptional({ description: "Local assembly time (24h HH:mm)." })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== "")
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "time must be empty or HH:mm" })
  time?: string;

  @ApiProperty({ type: () => TripDetailsLocationDataDto })
  @ValidateNested()
  @Type(() => TripDetailsLocationDataDto)
  location!: TripDetailsLocationDataDto;
}

export class TripDetailsPhotoDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsUUID("4")
  id!: string;

  @ApiPropertyOptional()
  @IsString()
  url!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  filename?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  size?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  uploadedAt?: string;
}

export class TripDetailsDayPlanDto {
  @ApiPropertyOptional({ example: 1 })
  @IsInt()
  @Min(1)
  day!: number;

  @ApiPropertyOptional({ example: "Approach" })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: "Transfer to base camp." })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 8 })
  @IsOptional()
  @IsInt()
  @Min(0)
  distanceKm?: number;

  @ApiPropertyOptional({ example: 450 })
  @IsOptional()
  @IsInt()
  elevationGainM?: number;

  @ApiPropertyOptional({ type: () => [TripDetailsPhotoDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripDetailsPhotoDto)
  photos?: TripDetailsPhotoDto[];

  @ApiPropertyOptional({
    type: () => TripDetailsLocationDataDto,
    description: "Optional structured geolocation for this itinerary day.",
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TripDetailsLocationDataDto)
  location?: TripDetailsLocationDataDto;
}

export class TripDetailsOverviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mainDestination?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  destinationRegion?: string;

  @ApiPropertyOptional({
    type: [String],
    format: "uuid",
    description: "Workspace catalog tour theme ids (`workspace_tour_themes.id`)."
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  tourThemeIds?: string[];

  @ApiPropertyOptional({
    type: "object",
    additionalProperties: { type: "string" },
    description:
      "Optional snapshot of theme id → display label for detail views when an id is no longer in the workspace catalog."
  })
  @IsOptional()
  @IsObject()
  tourThemeLabels?: Record<string, string>;

  @ApiPropertyOptional({
    type: [String],
    enum: TRIP_STYLE_VALUES,
    isArray: true,
    description:
      "Multi-select execution style (adventure, relaxed, luxury, budget, familyFriendly, photography). " +
      "Orthogonal to root `tourType` (mountain, city, …). Replaces a legacy singular overview style field (migrated to this array on read)."
  })
  @IsOptional()
  @Transform(({ value }) => normalizeTripStylesInput(value))
  @IsArray()
  @ArrayUnique()
  @IsIn(TRIP_STYLE_VALUES as unknown as string[], { each: true })
  tripStyles?: TripStyle[];

  @ApiPropertyOptional({
    type: Number,
    minimum: DIFFICULTY_RATING_MIN,
    maximum: DIFFICULTY_RATING_MAX,
    multipleOf: DIFFICULTY_RATING_STEP,
    example: 4.5,
    description:
      `Numeric difficulty rating on a 1–10 scale with ${DIFFICULTY_RATING_STEP} step granularity ` +
      "(allowed values: 1, 1.5, 2, …, 9.5, 10). Replaces the legacy enum."
  })
  @IsOptional()
  @IsIn(DIFFICULTY_RATING_VALUES as unknown as number[])
  difficultyLevel?: DifficultyRating;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  elevationGainMeters?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  maxAltitudeMeters?: number;

  /**
   * @deprecated Replaced by the structured audience matrix
   * (`participation.suitableFor` / `participation.notSuitableFor`).
   * Kept on the DTO so legacy clients can still round-trip existing JSONB without errors.
   * The web tour-create form no longer renders or writes this field.
   */
  @ApiPropertyOptional({
    type: [String],
    deprecated: true,
    description:
      "Deprecated. Use `participation.suitableFor` / `participation.notSuitableFor` instead. " +
      "Retained for backward-compatible reads of older JSONB documents."
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bestFor?: string[];

  @ApiPropertyOptional({
    maxLength: TRIP_SHORT_INTRO_MAX_LENGTH,
    description:
      `Very short teaser (≤${TRIP_SHORT_INTRO_MAX_LENGTH} chars) for **tour cards / list previews / meta description**. ` +
      "The root tour `description` field holds the long-form story for the **full tour page**. " +
      "If empty, clients should fall back to `description` when rendering cards."
  })
  @IsOptional()
  @IsString()
  @MaxLength(TRIP_SHORT_INTRO_MAX_LENGTH)
  shortIntro?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Settings → Locations region id (wizard JSONB linkage)."
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  settingsRegionId?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description: "Settings → Locations primary destination id (wizard)."
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  settingsMainDestinationId?: string;

  @ApiPropertyOptional({
    description: "Free-text / comma-separated secondary destination ids from the wizard when not normalized to UUID array."
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  secondaryDestinationIdsRaw?: string;

  @ApiPropertyOptional({
    type: [String],
    format: "uuid",
    description: "Workspace tour leader ids."
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  leaderUserIds?: string[];

  @ApiPropertyOptional({
    description: "Display name for the local guide (when not a workspace user)."
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  localGuideName?: string;

  @ApiPropertyOptional({ type: () => TripDetailsLocationDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TripDetailsLocationDataDto)
  startPoint?: TripDetailsLocationDataDto;

  @ApiPropertyOptional({ type: () => TripDetailsLocationDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TripDetailsLocationDataDto)
  summitPoint?: TripDetailsLocationDataDto;

  @ApiPropertyOptional({ type: () => TripDetailsLocationDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TripDetailsLocationDataDto)
  campPoint?: TripDetailsLocationDataDto;

  @ApiPropertyOptional({ type: () => TripDetailsLocationDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TripDetailsLocationDataDto)
  endPoint?: TripDetailsLocationDataDto;

  @ApiPropertyOptional({
    enum: [...DENALI_TOUR_KIND_VALUES],
    description: "Denali 6-tab wizard tour kind slug (persisted for edit/clone round-trip)."
  })
  @IsOptional()
  @IsIn([...DENALI_TOUR_KIND_VALUES])
  denaliTourKind?: (typeof DENALI_TOUR_KIND_VALUES)[number];
}

export class TripDetailsSegmentActivitySegmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  activityType?: string;

  @ApiPropertyOptional({ description: "24h HH:mm" })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== "")
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "startTime must be empty or HH:mm" })
  startTime?: string;

  @ApiPropertyOptional({ description: "24h HH:mm" })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== "")
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "endTime must be empty or HH:mm" })
  endTime?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  estimatedDurationHours?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  distanceKm?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  elevationGainMeters?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  maxAltitudeMeters?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  locationName?: string;
}

export class TripDetailsSegmentActivityDayDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsInt()
  @Min(1)
  dayNumber!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(256)
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: () => [TripDetailsSegmentActivitySegmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripDetailsSegmentActivitySegmentDto)
  segments?: TripDetailsSegmentActivitySegmentDto[];

  @ApiPropertyOptional({ type: () => [TripDetailsPhotoDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripDetailsPhotoDto)
  photos?: TripDetailsPhotoDto[];
}

export class TripDetailsItineraryDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includedVisits?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedVisits?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  optionalActivities?: string[];

  @ApiPropertyOptional({
    description: "Free-text itinerary / program summary."
  })
  @IsOptional()
  @IsString()
  outline?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  programNotes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialExperiences?: string[];

  @ApiPropertyOptional({ type: [TripDetailsDayPlanDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripDetailsDayPlanDto)
  dayPlans?: TripDetailsDayPlanDto[];

  @ApiPropertyOptional({
    type: () => [TripDetailsSegmentActivityDayDto],
    description: "Structured per-day segments from the tour wizard (distinct from legacy `dayPlans` rows)."
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripDetailsSegmentActivityDayDto)
  segmentActivities?: TripDetailsSegmentActivityDayDto[];
}

export class TripDetailsParticipationDto {
  @ApiPropertyOptional({ minimum: 0, maximum: 150 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(150)
  minimumAge?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: 150 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(150)
  maximumAge?: number;

  @ApiPropertyOptional({ enum: GENDER_RESTRICTION_VALUES })
  @IsOptional()
  @IsIn(GENDER_RESTRICTION_VALUES as unknown as string[])
  genderRestriction?: (typeof GENDER_RESTRICTION_VALUES)[number];

  @ApiPropertyOptional({ enum: DifficultyLevel })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  fitnessLevel?: DifficultyLevel;

  @ApiPropertyOptional({ enum: EXPERIENCE_LEVEL_VALUES })
  @IsOptional()
  @IsIn(EXPERIENCE_LEVEL_VALUES as unknown as string[])
  experienceLevel?: (typeof EXPERIENCE_LEVEL_VALUES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  medicalRestrictions?: string;

  @ApiPropertyOptional({
    description: "Technical mountaineering skill expectation (separate from general fitness)."
  })
  @IsOptional()
  @IsString()
  technicalSkillRequired?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  requirements?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skillsRequired?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: "uuid",
    description: "Workspace equipment item ids (required gear)."
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  gearRequiredIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: "uuid",
    description: "Workspace equipment item ids (optional / recommended gear)."
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  gearOptionalIds?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentsRequired?: string[];

  @ApiPropertyOptional({
    type: [String],
    enum: AUDIENCE_GROUP_VALUES,
    isArray: true,
    description:
      "Audience groups this tour is well-suited for. Fixed enum: " +
      AUDIENCE_GROUP_VALUES.join(", ") +
      ". Must NOT overlap with `notSuitableFor`. Legacy free-form values from older payloads " +
      "are silently dropped during normalization."
  })
  @IsOptional()
  @Transform(({ value }) => normalizeAudienceGroupsForDto(value))
  @IsArray()
  @ArrayUnique()
  @IsIn(AUDIENCE_GROUP_VALUES as unknown as string[], { each: true })
  suitableFor?: AudienceGroup[];

  @ApiPropertyOptional({
    type: [String],
    enum: AUDIENCE_GROUP_VALUES,
    isArray: true,
    description:
      "Audience groups this tour is NOT suitable for. Fixed enum: " +
      AUDIENCE_GROUP_VALUES.join(", ") +
      ". Must NOT overlap with `suitableFor`."
  })
  @IsOptional()
  @Transform(({ value }) => normalizeAudienceGroupsForDto(value))
  @IsArray()
  @ArrayUnique()
  @IsIn(AUDIENCE_GROUP_VALUES as unknown as string[], { each: true })
  @AudienceGroupsDoNotOverlap("suitableFor")
  notSuitableFor?: AudienceGroup[];

  @ApiPropertyOptional({
    description: "Free-text fitness / experience prerequisites (Denali wizard).",
    maxLength: 2000
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  fitnessPrerequisiteText?: string;

  @ApiPropertyOptional({
    description: "Participant must carry valid sport / mountaineering insurance (leader-enforced)."
  })
  @IsOptional()
  @IsBoolean()
  sportsInsuranceRequired?: boolean;

  @ApiPropertyOptional({
    description:
      "When true, only authenticated registrants with `national_id` set on their user profile may register or join the waitlist."
  })
  @IsOptional()
  @IsBoolean()
  registrationNationalIdRequired?: boolean;
}

/**
 * Class-validator constraint: rejects when this property and `siblingProperty` share any value.
 * Used to enforce that an audience group is not flagged simultaneously as suitable AND not suitable.
 */
function AudienceGroupsDoNotOverlap(
  siblingProperty: string,
  validationOptions?: ValidationOptions
) {
  return function decorate(object: object, propertyName: string) {
    registerDecorator({
      name: "audienceGroupsDoNotOverlap",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [siblingProperty],
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          const siblingName = args.constraints[0] as string;
          const siblingValue = (args.object as Record<string, unknown>)[siblingName];
          const a = Array.isArray(value) ? (value as string[]) : [];
          const b = Array.isArray(siblingValue) ? (siblingValue as string[]) : [];
          return findAudienceOverlap(a, b).length === 0;
        },
        defaultMessage(args: ValidationArguments): string {
          const siblingName = args.constraints[0] as string;
          const a = Array.isArray(args.value) ? (args.value as string[]) : [];
          const b = Array.isArray((args.object as Record<string, unknown>)[siblingName])
            ? ((args.object as Record<string, unknown>)[siblingName] as string[])
            : [];
          const overlap = findAudienceOverlap(a, b);
          return (
            `\`${args.property}\` and \`${siblingName}\` must not contain the same audience group ` +
            `(conflicting: ${overlap.join(", ")}).`
          );
        }
      }
    });
  };
}

export class TripDetailsLogisticsDto {
  @ApiPropertyOptional({
    deprecated: true,
    description: "Deprecated. Use `gatheringPoints` array for structured pickup stations."
  })
  @IsOptional()
  @IsString()
  meetingPoint?: string;

  @ApiPropertyOptional({
    description: "Precise start village / trailhead (Denali wizard).",
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  startPointVillage?: string;

  @ApiPropertyOptional({
    description: "Local departure meetup time (free text, e.g. 05:30)."
  })
  @IsOptional()
  @IsString()
  departureMeetingTime?: string;

  @ApiPropertyOptional({
    description: "Departure date (recommended format: YYYY-MM-DD)."
  })
  @IsOptional()
  @IsString()
  departureDate?: string;

  @ApiPropertyOptional({
    description: "Return date (recommended format: YYYY-MM-DD)."
  })
  @IsOptional()
  @IsString()
  returnDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  returnPoint?: string;

  @ApiPropertyOptional({
    description: "Planned transportation notes (mode, route, operator, vehicle).",
    maxLength: 1000
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  transportationNotes?: string;

  @ApiPropertyOptional({
    deprecated: true,
    maxLength: 1000,
    description:
      "Deprecated. Use `transportationNotes`. Retained for backward-compatible reads of legacy JSONB; " +
      "new writes should send `transportationNotes`."
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  transportation?: string;

  @ApiPropertyOptional({
    type: [String],
    enum: ACCOMMODATION_TYPE_VALUES,
    isArray: true,
    description:
      "Accommodation for this trip (multi-select). Allowed: " +
      ACCOMMODATION_TYPE_VALUES.join(", ") +
      "."
  })
  @IsOptional()
  @Transform(({ value }) => normalizeAccommodationTypesForDto(value))
  @IsArray()
  @ArrayUnique()
  @IsIn(ACCOMMODATION_TYPE_VALUES as unknown as string[], { each: true })
  accommodationTypes?: AccommodationTypeSlug[];

  @ApiPropertyOptional({
    description: "Additional accommodation context not covered by fixed categories.",
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  accommodationNotes?: string;

  @ApiPropertyOptional({
    deprecated: true,
    maxLength: 500,
    description:
      "Deprecated. Use `accommodationTypes` and optional `accommodationNotes`. Retained for backward-compatible reads of legacy JSONB."
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  accommodationType?: string;

  @ApiPropertyOptional({
    enum: MEAL_PLAN_VALUES,
    description: "Included meals for the trip (single choice)."
  })
  @IsOptional()
  @Transform(({ value }) => normalizeMealPlanForDto(value))
  @IsIn(MEAL_PLAN_VALUES as unknown as string[])
  mealPlan?: MealPlanSlug;

  @ApiPropertyOptional({
    description: "Additional meal or catering context beyond `mealPlan`.",
    maxLength: 500
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  mealNotes?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  supportServices?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  includedServices?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  excludedServices?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  optionalServices?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: "uuid",
    description: "Workspace guide language ids (from Settings → Guide languages)."
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID("4", { each: true })
  guideLanguageIds?: string[];

  @ApiPropertyOptional({
    deprecated: true,
    type: [String],
    description:
      "Deprecated. Use `guideLanguageIds` referencing workspace guide languages. Retained for legacy JSONB reads only."
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  guideLanguage?: string[];

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  groupSizeMin?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  groupSizeMax?: number;

  @ApiPropertyOptional({
    enum: PRIMARY_LOGISTICS_TRANSPORT_MODE_VALUES,
    description: "Primary mode selected in the wizard (stored in JSONB; may inform root `transportModes`)."
  })
  @IsOptional()
  @IsIn([...PRIMARY_LOGISTICS_TRANSPORT_MODE_VALUES])
  primaryTransportMode?: (typeof PRIMARY_LOGISTICS_TRANSPORT_MODE_VALUES)[number];

  @ApiPropertyOptional({
    description:
      "Shared fuel cost in Toman when the tour uses `private_car` (either as wizard primary mode or alongside another mode in root `transportModes`)."
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(10_000_000_000)
  fuelShareToman?: number;

  @ApiPropertyOptional({
    enum: [...DENALI_PRIVATE_CAR_MODE_VALUES],
    description: "Denali supplemental private-car / dong mode (wizard transport tab)."
  })
  @IsOptional()
  @IsIn([...DENALI_PRIVATE_CAR_MODE_VALUES])
  privateCarMode?: (typeof DENALI_PRIVATE_CAR_MODE_VALUES)[number];

  @ApiPropertyOptional({ description: "Return / end-of-trip meetup time (24h HH:mm)." })
  @IsOptional()
  @ValidateIf((_, v) => v != null && String(v).trim() !== "")
  @IsString()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: "returnMeetingTime must be empty or HH:mm" })
  returnMeetingTime?: string;

  @ApiPropertyOptional({
    description: "Organizer includes some insurance coverage in the tour package."
  })
  @IsOptional()
  @IsBoolean()
  leaderProvidesInsurance?: boolean;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  leaderInsuranceNotes?: string;

  @ApiPropertyOptional({
    type: () => [TripDetailsGatheringPickupStationDto],
    description: "Multiple gathering pickup stations for the tour (Denali)."
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripDetailsGatheringPickupStationDto)
  gatheringPoints?: TripDetailsGatheringPickupStationDto[];
}

export class TripDetailsPoliciesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reservationRules?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cancellationPolicy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refundPolicy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  attendanceRules?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  lateArrivalPolicy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  noShowPolicy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  confirmationPolicy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  capacityPolicy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  weatherPolicy?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  safetyPolicy?: string;
}

/** Denali wizard transport slice persisted on `trip_details.transport` JSONB. */
export class TripDetailsDenaliTransportDto {
  @ApiPropertyOptional({
    description: "Organizer transport fee per person (Toman) — not دنگ.",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  transportCost?: number;

  @ApiPropertyOptional({
    description: "Bus/minibus/train: participants may use a personal car.",
  })
  @IsOptional()
  @IsBoolean()
  allowPersonalCar?: boolean;

  @ApiPropertyOptional({ description: "Personal car fuel share (دنگ) when allowed." })
  @IsOptional()
  @IsInt()
  @Min(1)
  dongAmount?: number;
}

export class TourTripDetailsDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  schemaVersion?: number;

  @ApiPropertyOptional({ type: () => TripDetailsOverviewDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TripDetailsOverviewDto)
  overview?: TripDetailsOverviewDto;

  @ApiPropertyOptional({ type: () => TripDetailsItineraryDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TripDetailsItineraryDto)
  itinerary?: TripDetailsItineraryDto;

  @ApiPropertyOptional({ type: () => TripDetailsParticipationDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TripDetailsParticipationDto)
  participation?: TripDetailsParticipationDto;

  @ApiPropertyOptional({ type: () => TripDetailsLogisticsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TripDetailsLogisticsDto)
  logistics?: TripDetailsLogisticsDto;

  @ApiPropertyOptional({ type: () => TripDetailsPoliciesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TripDetailsPoliciesDto)
  policies?: TripDetailsPoliciesDto;

  @ApiPropertyOptional({ type: () => TripDetailsDenaliTransportDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => TripDetailsDenaliTransportDto)
  transport?: TripDetailsDenaliTransportDto;

  @ApiPropertyOptional({ type: () => [TripDetailsPhotoDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TripDetailsPhotoDto)
  photos?: TripDetailsPhotoDto[];
}
