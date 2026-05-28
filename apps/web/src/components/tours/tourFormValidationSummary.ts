import type { FieldErrors } from "react-hook-form";

import { flattenDenaliFormErrors } from "@/features/tours/wizard/denali/flattenDenaliFormErrors";

export type TourFormValidationIssue = {
  path: string;
  label: string;
  message: string;
};

export type TourFormErrorLabelContext = {
  tNew: (_key: string, _values?: Record<string, string | number>) => string;
  tDenali: (_key: string, _values?: Record<string, string | number>) => string;
  tForm: (_key: string, _values?: Record<string, string | number>) => string;
};

const TRIP_DETAILS_LABEL_KEYS: Record<string, string> = {
  "overview.mainDestination": "trip_mainDestinationLabel",
  "overview.destinationRegion": "trip_destinationRegionLabel",
  "overview.tripStyles": "trip_tripStyleLabel",
  "overview.difficultyLevel": "trip_difficultyLevelLabel",
  "overview.elevationGainMeters": "trip_elevationGainMetersLabel",
  "overview.maxAltitudeMeters": "trip_maxAltitudeMetersLabel",
  "overview.tourThemeIds": "trip_tourThemesLabel",
  "overview.shortIntro": "trip_shortIntroLabel",
  "overview.leaderUserIds": "basic.workspaceLeaders",
  "itinerary.highlights": "trip_highlightsLabel",
  "itinerary.includedVisits": "trip_includedVisitsLabel",
  "itinerary.excludedVisits": "trip_excludedVisitsLabel",
  "itinerary.optionalActivities": "trip_optionalActivitiesLabel",
  "itinerary.outline": "trip_itineraryOutlineLabel",
  "itinerary.programNotes": "trip_programNotesLabel",
  "itinerary.specialExperiences": "trip_specialExperiencesLabel",
  "logistics.meetingPoint": "trip_meetingPointLabel",
  "logistics.departureMeetingTime": "trip_departureMeetingTimeLabel",
  "logistics.departureDate": "trip_departureDateLabel",
  "logistics.returnDate": "trip_returnDateLabel",
  "logistics.returnPoint": "trip_returnPointLabel",
  "logistics.transportationNotes": "trip_transportationNotesLabel",
  "logistics.accommodationTypes": "trip_accommodationTypesLabel",
  "logistics.accommodationNotes": "trip_accommodationNotesLabel",
  "logistics.mealPlan": "trip_mealPlanLabel",
  "logistics.mealNotes": "trip_mealNotesLabel",
  "logistics.supportServices": "trip_supportServicesLabel",
  "logistics.includedServices": "trip_includedServicesLabel",
  "logistics.excludedServices": "trip_excludedServicesLabel",
  "logistics.optionalServices": "trip_optionalServicesLabel",
  "logistics.guideLanguageIds": "trip_guideLanguagesLabel",
  "logistics.groupSizeMin": "trip_groupSizeMinLabel",
  "logistics.groupSizeMax": "trip_groupSizeMaxLabel",
  "logistics.gatheringPoints": "gatheringPoints",
  "participation.minimumAge": "trip_minimumAgeLabel",
  "participation.maximumAge": "trip_maximumAgeLabel",
  "participation.genderRestriction": "trip_genderRestrictionLabel",
  "participation.fitnessLevel": "trip_fitnessLabel",
  "participation.experienceLevel": "trip_experienceLevelLabel",
  "participation.technicalSkillRequired": "trip_technicalSkillLabel",
  "participation.requirements": "trip_requirementsLabel",
  "participation.skillsRequired": "trip_skillsRequiredLabel",
  "participation.gearRequiredIds": "trip_gearRequiredLabel",
  "participation.gearOptionalIds": "trip_gearOptionalLabel",
  "participation.medicalRestrictions": "trip_medicalRestrictionsLabel",
  "participation.documentsRequired": "trip_documentsRequiredLabel",
  "participation.suitableFor": "trip_audienceMatrixLabel",
  "participation.notSuitableFor": "trip_audienceMatrixLabel",
  "participation.registrationNationalIdRequired": "participants.nationalIdRequired",
  "participation.sportsInsuranceRequired": "participants.sportsInsurance",
  "requirements.minRequiredPeaks": "minRequiredPeaks",
  "policies.reservationRules": "trip_reservationRulesLabel",
  "policies.cancellationPolicy": "trip_cancellationPolicyLabel",
  "policies.refundPolicy": "trip_refundPolicyLabel",
  "policies.attendanceRules": "trip_attendanceRulesLabel",
  "policies.lateArrivalPolicy": "trip_lateArrivalPolicyLabel",
  "policies.noShowPolicy": "trip_noShowPolicyLabel",
  "policies.confirmationPolicy": "trip_confirmationPolicyLabel",
  "policies.capacityPolicy": "trip_capacityPolicyLabel",
  "policies.weatherPolicy": "trip_weatherPolicyLabel",
  "policies.safetyPolicy": "trip_safetyPolicyLabel",
};

const DENALI_ZONE_KEYS = new Set([
  "gatheringPoint",
  "startPoint",
  "summitPoint",
  "campPoint",
  "endPoint",
]);

const TOP_LEVEL_FORM_KEYS: Record<string, string> = {
  title: "fieldTitle",
  description: "fieldDescription",
  totalCapacity: "fieldCapacity",
  price: "fieldPrice",
  status: "fieldLifecycle",
  communicationLink: "fieldCommunicationLink",
  destinationId: "fieldDestination",
  tourType: "fieldTourType",
};

