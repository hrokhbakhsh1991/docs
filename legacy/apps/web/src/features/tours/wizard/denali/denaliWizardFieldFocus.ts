export const DENALI_FIELD_FOCUS_SELECTORS: Record<string, string[]> = {
  "basicInfo.title": ['[data-field-path="basicInfo.title"]'],
  "basicInfo.publishStatus": ['[data-field-path="basicInfo.publishStatus"]', '[data-testid="denali-review-publish-status"]'],
  "basicInfo.tourType": ['[data-testid="denali-basics-category"]', '[data-testid="denali-basics-duration"]'],
  "basicInfo.destinationId": ['[data-field-path="basicInfo.destinationId"]'],
  "basicInfo.startDateTime": ['[data-field-path="basicInfo.startDateTime"]'],
  "basicInfo.endDateTime": ['[data-field-path="basicInfo.endDateTime"]'],
  "basicInfo.capacityMax": ['[data-field-path="basicInfo.capacityMax"]'],
  "basicInfo.capacityMin": ['[data-field-path="basicInfo.capacityMin"]'],
  "programNature.shortDescription": ['[data-field-path="programNature.shortDescription"]'],
  "programNature.difficultyLevel": ['[data-testid="denali-program-difficulty-slider"]'],
  "programNature.hikingHoursApprox": ['[data-testid="denali-program-hiking-hours"]'],
  "tripDetails.overview.peakHeight": ['[data-testid="denali-basic-peak-height"]'],
  "tripDetails.metrics.elevationGain": ['[data-testid="denali-itinerary-elevation-gain"]'],
  "programNature.itinerary": ['[data-testid="denali-daily-itinerary"]'],
  "transport.transportMode": ['[data-field-path="transport.transportMode"]', '[data-testid="denali-transport-mode"]'],
  "transport.transportCost": ['[data-field-path="transport.transportCost"]', '[data-testid="denali-transport-cost"]'],
  "transport.dongAmount": ['[data-field-path="transport.dongAmount"]', '[data-testid="denali-transport-dong-amount"]'],
  "transport.allowPersonalCar": ['[data-testid="denali-transport-allow-personal-car"] input', '[data-testid="denali-transport-allow-personal-car"]'],
  "transport.adminCapacityApproval": ['[data-testid="denali-transport-admin-capacity-approval"] input', '[data-testid="denali-transport-admin-capacity-approval"]'],
  "pricingPayment.includesTourInsurance": [
    '[data-field-path="pricingPayment.includesTourInsurance"]',
    '[data-testid="denali-pricing-tour-insurance"]',
  ],
  "participantRequirements.minimumAge": ['[data-testid="denali-pricing-minimum-age"]'],
  "participantRequirements.maximumAge": ['[data-testid="denali-pricing-maximum-age"]'],
  "participantRequirements.fitnessLevel": ['[data-testid="denali-pricing-fitness-level"]'],
  "participantRequirements.sportsInsuranceRequired": [
    '[data-field-path="participantRequirements.sportsInsuranceRequired"]',
    '[data-testid="denali-pricing-sports-insurance"]',
  ],
  "basicInfo.startPoint": ['[data-testid="denali-location-zone-startPoint"]'],
  "tripDetails.logistics.gatheringPoints": ['[data-testid="denali-gathering-points-widget"]'],
  "photosData.photos": ['[data-testid="denali-photos-step"]'],
  "policies.policiesText": ['[data-field-path="policies.policiesText"]', '[data-testid="denali-legal-policies-notes"]'],
  "policies.cancellationDeadlineHours": [
    '[data-field-path="policies.cancellationDeadlineHours"]',
    '[data-testid="denali-legal-cancellation-hours"]',
  ],
  "policies.cancellationPenaltyPercentage": [
    '[data-field-path="policies.cancellationPenaltyPercentage"]',
    '[data-testid="denali-legal-cancellation-penalty"]',
  ],
  "basicInfo.approximateReturnTime": ['[data-testid="denali-basics-approx-return-time"]'],
  "basicInfo.leaderUserIds": ['[data-testid="denali-step-basics"]'],
  "basicInfo.requiresLocalGuide": ['[data-testid="denali-basics-requires-local-guide"]'],
  "basicInfo.localGuideName": ['[data-testid="denali-basics-local-guide-name"]'],
  "basicInfo.requiresManualAdminApproval": ['[data-testid="denali-basics-manual-admin-approval"]'],
  "basicInfo.socialMediaLink": ['[data-testid="denali-basics-social-media-link"]'],
  "basicInfo.meetingPoint": ['[data-testid="denali-step-basics"]'],
  "basicInfo.startPointLocationText": ['[data-testid="denali-step-basics"]'],
  "basicInfo.gatheringPoint": ['[data-testid="denali-location-zone-gatheringPoint"]'],
  "basicInfo.summitPoint": ['[data-testid="denali-location-zone-summitPoint"]'],
  "basicInfo.campPoint": ['[data-testid="denali-location-zone-campPoint"]'],
  "basicInfo.endPoint": ['[data-testid="denali-location-zone-endPoint"]'],
  "programNature.themeIds": ['[data-testid="denali-theme-list"]'],
  "programNature.longDescription": ['[data-field-path="programNature.longDescription"]'],
  "programNature.hikingGoHours": ['[data-testid="denali-program-hiking-go-hours"]'],
  "programNature.hikingReturnHours": ['[data-testid="denali-program-hiking-return-hours"]'],
  "participantRequirements.gearItems": ['[data-testid="denali-gear-list"]'],
  "participantRequirements.nationalIdRequired": ['[data-testid="denali-pricing-national-id"]'],
  "participantRequirements.fitnessPrerequisiteText": ['[data-testid="denali-pricing-fitness-prerequisite"]'],
  "participantRequirements.minRequiredPeaks": ['[data-testid="denali-pricing-min-required-peaks"]'],
  "pricingPayment.paymentMode": ['[data-testid="denali-step-pricing"]'],
  "pricingPayment.basePricePerPerson": [
    '[data-field-path="pricingPayment.basePricePerPerson"]',
    '[data-testid="denali-pricing-base-price"]',
  ],
  "pricingPayment.requiresPayment": [
    '[data-field-path="pricingPayment.requiresPayment"]',
    '[data-testid="denali-pricing-requires-payment"]',
  ],
  "transport.transportNotes": ['[data-testid="denali-step-logistics"]'],
  "transport.seatPreference": ['[data-testid="denali-step-logistics"]'],
  "tripDetails.overview.customServiceLabels": ['[data-testid="denali-custom-services"]'],
  "tripDetails.overview.nonAttendanceDetails": [
    '[data-field-path="tripDetails.overview.nonAttendanceDetails"]',
    '[data-testid="denali-non-attendance-details"]',
  ],
};

