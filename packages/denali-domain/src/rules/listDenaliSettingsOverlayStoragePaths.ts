/**
 * Layer C — Settings overlay allow-list (section-bound paths only).
 * Drives the template builder grid and write-strict overlay validation.
 *
 * Phase 5 vocabulary: mirrors the modern Denali wizard UI inventory
 * (58 active controls → 51 canonicalData storage paths; 45 unique property paths
 * when array/zone patterns collapse once). See `ff7e1a16_modern.md`.
 *
 * Excludes review-only `publishStatus` and legacy ghosts with no staff input:
 * `startPointLocationText`, `pricing.paymentMode`, `transport.transportNotes`,
 * `transport.seatPreference`.
 */
export const DENALI_MODERN_SETTINGS_OVERLAY_STORAGE_PATHS = [
  "approximateReturnTime",
  "campPoint",
  "capacityMax",
  "capacityMin",
  "category",
  "duration",
  "customServiceLabels",
  "destinationId",
  "endDateTime",
  "endPoint",
  "gatheringPoints",
  "leaderUserIds",
  "localGuideName",
  "metrics.elevationGain",
  "overview.nonAttendanceDetails",
  "overview.peakHeight",
  "participants.fitnessLevel",
  "participants.fitnessPrerequisiteText",
  "participants.gearItems",
  "participants.maximumAge",
  "participants.minRequiredPeaks",
  "participants.minimumAge",
  "participants.nationalIdRequired",
  "participants.sportsInsuranceRequired",
  "photos",
  "policies.cancellationDeadlineHours",
  "policies.cancellationPenaltyPercentage",
  "policies.policiesText",
  "pricing.basePricePerPerson",
  "pricing.includesTourInsurance",
  "pricing.requiresPayment",
  "program.difficultyLevel",
  "program.hikingGoHours",
  "program.hikingHoursApprox",
  "program.hikingReturnHours",
  "program.itinerary",
  "program.longDescription",
  "program.shortDescription",
  "program.themeIds",
  "requiresLocalGuide",
  "requiresManualAdminApproval",
  "socialMediaLink",
  "startDateTime",
  "startPoint",
  "summitPoint",
  "title",
  "transport.adminCapacityApproval",
  "transport.allowPersonalCar",
  "transport.dongAmount",
  "transport.mode",
  "transport.transportCost",
] as const;

export function listDenaliSettingsOverlayStoragePaths(): readonly string[] {
  return DENALI_MODERN_SETTINGS_OVERLAY_STORAGE_PATHS;
}
