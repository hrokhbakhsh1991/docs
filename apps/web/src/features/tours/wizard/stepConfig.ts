import type { TourCreateFormValues } from "@/components/tours/wizard/legacy/schemas/tourCreateSchema";

export const wizardSteps = [
  "basic",
  "theme",
  "capacity",
  "location",
  "itinerary",
  "participation",
  "logistics",
  "policies",
  "review",
] as const;

export type TourCreateWizardStepId = (typeof wizardSteps)[number];

/** RHF field paths validated before leaving each step (review validates full form on submit). */
export const stepTriggerFields: Record<TourCreateWizardStepId, readonly (keyof TourCreateFormValues | string)[]> = {
  basic: ["overview.title", "overview.shortDescription", "overview.longDescription"],
  theme: ["overview.mainTourThemeId", "overview.secondaryTourThemeIds"],
  capacity: ["pricing.basePrice", "logistics.groupSizeMin", "logistics.groupSizeMax"],
  location: ["schedule.startDate", "schedule.endDate", "location.mainDestinationId", "location.regionId"],
  itinerary: ["itinerary.days"],
  participation: [
    "participation.minimumAge",
    "participation.maximumAge",
    "participation.suitableFor",
    "participation.notSuitableFor",
    "participation.requiredExperienceLevel",
    "participation.requiredFitnessLevel",
  ],
  logistics: ["logistics.primaryTransportMode", "logistics.supplementalPrivateCar", "logistics.fuelShareToman"],
  policies: ["policies.cancellationPolicy", "policies.refundPolicy", "policies.safetyNotes"],
  review: [],
};

export const stepTitlesFa: Record<TourCreateWizardStepId, string> = {
  basic: "اطلاعات پایه",
  theme: "تم و برچسب‌ها",
  capacity: "قیمت و ظرفیت",
  location: "مکان و تاریخ",
  itinerary: "برنامه سفر",
  participation: "شرایط شرکت",
  logistics: "لجستیک",
  policies: "قوانین",
  review: "بازبینی و ثبت",
};
