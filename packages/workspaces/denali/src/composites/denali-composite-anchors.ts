import type { DenaliZodFieldKind } from "../field-registry/denaliFieldRegistryData";
import type { DenaliFieldDefinition } from "../field-registry/denaliFieldRegistryData";

/** zodKind → canonical anchor path; non-anchor rows are rendered by the composite widget. */
export const DENALI_COMPOSITE_ANCHOR_BY_ZOD_KIND: Partial<Record<DenaliZodFieldKind, string>> = {
  tourType: "category",
  locationData: "startPoint",
  gearItems: "participants.gearItems",
  gatheringPoints: "gatheringPoints",
  itinerary: "program.itinerary",
  transportMode: "transport.mode",
};

/** Composite anchor → dependent canonical paths rendered inside the same widget (INV-WIZ-002). */
export const DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR: Readonly<
  Record<string, readonly string[]>
> = Object.freeze({
  "program.themeIds": ["program.shortDescription", "program.longDescription"],
  "participants.minimumAge": [
    "participants.maximumAge",
    "participants.fitnessLevel",
    "participants.sportsInsuranceRequired",
    "participants.fitnessPrerequisiteText",
  ],
  "pricing.requiresPayment": ["pricing.basePricePerPerson", "pricing.includesTourInsurance"],
});

/** Paths rendered by a composite widget anchored on another registry row. */
export const DENALI_COMPOSITE_DEPENDENT_PATHS = new Set<string>([
  "duration",
  "eventVariant",
  "program.shortDescription",
  "program.longDescription",
  "summitPoint",
  "campPoint",
  "endPoint",
  "participants.maximumAge",
  "participants.fitnessLevel",
  "participants.sportsInsuranceRequired",
  "participants.fitnessPrerequisiteText",
  "transport.transportCost",
  "transport.allowPersonalCar",
  "transport.dongAmount",
  "transport.transportNotes",
  "transport.seatPreference",
  "transport.adminCapacityApproval",
  "pricing.basePricePerPerson",
  "pricing.includesTourInsurance",
  "tripDetails.logistics.excludedServices",
]);

export function shouldRenderDenaliRegistryField(field: DenaliFieldDefinition): boolean {
  if (DENALI_COMPOSITE_DEPENDENT_PATHS.has(field.canonicalPath)) {
    return false;
  }

  const anchor = field.zodKind ? DENALI_COMPOSITE_ANCHOR_BY_ZOD_KIND[field.zodKind] : undefined;
  if (anchor != null && field.canonicalPath !== anchor) {
    return false;
  }

  return true;
}
