import type { CreateTourDto } from "@/lib/services/tours.service";
import type { TourTripDetails } from "@/features/tours/models/tourTripDetails.schema";
import type { TourCreateFormValues } from "@/features/tours/wizard/schemas/classic/tourCreateSchema";

import {
  computeDurationDays,
  dedupeStringList,
  deriveShortDescription,
  overviewTourThemeIdsFromWizard,
  splitLinesToList,
  toAudienceGroups,
  toExperienceLevel,
  toFitnessLevel,
  toGenderRestriction,
  toTourType,
  toTripStyles,
  toUuidList,
  trimToUndefined,
  YMD_RE,
} from "./mappers/wizardMapperHelpers";

type SegmentActivitiesPayload = NonNullable<NonNullable<TourTripDetails["itinerary"]>["segmentActivities"]>;
type SegmentActivityDayPayload = SegmentActivitiesPayload[number];
type SegmentActivityPayload = NonNullable<SegmentActivityDayPayload["segments"]>[number];
type TransportMode = NonNullable<CreateTourDto["transportModes"]>[number];

function mapSegmentActivity(segment: TourCreateFormValues["itinerary"]["days"][number]["segments"][number]): SegmentActivityPayload {
  return {
    title: trimToUndefined(segment.title),
    description: trimToUndefined(segment.description),
    activityType: trimToUndefined(segment.activityType),
    startTime: trimToUndefined(segment.startTime),
    endTime: trimToUndefined(segment.endTime),
    estimatedDurationHours: segment.estimatedDurationHours,
    distanceKm: segment.distanceKm,
    elevationGainMeters: segment.elevationGainMeters,
    maxAltitudeMeters: segment.maxAltitudeMeters,
    locationName: trimToUndefined(segment.locationName),
  };
}

function mapItineraryDays(days: TourCreateFormValues["itinerary"]["days"]): SegmentActivitiesPayload | undefined {
  if (days.length === 0) return undefined;
  return days.map((day): SegmentActivityDayPayload => ({
    dayNumber: day.dayNumber,
    title: trimToUndefined(day.title),
    description: trimToUndefined(day.description),
    segments: day.segments.map(mapSegmentActivity),
  }));
}

