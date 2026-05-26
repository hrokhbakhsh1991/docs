const DENALI_FIELD_FOCUS_SELECTORS: Record<string, string[]> = {
  "basicInfo.title": ['[data-field-path="basicInfo.title"]'],
  "basicInfo.tourType": ['[data-testid="denali-basics-category"]', '[data-testid="denali-basics-duration"]'],
  "basicInfo.destinationId": ['[data-field-path="basicInfo.destinationId"]'],
  "basicInfo.startDateTime": ['[data-field-path="basicInfo.startDateTime"]'],
  "basicInfo.endDateTime": ['[data-field-path="basicInfo.endDateTime"]'],
  "basicInfo.capacityMax": ['[data-field-path="basicInfo.capacityMax"]', '[data-testid="denali-basics-capacity-max"]'],
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
  "pricingPayment.basePricePerPerson": ['[data-field-path="pricingPayment.basePricePerPerson"]'],
  "pricingPayment.requiresPayment": ['[data-field-path="pricingPayment.requiresPayment"]'],
  "participantRequirements.minimumAge": ['[data-testid="denali-pricing-minimum-age"]'],
  "participantRequirements.maximumAge": ['[data-testid="denali-pricing-maximum-age"]'],
  "participantRequirements.fitnessLevel": ['[data-testid="denali-pricing-fitness-level"]'],
  "participantRequirements.sportsInsuranceRequired": ['[data-testid="denali-pricing-sports-insurance"]'],
  "tripDetails.logistics.gatheringPoints": ['[data-testid="denali-gathering-points-widget"]'],
  "photosData.photos": ['[data-testid="denali-photos-step"]'],
};

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
