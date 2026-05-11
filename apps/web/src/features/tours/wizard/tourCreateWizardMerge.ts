import {
  type TourCreateFormValues,
  sanitizeWizardAccommodationTypes,
} from "@/components/tours/wizard/schemas/tourCreateSchema";

export const wizardDefaultDaySegment = {
  title: "",
  activityType: "hike" as const,
};

const ALLOWED_ACTIVITY_TYPES = ["summit", "trek", "hike", "transfer", "cultural", "social", "rest", "other"] as const;
type AllowedActivityType = (typeof ALLOWED_ACTIVITY_TYPES)[number];

export function normalizeItineraryDraftDays(rawDays: unknown): TourCreateFormValues["itinerary"]["days"] | undefined {
  if (!Array.isArray(rawDays)) return undefined;
  const normalized = rawDays
    .map((rawDay, index) => {
      if (!rawDay || typeof rawDay !== "object") return undefined;
      const day = rawDay as Record<string, unknown>;
      const dayNumberRaw = typeof day.dayNumber === "number" ? day.dayNumber : undefined;
      const dayIndexRaw = typeof day.dayIndex === "number" ? day.dayIndex : undefined;
      const dayNumber = dayNumberRaw ?? (dayIndexRaw != null ? dayIndexRaw + 1 : index + 1);
      const segmentsRaw = Array.isArray(day.segments) ? day.segments : [];
      const segments = segmentsRaw
        .map((rawSeg) => {
          if (!rawSeg || typeof rawSeg !== "object") return undefined;
          const seg = rawSeg as Record<string, unknown>;
          const activityTypeRaw =
            typeof seg.activityType === "string"
              ? seg.activityType
              : typeof seg.type === "string"
                ? seg.type
                : "other";
          const activityType: AllowedActivityType = (ALLOWED_ACTIVITY_TYPES as readonly string[]).includes(activityTypeRaw)
            ? (activityTypeRaw as AllowedActivityType)
            : "other";
          return {
            title: typeof seg.title === "string" ? seg.title : "",
            description: typeof seg.description === "string" ? seg.description : "",
            activityType,
            startTime: typeof seg.startTime === "string" ? seg.startTime : "",
            endTime: typeof seg.endTime === "string" ? seg.endTime : "",
            estimatedDurationHours:
              typeof seg.estimatedDurationHours === "number" ? seg.estimatedDurationHours : undefined,
            distanceKm: typeof seg.distanceKm === "number" ? seg.distanceKm : undefined,
            elevationGainMeters:
              typeof seg.elevationGainMeters === "number" ? seg.elevationGainMeters : undefined,
            maxAltitudeMeters: typeof seg.maxAltitudeMeters === "number" ? seg.maxAltitudeMeters : undefined,
            locationName:
              typeof seg.locationName === "string"
                ? seg.locationName
                : typeof seg.location === "string"
                  ? seg.location
                  : "",
          };
        })
        .filter((s): s is NonNullable<typeof s> => s != null);
      return {
        dayNumber,
        title: typeof day.title === "string" ? day.title : `روز ${dayNumber}`,
        description: typeof day.description === "string" ? day.description : "",
        segments: segments.length > 0 ? segments : [{ ...wizardDefaultDaySegment }],
      };
    })
    .filter((d): d is NonNullable<typeof d> => d != null);
  return normalized.length > 0 ? normalized : undefined;
}

/** Deep-merge preset/draft fragments onto a full wizard model (localStorage + workspace presets). */
export function mergeTourDraft(base: TourCreateFormValues, patch: Partial<TourCreateFormValues> | undefined): TourCreateFormValues {
  if (!patch) return base;
  const normalizedDays = normalizeItineraryDraftDays(patch.itinerary?.days);
  return {
    ...base,
    ...patch,
    autoAcceptRegistrations:
      patch.autoAcceptRegistrations !== undefined ? patch.autoAcceptRegistrations : base.autoAcceptRegistrations,
    overview: { ...base.overview, ...patch.overview },
    pricing: { ...base.pricing, ...patch.pricing },
    schedule: { ...base.schedule, ...patch.schedule },
    location: { ...base.location, ...patch.location },
    itinerary: normalizedDays ? { days: normalizedDays } : { ...base.itinerary },
    participation: { ...base.participation, ...patch.participation },
    logistics: (() => {
      const merged = { ...base.logistics, ...patch.logistics };
      merged.accommodationTypes = sanitizeWizardAccommodationTypes(merged.accommodationTypes);
      return merged;
    })(),
    policies: { ...base.policies, ...patch.policies },
  };
}