/** Maps wizard form state → {@link CreateTourDto} consumed by {@link mapCreateTourDto}. */
export function mapFormValuesToBackendPayload(formValues: TourCreateFormValues): CreateTourDto {
  const shortDescriptionForCards = deriveShortDescription(
    formValues.overview.shortDescription,
    formValues.overview.longDescription,
  );

  const dayPlansRaw =
    formValues.itinerary.days.length > 0
      ? formValues.itinerary.days.flatMap((day) =>
          day.segments.map((segment) => ({
            day: day.dayNumber,
            title: trimToUndefined(segment.title),
            description: trimToUndefined(segment.description),
            distanceKm: segment.distanceKm != null ? Math.round(segment.distanceKm) : undefined,
            elevationGainM: segment.elevationGainMeters,
          })),
        )
      : undefined;

  const dayPlans = dayPlansRaw?.filter((row) => Number.isInteger(row.day) && row.day >= 1);
  const segmentActivities = mapItineraryDays(formValues.itinerary.days);

  const primaryMode = formValues.logistics.primaryTransportMode;
  const supplementalPrivateCar = formValues.logistics.supplementalPrivateCar === true;
  const transportModes: CreateTourDto["transportModes"] = (() => {
    if (!primaryMode) return undefined;
    const normalizedPrimary = (primaryMode === "midibus" ? "bus" : primaryMode) as TransportMode;
    const set = new Set<TransportMode>([normalizedPrimary]);
    if (primaryMode !== "private_car" && supplementalPrivateCar) {
      set.add("private_car");
    }
    return [...set].sort((a, b) => a.localeCompare(b)) as CreateTourDto["transportModes"];
  })();

  const resolvedCapacity =
    formValues.logistics.groupSizeMax ??
    formValues.participation.minParticipants ??
    formValues.logistics.groupSizeMin ??
    1;

  const tripDetails = {
    overview: {
      settingsRegionId: trimToUndefined(formValues.location.regionId),
      settingsMainDestinationId: trimToUndefined(formValues.location.mainDestinationId),
      tripStyles: toTripStyles(formValues.overview.tripStyles),
      shortIntro: shortDescriptionForCards,
      tourThemeIds: overviewTourThemeIdsFromWizard(
        formValues.overview.mainTourThemeId,
        formValues.overview.secondaryTourThemeIds,
      ),
    },
    itinerary: {
      dayPlans: dayPlans && dayPlans.length > 0 ? dayPlans : undefined,
      segmentActivities,
      highlights: dedupeStringList(formValues.overview.highlights),
    },
    participation: {
      requirements: trimToUndefined(formValues.participation.requirements),
      minimumAge: formValues.participation.minimumAge,
      maximumAge: formValues.participation.maximumAge,
      genderRestriction: toGenderRestriction(trimToUndefined(formValues.participation.genderRestriction)),
      experienceLevel: toExperienceLevel(trimToUndefined(formValues.participation.requiredExperienceLevel)),
      fitnessLevel: toFitnessLevel(trimToUndefined(formValues.participation.requiredFitnessLevel)),
      ...(formValues.participation.sportsInsuranceRequired === true ? { sportsInsuranceRequired: true } : {}),
      ...(formValues.participation.registrationNationalIdRequired === true
        ? { registrationNationalIdRequired: true }
        : {}),
      medicalRestrictions: trimToUndefined(formValues.participation.medicalRestrictions),
      technicalSkillRequired: trimToUndefined(formValues.participation.technicalSkillRequired),
      gearRequiredIds: toUuidList(formValues.participation.gearRequiredIds),
      gearOptionalIds: toUuidList(formValues.participation.gearOptionalIds),
      skillsRequired: dedupeStringList(formValues.participation.skillsRequired),
      documentsRequired: dedupeStringList(formValues.participation.documentsRequired),
      suitableFor: toAudienceGroups(formValues.participation.suitableFor),
      notSuitableFor: toAudienceGroups(formValues.participation.notSuitableFor),
    },
    logistics: {
      primaryTransportMode: trimToUndefined(formValues.logistics.primaryTransportMode),
      fuelShareToman:
        formValues.logistics.primaryTransportMode === "private_car" || supplementalPrivateCar
          ? formValues.logistics.fuelShareToman
          : undefined,
      departureDate: YMD_RE.test(trimToUndefined(formValues.schedule.startDate) ?? "")
        ? trimToUndefined(formValues.schedule.startDate)
        : undefined,
      returnDate: YMD_RE.test(trimToUndefined(formValues.schedule.endDate) ?? "")
        ? trimToUndefined(formValues.schedule.endDate)
        : undefined,
      departureMeetingTime: trimToUndefined(formValues.schedule.departureMeetingTime),
      returnMeetingTime: trimToUndefined(formValues.schedule.returnMeetingTime),
      meetingPoint: trimToUndefined(formValues.location.meetingPoint) ?? trimToUndefined(formValues.logistics.meetingPointDetails),
      returnPoint: trimToUndefined(formValues.location.returnPoint),
      transportationNotes:
        trimToUndefined(formValues.logistics.transportationDetails) ??
        trimToUndefined(formValues.logistics.transportationNotes),
      accommodationNotes:
        trimToUndefined(formValues.logistics.accommodationDetails) ??
        trimToUndefined(formValues.logistics.accommodationNotes),
      accommodationTypes: dedupeStringList(formValues.logistics.accommodationTypes),
      mealPlan: trimToUndefined(formValues.logistics.mealPlan),
      mealNotes: trimToUndefined(formValues.logistics.mealNotes),
      ...(formValues.logistics.leaderProvidesInsurance === true
        ? {
            leaderProvidesInsurance: true,
            leaderInsuranceNotes: trimToUndefined(formValues.logistics.leaderInsuranceNotes),
          }
        : {}),
      includedServices: splitLinesToList(formValues.logistics.includedServices),
      excludedServices: splitLinesToList(formValues.logistics.excludedServices),
      supportServices: dedupeStringList(formValues.logistics.supportServices),
      optionalServices: dedupeStringList(formValues.logistics.optionalServices),
      guideLanguageIds: toUuidList(formValues.logistics.guideLanguageIds),
      groupSizeMin: formValues.logistics.groupSizeMin,
      groupSizeMax: formValues.logistics.groupSizeMax,
    },
    policies: {
      cancellationPolicy: trimToUndefined(formValues.policies.cancellationPolicy),
      refundPolicy: trimToUndefined(formValues.policies.refundPolicy),
      attendanceRules: trimToUndefined(formValues.policies.attendanceRules),
      lateArrivalPolicy: trimToUndefined(formValues.policies.lateArrivalPolicy),
      noShowPolicy: trimToUndefined(formValues.policies.noShowPolicy),
      confirmationPolicy: trimToUndefined(formValues.policies.confirmationPolicy),
      capacityPolicy: trimToUndefined(formValues.policies.capacityPolicy),
      safetyPolicy: trimToUndefined(formValues.policies.safetyNotes) ?? trimToUndefined(formValues.policies.safetyPolicy),
      weatherPolicy: trimToUndefined(formValues.policies.weatherPolicy),
      reservationRules:
        trimToUndefined(formValues.policies.riskDisclaimer) ?? trimToUndefined(formValues.policies.reservationRules),
    },
  } as unknown as TourTripDetails;

  const validTourType = toTourType(trimToUndefined(formValues.overview.tourType));
  const meetingPoint =
    trimToUndefined(formValues.location.meetingPoint) ?? trimToUndefined(formValues.logistics.meetingPointDetails);
  const durationDays = computeDurationDays(formValues.schedule.startDate, formValues.schedule.endDate);

  return {
    title: formValues.overview.title.trim(),
    description: trimToUndefined(formValues.overview.longDescription) ?? shortDescriptionForCards ?? "",
    location: trimToUndefined(formValues.location.displayLocation),
    autoAcceptRegistrations: formValues.autoAcceptRegistrations !== false,
    ...(validTourType ? { tourType: validTourType } : {}),
    ...(durationDays != null ? { durationDays } : {}),
    ...(meetingPoint ? { meetingPoint } : {}),
    ...(transportModes && transportModes.length > 0 ? { transportModes } : {}),
    ...(trimToUndefined(formValues.overview.communicationLink)
      ? { communicationLink: trimToUndefined(formValues.overview.communicationLink) }
      : {}),
    tripDetails,
    destinationId: trimToUndefined(formValues.location.mainDestinationId) ?? null,
    capacity: Number.isInteger(resolvedCapacity) && resolvedCapacity > 0 ? resolvedCapacity : 1,
    price: formValues.pricing.basePrice ?? 0,
    ...(formValues.pricing.requiresPayment === true ? { requiresPayment: true } : {}),
    lifecycle_status: "Draft",
  };
}
