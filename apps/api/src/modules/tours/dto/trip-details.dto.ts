import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested
} from "class-validator";

import { DifficultyLevel } from "../entities/tour-details.entity";
import {
  EXPERIENCE_LEVEL_VALUES,
  GENDER_RESTRICTION_VALUES,
  TRIP_STYLE_VALUES
} from "../types/tour-trip-details.types";

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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tourTheme?: string[];

  @ApiPropertyOptional({ enum: TRIP_STYLE_VALUES })
  @IsOptional()
  @IsIn(TRIP_STYLE_VALUES as unknown as string[])
  tripStyle?: (typeof TRIP_STYLE_VALUES)[number];

  @ApiPropertyOptional({ enum: DifficultyLevel })
  @IsOptional()
  @IsEnum(DifficultyLevel)
  difficultyLevel?: DifficultyLevel;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  elevationGainMeters?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  maxAltitudeMeters?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  bestFor?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  shortIntro?: string;
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

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gearRequired?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  gearOptional?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documentsRequired?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  suitableFor?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  notSuitableFor?: string[];
}

export class TripDetailsLogisticsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  meetingPoint?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  transportation?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  accommodationType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mealPlan?: string;

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

  @ApiPropertyOptional({ type: [String] })
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
}
