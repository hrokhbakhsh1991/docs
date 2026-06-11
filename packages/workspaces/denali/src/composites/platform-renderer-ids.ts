/**
 * Allowed renderer ids for Denali wizard fields (RULE-P6-014).
 *
 * - Primitives: resolved by platform-core / ui-primitives (Phase 2 mapping).
 * - `denali.*`: composite widgets registered by this plugin; React implementations land in 6.5 web bootstrap.
 */
export const PLATFORM_PRIMITIVE_RENDERER_IDS = [
  "text",
  "number",
  "date",
  "enum",
  "boolean",
] as const;

export type PlatformPrimitiveRendererId = (typeof PLATFORM_PRIMITIVE_RENDERER_IDS)[number];

export const DENALI_COMPOSITE_RENDERER_IDS = [
  "denali.tour-kind-basics",
  "denali.destination",
  "denali.datetime",
  "denali.datetime-end",
  "denali.transport-mode",
  "denali.difficulty-level",
  "denali.approximate-return-time",
  "denali.photos",
  "denali.itinerary",
  "denali.gathering-points",
  "denali.gear",
  "denali.location-zones",
  "denali.peak-experience",
  "denali.program-content",
  "denali.custom-services",
  "denali.leader-user-ids",
  "denali.elevation-gain",
  "denali.pricing-participants",
  "denali.pricing-payment",
] as const;

export type DenaliCompositeRendererId = (typeof DENALI_COMPOSITE_RENDERER_IDS)[number];

const PLATFORM_RENDERER_ID_SET = new Set<string>([
  ...PLATFORM_PRIMITIVE_RENDERER_IDS,
  ...DENALI_COMPOSITE_RENDERER_IDS,
]);

export function isPlatformRendererId(
  value: string
): value is PlatformPrimitiveRendererId | DenaliCompositeRendererId {
  return PLATFORM_RENDERER_ID_SET.has(value);
}

export const PLATFORM_RENDERER_IDS = Object.freeze([
  ...PLATFORM_PRIMITIVE_RENDERER_IDS,
  ...DENALI_COMPOSITE_RENDERER_IDS,
]) as readonly string[];
