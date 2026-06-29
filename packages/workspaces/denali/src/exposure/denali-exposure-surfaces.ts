import type { NormalizedExposureTrigger } from "@app-tour/platform-core";

/** Registry field ids eligible for integration delivery in Denali. */
export const DENALI_DELIVERABLE_FIELD_IDS = Object.freeze([
  "title",
  "denali.destination",
  "denali.datetime",
  "denali.datetime-end",
  "denali.approximate-return-time",
  "meetingPoint",
  "startPointLocationText",
  "capacityMax",
  "capacityMin",
  "denali.pricing-participants",
  "denali.pricing-payment",
  "denali.photos",
] as const);

export const DENALI_EXPOSURE_SURFACE = Object.freeze({
  telegram: "telegram",
  publicList: "public_list",
  publicDetails: "public_details",
  userDashboard: "user_dashboard",
  reminderFeed: "reminder_feed",
} as const);

export type DenaliExposureSurface =
  (typeof DENALI_EXPOSURE_SURFACE)[keyof typeof DENALI_EXPOSURE_SURFACE];

export const DENALI_EXPOSURE_AUDIENCE = Object.freeze({
  externalChannel: "external_channel",
  public: "public",
  registeredUser: "registered_user",
} as const);

export type DenaliExposureAudience =
  (typeof DENALI_EXPOSURE_AUDIENCE)[keyof typeof DENALI_EXPOSURE_AUDIENCE];

export type DenaliExposureCoordinate = {
  readonly surface: DenaliExposureSurface | string;
  readonly audience: DenaliExposureAudience | string;
  readonly trigger: NormalizedExposureTrigger;
};

export const DENALI_PUBLIC_LIST_FIELD_IDS = Object.freeze([
  "title",
  "denali.destination",
  "denali.datetime",
  "denali.datetime-end",
  "capacityMax",
  "denali.pricing-participants",
  "denali.photos",
] as const);

export const DENALI_PUBLIC_DETAILS_FIELD_IDS = Object.freeze([
  ...DENALI_PUBLIC_LIST_FIELD_IDS,
  "meetingPoint",
  "startPointLocationText",
  "denali.approximate-return-time",
] as const);

export const DENALI_USER_DASHBOARD_FIELD_IDS = Object.freeze([
  "title",
  "denali.destination",
  "denali.datetime",
  "denali.datetime-end",
  "meetingPoint",
  "startPointLocationText",
  "denali.approximate-return-time",
  "capacityMax",
  "capacityMin",
  "denali.pricing-participants",
  "denali.pricing-payment",
] as const);

export const DENALI_REMINDER_FEED_FIELD_IDS = Object.freeze([
  "title",
  "denali.destination",
  "denali.datetime",
  "meetingPoint",
  "startPointLocationText",
  "denali.approximate-return-time",
] as const);

export const DENALI_REMINDER_OFFSETS = Object.freeze(["-48h", "-24h"] as const);
export type DenaliReminderOffset = (typeof DENALI_REMINDER_OFFSETS)[number];

export function buildDenaliRelativeTimeTrigger(offset: DenaliReminderOffset): NormalizedExposureTrigger {
  return Object.freeze({
    kind: "relative_time",
    anchor: "startDateTime",
    offset,
  });
}

export function resolveDenaliSurfaceDefaultFieldIds(input: {
  readonly surface: string;
  readonly audience: string;
  readonly trigger: NormalizedExposureTrigger;
}): readonly string[] {
  if (input.surface === DENALI_EXPOSURE_SURFACE.telegram) {
    return DENALI_DELIVERABLE_FIELD_IDS;
  }
  if (input.surface === DENALI_EXPOSURE_SURFACE.publicList) {
    return DENALI_PUBLIC_LIST_FIELD_IDS;
  }
  if (input.surface === DENALI_EXPOSURE_SURFACE.publicDetails) {
    return DENALI_PUBLIC_DETAILS_FIELD_IDS;
  }
  if (input.surface === DENALI_EXPOSURE_SURFACE.userDashboard) {
    return DENALI_USER_DASHBOARD_FIELD_IDS;
  }
  if (input.surface === DENALI_EXPOSURE_SURFACE.reminderFeed) {
    return DENALI_REMINDER_FEED_FIELD_IDS;
  }
  return DENALI_DELIVERABLE_FIELD_IDS;
}

