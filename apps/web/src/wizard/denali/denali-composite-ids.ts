export const DENALI_IMPLEMENTED_COMPOSITE_IDS = [
  "denali.tour-kind-basics",
  "denali.destination",
  "denali.datetime",
  "denali.datetime-end",
  "denali.location-zones",
  "denali.gathering-points",
  "denali.transport-mode",
  "denali.difficulty-level",
  "denali.elevation-gain",
  "denali.gear",
  "denali.program-content",
  "denali.peak-experience",
  "denali.pricing-payment",
  "denali.pricing-participants",
  "denali.approximate-return-time",
  "denali.leader-user-ids",
  "denali.social-media-link",
  "denali.guide-language-ids",
  "denali.custom-services",
  "denali.tour-services",
  "denali.photos",
  "denali.itinerary",
] as const;

export type DenaliImplementedCompositeId = (typeof DENALI_IMPLEMENTED_COMPOSITE_IDS)[number];

export function isDenaliCompositeImplemented(compositeId: string): boolean {
  return (DENALI_IMPLEMENTED_COMPOSITE_IDS as readonly string[]).includes(compositeId);
}
