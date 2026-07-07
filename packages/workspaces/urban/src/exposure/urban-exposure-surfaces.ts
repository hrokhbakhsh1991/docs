import type { NormalizedExposureTrigger } from "@app-tour/platform-core";

export const URBAN_EXPOSURE_SURFACE = Object.freeze({
  publicList: "public_list",
  publicDetails: "public_details",
} as const);

export type UrbanExposureSurface =
  (typeof URBAN_EXPOSURE_SURFACE)[keyof typeof URBAN_EXPOSURE_SURFACE];

export const URBAN_EXPOSURE_AUDIENCE = Object.freeze({
  public: "public",
} as const);

export type UrbanExposureAudience =
  (typeof URBAN_EXPOSURE_AUDIENCE)[keyof typeof URBAN_EXPOSURE_AUDIENCE];

export type UrbanExposureCoordinate = {
  readonly surface: UrbanExposureSurface | string;
  readonly audience: UrbanExposureAudience | string;
  readonly trigger: NormalizedExposureTrigger;
};

export const URBAN_PUBLIC_LIST_FIELD_IDS = Object.freeze([
  "tour.title",
  "tour.city",
  "tour.venueName",
  "tour.startDate",
  "tour.endDate",
  "tour.catalogSummary",
  "tour.coverImageUrl",
] as const);

export const URBAN_PUBLIC_DETAILS_FIELD_IDS = Object.freeze([
  ...URBAN_PUBLIC_LIST_FIELD_IDS,
  "tour.description",
  "tour.capacity",
] as const);

export function resolveUrbanSurfaceDefaultFieldIds(input: {
  readonly surface: string;
}): readonly string[] {
  if (input.surface === URBAN_EXPOSURE_SURFACE.publicList) {
    return URBAN_PUBLIC_LIST_FIELD_IDS;
  }
  if (input.surface === URBAN_EXPOSURE_SURFACE.publicDetails) {
    return URBAN_PUBLIC_DETAILS_FIELD_IDS;
  }
  return URBAN_PUBLIC_LIST_FIELD_IDS;
}

export function resolveUrbanExposureCoordinate(input: {
  readonly surface: string;
  readonly audience?: string;
}): UrbanExposureCoordinate {
  return {
    surface: input.surface,
    audience: input.audience ?? URBAN_EXPOSURE_AUDIENCE.public,
    trigger: { kind: "always" },
  };
}

export const URBAN_EXPOSURE_SURFACE_DEFINITIONS = Object.freeze([
  Object.freeze({
    surface: URBAN_EXPOSURE_SURFACE.publicList,
    audience: URBAN_EXPOSURE_AUDIENCE.public,
    triggerLabel: "always",
    defaultFieldIds: URBAN_PUBLIC_LIST_FIELD_IDS,
  }),
  Object.freeze({
    surface: URBAN_EXPOSURE_SURFACE.publicDetails,
    audience: URBAN_EXPOSURE_AUDIENCE.public,
    triggerLabel: "always",
    defaultFieldIds: URBAN_PUBLIC_DETAILS_FIELD_IDS,
  }),
] as const);