function stripTrailingFieldSegment(path: string): string {
  const parts = path.split(".");
  if (parts.length <= 1) {
    return path;
  }
  const leaf = parts[parts.length - 1]!;
  if (leaf === "message" || leaf === "type" || leaf === "ref") {
    return parts.slice(0, -1).join(".");
  }
  if (["addressText", "latitude", "longitude", "title", "time", "location"].includes(leaf)) {
    return parts.slice(0, -1).join(".");
  }
  return path;
}

function resolveTripDetailsLabel(withoutRoot: string, ctx: TourFormErrorLabelContext): string | null {
  const gatheringMatch = withoutRoot.match(/^logistics\.gatheringPoints(?:\.(\d+))?$/);
  if (gatheringMatch) {
    if (gatheringMatch[1] != null) {
      const index = Number.parseInt(gatheringMatch[1], 10);
      if (Number.isFinite(index)) {
        return ctx.tForm("gatheringPointIndex", { index: index + 1 });
      }
    }
    return ctx.tForm("gatheringPoints");
  }

  const zoneMatch = withoutRoot.match(/^overview\.(gatheringPoint|startPoint|summitPoint|campPoint|endPoint)/);
  if (zoneMatch && DENALI_ZONE_KEYS.has(zoneMatch[1]!)) {
    return ctx.tDenali(`basic.locationZones.${zoneMatch[1]}`);
  }

  const directKey = TRIP_DETAILS_LABEL_KEYS[withoutRoot];
  if (directKey) {
    if (directKey === "gatheringPoints") {
      return ctx.tForm("gatheringPoints");
    }
    if (directKey === "minRequiredPeaks") {
      return ctx.tForm("minRequiredPeaks");
    }
    if (directKey.startsWith("participants.") || directKey.startsWith("basic.")) {
      return ctx.tDenali(directKey);
    }
    return ctx.tNew(directKey);
  }

  const parentKey = withoutRoot.split(".").slice(0, 2).join(".");
  const parentLabelKey = TRIP_DETAILS_LABEL_KEYS[parentKey];
  if (parentLabelKey) {
    if (parentLabelKey.startsWith("participants.") || parentLabelKey.startsWith("basic.")) {
      return ctx.tDenali(parentLabelKey);
    }
    if (parentLabelKey === "gatheringPoints") {
      return ctx.tForm("gatheringPoints");
    }
    if (parentLabelKey === "minRequiredPeaks") {
      return ctx.tForm("minRequiredPeaks");
    }
    return ctx.tNew(parentLabelKey);
  }

  return null;
}

export function labelTourFormErrorPath(path: string, ctx: TourFormErrorLabelContext): string {
  const topKey = TOP_LEVEL_FORM_KEYS[path];
  if (topKey) {
    if (topKey === "fieldCommunicationLink") {
      return ctx.tForm("communicationLink");
    }
    if (topKey === "fieldDestination") {
      return ctx.tForm("destination");
    }
    return ctx.tNew(topKey);
  }

  if (path.startsWith("locationSection.")) {
    return ctx.tForm(path.slice("locationSection.".length));
  }

  const normalized = stripTrailingFieldSegment(path);
  if (normalized.startsWith("tripDetails.")) {
    const tripLabel = resolveTripDetailsLabel(normalized.slice("tripDetails.".length), ctx);
    if (tripLabel) {
      return tripLabel;
    }
  }

  return ctx.tForm("unknownField", { path });
}

export function collectTourFormValidationIssues(
  errors: FieldErrors | undefined,
  ctx: TourFormErrorLabelContext,
): TourFormValidationIssue[] {
  return flattenDenaliFormErrors(errors)
    .filter((entry) => entry.path !== "root")
    .map((entry) => ({
      path: entry.path,
      label: labelTourFormErrorPath(entry.path, ctx),
      message: entry.message,
    }));
}

export function scrollTourFormToFirstError(issues: readonly TourFormValidationIssue[]): void {
  if (typeof document === "undefined" || issues.length === 0) {
    return;
  }

  for (const { path } of issues) {
    for (const selector of buildScrollSelectors(path)) {
      const el = document.querySelector(selector);
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (el.matches("input, textarea, select, button")) {
          el.focus({ preventScroll: true });
        }
        return;
      }
    }
  }
}

function buildScrollSelectors(path: string): string[] {
  const selectors: string[] = [];
  const gatheringMatch = path.match(/^tripDetails\.logistics\.gatheringPoints(?:\.(\d+))?/);
  if (gatheringMatch) {
    if (gatheringMatch[1] != null) {
      selectors.push(`[data-testid="denali-gathering-point-${gatheringMatch[1]}"]`);
    }
    selectors.push('[data-testid="denali-gathering-points-widget"]');
  }

  const zoneMatch = path.match(/^tripDetails\.overview\.(gatheringPoint|startPoint|summitPoint|campPoint|endPoint)/);
  if (zoneMatch) {
    selectors.push(`[data-testid="tour-edit-denali-zone-${zoneMatch[1]}"]`);
  }

  const parts = path.split(".");
  for (let i = parts.length; i >= 1; i -= 1) {
    selectors.push(`[data-field-path="${parts.slice(0, i).join(".")}"]`);
  }

  selectors.push(`[name="${path}"]`);
  return selectors;
}