export function resolveDenaliExposureCoordinate(input: {
  readonly surface: string;
  readonly audience?: string;
  readonly eventType?: string;
  readonly reminderOffset?: DenaliReminderOffset;
}): DenaliExposureCoordinate {
  if (input.reminderOffset !== undefined) {
    return {
      surface: DENALI_EXPOSURE_SURFACE.reminderFeed,
      audience: DENALI_EXPOSURE_AUDIENCE.registeredUser,
      trigger: buildDenaliRelativeTimeTrigger(input.reminderOffset),
    };
  }
  if (input.surface === DENALI_EXPOSURE_SURFACE.publicList) {
    return {
      surface: input.surface,
      audience: input.audience ?? DENALI_EXPOSURE_AUDIENCE.public,
      trigger: { kind: "always" },
    };
  }
  if (input.surface === DENALI_EXPOSURE_SURFACE.publicDetails) {
    return {
      surface: input.surface,
      audience: input.audience ?? DENALI_EXPOSURE_AUDIENCE.public,
      trigger: { kind: "always" },
    };
  }
  if (input.surface === DENALI_EXPOSURE_SURFACE.userDashboard) {
    return {
      surface: input.surface,
      audience: input.audience ?? DENALI_EXPOSURE_AUDIENCE.registeredUser,
      trigger: { kind: "event", name: "tour_dashboard_view" },
    };
  }
  if (input.surface === DENALI_EXPOSURE_SURFACE.telegram) {
    return {
      surface: input.surface,
      audience: input.audience ?? DENALI_EXPOSURE_AUDIENCE.externalChannel,
      trigger: { kind: "event", name: input.eventType ?? "TourCreated" },
    };
  }
  return {
    surface: input.surface,
    audience: input.audience ?? DENALI_EXPOSURE_AUDIENCE.public,
    trigger: { kind: "always" },
  };
}

export const DENALI_EXPOSURE_SURFACE_DEFINITIONS = Object.freeze([
  Object.freeze({
    surface: DENALI_EXPOSURE_SURFACE.telegram,
    audience: DENALI_EXPOSURE_AUDIENCE.externalChannel,
    triggerLabel: "TourCreated",
    defaultFieldIds: DENALI_DELIVERABLE_FIELD_IDS,
  }),
  Object.freeze({
    surface: DENALI_EXPOSURE_SURFACE.publicList,
    audience: DENALI_EXPOSURE_AUDIENCE.public,
    triggerLabel: "always",
    defaultFieldIds: DENALI_PUBLIC_LIST_FIELD_IDS,
  }),
  Object.freeze({
    surface: DENALI_EXPOSURE_SURFACE.publicDetails,
    audience: DENALI_EXPOSURE_AUDIENCE.public,
    triggerLabel: "always",
    defaultFieldIds: DENALI_PUBLIC_DETAILS_FIELD_IDS,
  }),
  Object.freeze({
    surface: DENALI_EXPOSURE_SURFACE.userDashboard,
    audience: DENALI_EXPOSURE_AUDIENCE.registeredUser,
    triggerLabel: "tour_dashboard_view",
    defaultFieldIds: DENALI_USER_DASHBOARD_FIELD_IDS,
  }),
  Object.freeze({
    surface: DENALI_EXPOSURE_SURFACE.reminderFeed,
    audience: DENALI_EXPOSURE_AUDIENCE.registeredUser,
    triggerLabel: "relative_to_tour_start",
    defaultFieldIds: DENALI_REMINDER_FEED_FIELD_IDS,
  }),
] as const);