/** Registry RHF paths with an explicit focus selector entry (guard tests). */
export function getDenaliWizardFieldFocusMapKeys(): ReadonlySet<string> {
  return new Set(Object.keys(DENALI_FIELD_FOCUS_SELECTORS));
}

function stripFocusHighlights(): void {
  document.querySelectorAll("[data-denali-focus='true']").forEach((node) => {
    node.removeAttribute("data-denali-focus");
  });
}

function findFocusTarget(formPath: string): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const selectors = [
    ...(DENALI_FIELD_FOCUS_SELECTORS[formPath] ?? []),
    `[data-field-path="${formPath}"]`,
  ];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) {
      return el;
    }
  }

  const parts = formPath.split(".");
  for (let i = parts.length; i >= 1; i -= 1) {
    const partial = parts.slice(0, i).join(".");
    const el = document.querySelector(`[data-field-path="${partial}"]`);
    if (el instanceof HTMLElement) {
      return el;
    }
  }

  return null;
}

/** Scroll to a wizard field, apply a visible focus ring, and focus the control when possible. */
export function focusDenaliWizardField(formPath: string): void {
  if (typeof document === "undefined") return;

  stripFocusHighlights();

  const target = findFocusTarget(formPath);
  if (target == null) return;

  const fieldShell = target.closest("[class*='field']");
  if (fieldShell instanceof HTMLElement) {
    fieldShell.setAttribute("data-denali-focus", "true");
  }

  target.scrollIntoView({ behavior: "smooth", block: "center" });

  const focusable =
    target.matches("input, textarea, select, button")
      ? target
      : target.querySelector("input, textarea, select, button");

  if (focusable instanceof HTMLElement) {
    focusable.focus({ preventScroll: true });
  }
}

export function clearDenaliWizardFieldFocus(): void {
  stripFocusHighlights();
}
