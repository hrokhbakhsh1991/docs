import { z } from "zod";

import {
  ACCOMMODATION_TYPE_VALUES,
  MEAL_PLAN_VALUES,
  TOUR_AUDIENCE_GROUP_VALUES,
} from "@repo/types";

import {
  optionalStringList,
  optionalTimeHhmm,
  optionalTrimmedString,
  optionalUuidV4,
  optionalUuidV4List,
  optionalYmdDate,
} from "./wire-primitives";
import {
  DIFFICULTY_LEVEL_WIRE_VALUES,
  EXPERIENCE_LEVEL_WIRE_VALUES,
  GENDER_RESTRICTION_WIRE_VALUES,
  PRIMARY_LOGISTICS_TRANSPORT_MODE_WIRE_VALUES,
  TRIP_SHORT_INTRO_WIRE_MAX_LENGTH,
  TRIP_STYLE_WIRE_VALUES,
} from "./wire-constants";

const tripDetailsLocationWireSchema = z
  .object({
    id: optionalUuidV4,
    addressText: optionalTrimmedString(500),
    latitude: z.number().nullable().optional(),
    longitude: z.number().nullable().optional(),
  })
  .strict();

const gatheringPickupStationWireSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    time: optionalTimeHhmm,
    location: tripDetailsLocationWireSchema,
  })
  .strict();

const tourPhotoPersistedWireSchema = z
  .object({
    id: z.string().uuid(),
    filename: z.string().max(256),
    size: z.number().int().min(0),
    mimeType: z.string().max(128),
    uploadedAt: z.string(),
  })
  .strict();

/** Wire ingress accepts optional ephemeral `url`; persistence strips it server-side. */
const dayPlanPhotoWireSchema = tourPhotoPersistedWireSchema
  .extend({
    url: z.string().url().optional(),
  })
  .strict();

const dayPlanWireSchema = z
  .object({
    day: z.number().int().min(1),
    title: optionalTrimmedString(500),
    description: optionalTrimmedString(10_000),
    distanceKm: z.number().int().min(0).max(50_000).optional(),
    elevationGainM: z.number().int().min(-10_000).max(30_000).optional(),
    photos: z.array(dayPlanPhotoWireSchema).optional(),
    location: tripDetailsLocationWireSchema.optional(),
  })
  .strict();

const segmentActivityWireSchema = z
  .object({
    title: optionalTrimmedString(256),
    description: optionalTrimmedString(10_000),
    activityType: optionalTrimmedString(64),
    startTime: optionalTimeHhmm,
    endTime: optionalTimeHhmm,
    estimatedDurationHours: z.number().min(0).max(240).optional(),
    distanceKm: z.number().min(0).max(10_000).optional(),
    elevationGainMeters: z.number().int().min(0).max(30_000).optional(),
    maxAltitudeMeters: z.number().int().min(-500).max(30_000).optional(),
    locationName: optionalTrimmedString(256),
  })
  .strict();

const segmentActivityDayWireSchema = z
  .object({
    dayNumber: z.number().int().min(1),
    title: optionalTrimmedString(256),
    description: optionalTrimmedString(10_000),
    segments: z.array(segmentActivityWireSchema).optional(),
    photos: z.array(dayPlanPhotoWireSchema).optional(),
  })
  .strict();

export const tripDetailsOverviewWireSchema = z
  .object({
    mainDestination: optionalTrimmedString(500),
    destinationRegion: optionalTrimmedString(500),
    tourThemeIds: optionalUuidV4List,
    tourThemeLabels: z.record(z.string().uuid(), z.string().max(120)).optional(),
    leaderUserIds: optionalUuidV4List,
    localGuideName: optionalTrimmedString(128),
    tripStyles: z.array(z.enum(TRIP_STYLE_WIRE_VALUES)).optional(),
    difficultyLevel: z.number().min(0.5).max(10).optional(),
    elevationGainMeters: z.number().int().min(0).max(30_000).optional(),
    maxAltitudeMeters: z.number().int().min(-500).max(30_000).optional(),
    shortIntro: optionalTrimmedString(TRIP_SHORT_INTRO_WIRE_MAX_LENGTH),
    settingsRegionId: optionalTrimmedString(64),
    settingsMainDestinationId: optionalTrimmedString(64),
    secondaryDestinationIdsRaw: optionalTrimmedString(10_000),
    denaliTourKind: optionalTrimmedString(64),
    nonAttendanceDetails: optionalTrimmedString(10_000),
    customServiceLabels: z.array(z.string().trim().min(1)).optional(),
    startPoint: tripDetailsLocationWireSchema.optional(),
  })
  .strict();

export const tripDetailsItineraryWireSchema = z
  .object({
    segmentActivities: z.array(segmentActivityDayWireSchema).optional(),
    highlights: optionalStringList,
    includedVisits: optionalStringList,
    excludedVisits: optionalStringList,
    optionalActivities: optionalStringList,
    outline: optionalTrimmedString(10_000),
    programNotes: optionalTrimmedString(10_000),
    specialExperiences: optionalStringList,
    dayPlans: z.array(dayPlanWireSchema).optional(),
  })
  .strict();

