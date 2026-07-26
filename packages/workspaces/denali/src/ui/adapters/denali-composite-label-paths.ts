/**
 * Composite renderer ids → anchor canonical path for field labels (INV-WIZ-002 widgets).
 * Shared by translator-based and messages-object label resolvers.
 */
export const DENALI_COMPOSITE_LABEL_CANONICAL_PATH: Readonly<Record<string, string>> = {
  "denali.destination": "destinationId",
  "denali.datetime": "startDateTime",
  "denali.datetime-end": "endDateTime",
  "denali.tour-kind-basics": "category",
  "denali.transport-mode": "transport.mode",
  "denali.difficulty-level": "program.difficultyLevel",
  "denali.elevation-gain": "tripDetails.metrics.elevationGain",
  "denali.pricing-participants": "participants.minimumAge",
  "denali.pricing-payment": "pricing.requiresPayment",
  "denali.peak-experience": "participants.minRequiredPeaks",
  "denali.approximate-return-time": "approximateReturnTime",
  "denali.program-content": "program.themeIds",
  "denali.itinerary": "program.itinerary",
  "denali.photos": "photos",
  "denali.gear": "participants.gearItems",
  "denali.gathering-points": "gatheringPoints",
  "denali.location-zones": "startPoint",
  "denali.leader-user-ids": "leaderUserIds",
  "denali.social-media-link": "socialMediaLink",
  "denali.guide-language-ids": "program.guideLanguageIds",
  "denali.custom-services": "tripDetails.overview.customServiceLabels",
  "denali.tour-services": "tripDetails.logistics.includedServices",
};

export function compositeIdToSectionTitleMessageKey(compositeId: string): string {
  const slug = compositeId.replace(/^denali\./, "");
  const camel = slug.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
  return `composites.${camel}.sectionTitle`;
}