export const tripDetailsParticipationWireSchema = z
  .object({
    minimumAge: z.number().int().min(0).max(150).optional(),
    maximumAge: z.number().int().min(0).max(150).optional(),
    genderRestriction: z.enum(GENDER_RESTRICTION_WIRE_VALUES).optional(),
    fitnessLevel: z.enum(DIFFICULTY_LEVEL_WIRE_VALUES).optional(),
    experienceLevel: z.enum(EXPERIENCE_LEVEL_WIRE_VALUES).optional(),
    medicalRestrictions: optionalTrimmedString(10_000),
    technicalSkillRequired: optionalTrimmedString(512),
    requirements: optionalTrimmedString(10_000),
    skillsRequired: optionalStringList,
    gearRequiredIds: optionalUuidV4List,
    gearOptionalIds: optionalUuidV4List,
    documentsRequired: optionalStringList,
    suitableFor: z.array(z.enum(TOUR_AUDIENCE_GROUP_VALUES)).optional(),
    notSuitableFor: z.array(z.enum(TOUR_AUDIENCE_GROUP_VALUES)).optional(),
    sportsInsuranceRequired: z.boolean().optional(),
    registrationNationalIdRequired: z.boolean().optional(),
  })
  .strict();

export const tripDetailsLogisticsWireSchema = z
  .object({
    primaryTransportMode: z.enum(PRIMARY_LOGISTICS_TRANSPORT_MODE_WIRE_VALUES).optional(),
    supplementalPrivateCar: z.boolean().optional(),
    fuelShareToman: z.number().int().min(0).max(10_000_000_000).optional(),
    meetingPoint: optionalTrimmedString(2048),
    gatheringPoints: z.array(gatheringPickupStationWireSchema).optional(),
    departureMeetingTime: optionalTimeHhmm,
    returnMeetingTime: optionalTimeHhmm,
    departureDate: optionalYmdDate,
    returnDate: optionalYmdDate,
    returnPoint: optionalTrimmedString(2048),
    transportationNotes: optionalTrimmedString(1000),
    /** @deprecated Legacy key — accepted on wire for backward compatibility. */
    transportation: optionalTrimmedString(1000),
    accommodationTypes: z.array(z.enum(ACCOMMODATION_TYPE_VALUES)).optional(),
    accommodationNotes: optionalTrimmedString(500),
    /** @deprecated Legacy free-text — accepted on wire for backward compatibility. */
    accommodationType: optionalTrimmedString(500),
    mealPlan: z.enum(MEAL_PLAN_VALUES).optional(),
    mealNotes: optionalTrimmedString(500),
    supportServices: optionalStringList,
    includedServices: optionalStringList,
    excludedServices: optionalStringList,
    optionalServices: optionalStringList,
    leaderProvidesInsurance: z.boolean().optional(),
    leaderInsuranceNotes: optionalTrimmedString(500),
    guideLanguageIds: optionalUuidV4List,
    groupSizeMin: z.number().int().min(0).max(10_000).optional(),
    groupSizeMax: z.number().int().min(0).max(10_000).optional(),
  })
  .strict();

export const tripDetailsRequirementsWireSchema = z
  .object({
    minRequiredPeaks: z.number().int().min(1).max(4).optional(),
  })
  .strict();

export const tripDetailsPoliciesWireSchema = z
  .object({
    reservationRules: optionalTrimmedString(10_000),
    cancellationPolicy: optionalTrimmedString(10_000),
    refundPolicy: optionalTrimmedString(10_000),
    attendanceRules: optionalTrimmedString(10_000),
    lateArrivalPolicy: optionalTrimmedString(10_000),
    noShowPolicy: optionalTrimmedString(10_000),
    confirmationPolicy: optionalTrimmedString(10_000),
    capacityPolicy: optionalTrimmedString(10_000),
    weatherPolicy: optionalTrimmedString(10_000),
    safetyPolicy: optionalTrimmedString(10_000),
  })
  .strict();

/** Structural baseline for `CreateTourDto.tripDetails` POST/PATCH wire JSON. */
export const tourTripDetailsWireSchema = z
  .object({
    schemaVersion: z.number().int().min(1).max(99).optional(),
    overview: tripDetailsOverviewWireSchema.optional(),
    itinerary: tripDetailsItineraryWireSchema.optional(),
    participation: tripDetailsParticipationWireSchema.optional(),
    logistics: tripDetailsLogisticsWireSchema.optional(),
    requirements: tripDetailsRequirementsWireSchema.optional(),
    policies: tripDetailsPoliciesWireSchema.optional(),
    photos: z.array(dayPlanPhotoWireSchema).optional(),
  })
  .strict();

export type TourTripDetailsWire = z.infer<typeof tourTripDetailsWireSchema>;
