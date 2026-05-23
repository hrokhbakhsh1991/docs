/**
 * Denali rule engine — UI visibility and required state only (Phase 3+).
 *
 * Pure static data: which fields are visible/required per category × duration.
 * Validation lives in Zod ({@link ../validation/denaliWizardFormZod.ts}).
 */

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";

export const DENALI_RULE_MODEL_CATEGORIES = [
  "mountain",
  "nature",
  "desert",
  "event",
] as const;

export type DenaliRuleModelCategory = (typeof DENALI_RULE_MODEL_CATEGORIES)[number];

export const DENALI_RULE_MODEL_DURATIONS = ["single_day", "multi_day"] as const;

export type DenaliRuleModelDuration = (typeof DENALI_RULE_MODEL_DURATIONS)[number];

/** Wizard rail step id — field ownership matches {@link DenaliCreateWizardStepId} only (placement v1). */
export type DenaliRuleFieldStep = DenaliCreateWizardStepId;

export interface DenaliRuleFieldDefinition {
  /** Dot path on `DenaliCreateTourWizardForm`. */
  path: string;
  required: boolean;
  hidden: boolean;
  step: DenaliRuleFieldStep;
}

export interface DenaliRuleModel {
  category: DenaliRuleModelCategory;
  duration: DenaliRuleModelDuration;
  fields: readonly DenaliRuleFieldDefinition[];
}

export type DenaliRuleSet = {
  readonly [C in DenaliRuleModelCategory]: {
    readonly [D in DenaliRuleModelDuration]: DenaliRuleModel | null;
  };
};

export type DenaliRuleModelKey = `${DenaliRuleModelCategory}:${DenaliRuleModelDuration}`;

export const DENALI_RULE_MODEL_VERSION = "1.1.0" as const;

/** Single field row for `path` (models enforce unique paths at load). */
export function findDenaliRuleField(
  model: DenaliRuleModel,
  path: string,
): DenaliRuleFieldDefinition | undefined {
  return model.fields.find((field) => field.path === path);
}

const TITLE_FIELD: DenaliRuleFieldDefinition = {
  path: "title",
  required: true,
  hidden: false,
  step: "denali_basic",
};

const CATEGORY_FIELD: DenaliRuleFieldDefinition = {
  path: "category",
  required: true,
  hidden: false,
  step: "denali_basic",
};

const DESTINATION_FIELD: DenaliRuleFieldDefinition = {
  path: "destinationId",
  required: true,
  hidden: false,
  step: "denali_basic",
};

const START_DATETIME_FIELD: DenaliRuleFieldDefinition = {
  path: "startDateTime",
  required: true,
  hidden: false,
  step: "denali_basic",
};

const END_DATETIME_VISIBLE_REQUIRED: DenaliRuleFieldDefinition = {
  path: "endDateTime",
  required: true,
  hidden: false,
  step: "denali_basic",
};

const END_DATETIME_HIDDEN: DenaliRuleFieldDefinition = {
  path: "endDateTime",
  required: false,
  hidden: true,
  step: "denali_basic",
};

const CAPACITY_MAX_FIELD: DenaliRuleFieldDefinition = {
  path: "capacityMax",
  required: true,
  hidden: false,
  step: "denali_basic",
};

const CAPACITY_MIN_FIELD: DenaliRuleFieldDefinition = {
  path: "capacityMin",
  required: false,
  hidden: false,
  step: "denali_basic",
};

const MEETING_POINT_FIELD: DenaliRuleFieldDefinition = {
  path: "meetingPoint",
  required: false,
  hidden: false,
  step: "denali_basic",
};

const START_POINT_LOCATION_FIELD: DenaliRuleFieldDefinition = {
  path: "startPointLocationText",
  required: false,
  hidden: false,
  step: "denali_basic",
};

const APPROXIMATE_RETURN_TIME_FIELD: DenaliRuleFieldDefinition = {
  path: "approximateReturnTime",
  required: false,
  hidden: false,
  step: "denali_basic",
};

const LEADER_USER_IDS_FIELD: DenaliRuleFieldDefinition = {
  path: "leaderUserIds",
  required: false,
  hidden: false,
  step: "denali_basic",
};

const REQUIRES_LOCAL_GUIDE_FIELD: DenaliRuleFieldDefinition = {
  path: "requiresLocalGuide",
  required: false,
  hidden: false,
  step: "denali_basic",
};

const LOCAL_GUIDE_NAME_FIELD: DenaliRuleFieldDefinition = {
  path: "localGuideName",
  required: false,
  hidden: false,
  step: "denali_basic",
};

const THEME_IDS_FIELD: DenaliRuleFieldDefinition = {
  path: "program.themeIds",
  required: false,
  hidden: false,
  step: "denali_program",
};

const SHORT_DESCRIPTION_FIELD: DenaliRuleFieldDefinition = {
  path: "program.shortDescription",
  required: true,
  hidden: false,
  step: "denali_program",
};

const LONG_DESCRIPTION_FIELD: DenaliRuleFieldDefinition = {
  path: "program.longDescription",
  required: false,
  hidden: false,
  step: "denali_program",
};

const DIFFICULTY_OUTDOOR: DenaliRuleFieldDefinition = {
  path: "program.difficultyLevel",
  required: true,
  hidden: false,
  step: "denali_program",
};

const HIKING_OUTDOOR: DenaliRuleFieldDefinition = {
  path: "program.hikingHoursApprox",
  required: true,
  hidden: false,
  step: "denali_program",
};

const DIFFICULTY_HIDDEN: DenaliRuleFieldDefinition = {
  path: "program.difficultyLevel",
  required: false,
  hidden: true,
  step: "denali_program",
};

const HIKING_HIDDEN: DenaliRuleFieldDefinition = {
  path: "program.hikingHoursApprox",
  required: false,
  hidden: true,
  step: "denali_program",
};

const HIKING_GO_OUTDOOR: DenaliRuleFieldDefinition = {
  path: "program.hikingGoHours",
  required: false,
  hidden: false,
  step: "denali_program",
};

const HIKING_RETURN_OUTDOOR: DenaliRuleFieldDefinition = {
  path: "program.hikingReturnHours",
  required: false,
  hidden: false,
  step: "denali_program",
};

const HIKING_GO_HIDDEN: DenaliRuleFieldDefinition = {
  path: "program.hikingGoHours",
  required: false,
  hidden: true,
  step: "denali_program",
};

const HIKING_RETURN_HIDDEN: DenaliRuleFieldDefinition = {
  path: "program.hikingReturnHours",
  required: false,
  hidden: true,
  step: "denali_program",
};

const ALTITUDE_MOUNTAIN: DenaliRuleFieldDefinition = {
  path: "program.altitudeMeasurement",
  required: true,
  hidden: false,
  step: "denali_program",
};

const ALTITUDE_HIDDEN: DenaliRuleFieldDefinition = {
  path: "program.altitudeMeasurement",
  required: false,
  hidden: true,
  step: "denali_program",
};

const ITINERARY_VISIBLE: DenaliRuleFieldDefinition = {
  path: "program.itinerary",
  required: true,
  hidden: false,
  step: "denali_program",
};

const ITINERARY_HIDDEN: DenaliRuleFieldDefinition = {
  path: "program.itinerary",
  required: false,
  hidden: true,
  step: "denali_program",
};

const GEAR_ITEMS_FIELD: DenaliRuleFieldDefinition = {
  path: "participants.gearItems",
  required: false,
  hidden: false,
  step: "denali_pricing",
};

const TRANSPORT_MODE_FIELD: DenaliRuleFieldDefinition = {
  path: "transport.mode",
  required: true,
  hidden: false,
  step: "denali_logistics",
};

const TRANSPORT_COST_FIELD: DenaliRuleFieldDefinition = {
  path: "transport.transportCost",
  required: false,
  hidden: false,
  step: "denali_logistics",
};

const ALLOW_PERSONAL_CAR_FIELD: DenaliRuleFieldDefinition = {
  path: "transport.allowPersonalCar",
  required: false,
  hidden: false,
  step: "denali_logistics",
};

const DONG_AMOUNT_FIELD: DenaliRuleFieldDefinition = {
  path: "transport.dongAmount",
  required: false,
  hidden: false,
  step: "denali_logistics",
};

const TRANSPORT_NOTES_FIELD: DenaliRuleFieldDefinition = {
  path: "transport.transportNotes",
  required: false,
  hidden: false,
  step: "denali_logistics",
};

const REQUIRES_PAYMENT_FIELD: DenaliRuleFieldDefinition = {
  path: "pricing.requiresPayment",
  required: false,
  hidden: false,
  step: "denali_pricing",
};

const BASE_PRICE_PER_PERSON_FIELD: DenaliRuleFieldDefinition = {
  path: "pricing.basePricePerPerson",
  required: false,
  hidden: false,
  step: "denali_pricing",
};

const SOCIAL_MEDIA_LINK_FIELD: DenaliRuleFieldDefinition = {
  path: "socialMediaLink",
  required: false,
  hidden: false,
  step: "denali_basic",
};

const MANUAL_ADMIN_APPROVAL_FIELD: DenaliRuleFieldDefinition = {
  path: "requiresManualAdminApproval",
  required: false,
  hidden: false,
  step: "denali_basic",
};

const PUBLISH_STATUS_FIELD: DenaliRuleFieldDefinition = {
  path: "publishStatus",
  required: true,
  hidden: false,
  step: "denali_basic",
};

const NATIONAL_ID_REQUIRED_FIELD: DenaliRuleFieldDefinition = {
  path: "participants.nationalIdRequired",
  required: false,
  hidden: false,
  step: "denali_pricing",
};

const CANCELLATION_DEADLINE_FIELD: DenaliRuleFieldDefinition = {
  path: "policies.cancellationDeadlineHours",
  required: false,
  hidden: false,
  step: "denali_pricing",
};

const CANCELLATION_PENALTY_FIELD: DenaliRuleFieldDefinition = {
  path: "policies.cancellationPenaltyPercentage",
  required: false,
  hidden: false,
  step: "denali_pricing",
};

const PAYMENT_MODE_FIELD: DenaliRuleFieldDefinition = {
  path: "pricing.paymentMode",
  required: true,
  hidden: false,
  step: "denali_pricing",
};

const MOUNTAIN_MIN_AGE: DenaliRuleFieldDefinition = {
  path: "participants.minimumAge",
  required: true,
  hidden: false,
  step: "denali_pricing",
};

const MOUNTAIN_MAX_AGE: DenaliRuleFieldDefinition = {
  path: "participants.maximumAge",
  required: false,
  hidden: false,
  step: "denali_pricing",
};

const MOUNTAIN_FITNESS: DenaliRuleFieldDefinition = {
  path: "participants.fitnessLevel",
  required: true,
  hidden: false,
  step: "denali_pricing",
};

const MOUNTAIN_INSURANCE: DenaliRuleFieldDefinition = {
  path: "participants.sportsInsuranceRequired",
  required: true,
  hidden: false,
  step: "denali_pricing",
};

const MOUNTAIN_FITNESS_PREREQUISITE: DenaliRuleFieldDefinition = {
  path: "participants.fitnessPrerequisiteText",
  required: false,
  hidden: false,
  step: "denali_pricing",
};

/** Mountain review/submit participant gates (one definition per path). */
const MOUNTAIN_PARTICIPANT_SUBMIT_FIELDS: readonly DenaliRuleFieldDefinition[] = [
  MOUNTAIN_MIN_AGE,
  MOUNTAIN_MAX_AGE,
  MOUNTAIN_FITNESS,
  MOUNTAIN_INSURANCE,
  MOUNTAIN_FITNESS_PREREQUISITE,
];

/** Non-mountain: hide all participant paths so normalize clears kind-switch leftovers. */
const NON_MOUNTAIN_PARTICIPANT_HIDDEN_FIELDS: readonly DenaliRuleFieldDefinition[] = [
  {
    path: "participants.minimumAge",
    required: false,
    hidden: true,
    step: "denali_pricing",
  },
  {
    path: "participants.maximumAge",
    required: false,
    hidden: true,
    step: "denali_pricing",
  },
  {
    path: "participants.fitnessLevel",
    required: false,
    hidden: true,
    step: "denali_pricing",
  },
  {
    path: "participants.sportsInsuranceRequired",
    required: false,
    hidden: true,
    step: "denali_pricing",
  },
  {
    path: "participants.fitnessPrerequisiteText",
    required: false,
    hidden: true,
    step: "denali_pricing",
  },
];

const POLICIES_TEXT_FIELD: DenaliRuleFieldDefinition = {
  path: "policies.policiesText",
  required: false,
  hidden: false,
  step: "denali_pricing",
};

const PHOTOS_FIELD: DenaliRuleFieldDefinition = {
  path: "photos",
  required: false,
  hidden: false,
  step: "denali_photos",
};

const OUTDOOR_PROGRAM_FIELDS: readonly DenaliRuleFieldDefinition[] = [
  DIFFICULTY_OUTDOOR,
  HIKING_OUTDOOR,
  HIKING_GO_OUTDOOR,
  HIKING_RETURN_OUTDOOR,
];

const EVENT_HIDDEN_PROGRAM_FIELDS: readonly DenaliRuleFieldDefinition[] = [
  DIFFICULTY_HIDDEN,
  HIKING_HIDDEN,
  HIKING_GO_HIDDEN,
  HIKING_RETURN_HIDDEN,
];

const OPTIONAL_BASIC_FIELDS: readonly DenaliRuleFieldDefinition[] = [
  CAPACITY_MIN_FIELD,
  MEETING_POINT_FIELD,
  START_POINT_LOCATION_FIELD,
  SOCIAL_MEDIA_LINK_FIELD,
  APPROXIMATE_RETURN_TIME_FIELD,
  LEADER_USER_IDS_FIELD,
  REQUIRES_LOCAL_GUIDE_FIELD,
  LOCAL_GUIDE_NAME_FIELD,
  MANUAL_ADMIN_APPROVAL_FIELD,
];

const OPTIONAL_PROGRAM_FIELDS: readonly DenaliRuleFieldDefinition[] = [LONG_DESCRIPTION_FIELD];

const CORE_WIZARD_FIELDS: readonly DenaliRuleFieldDefinition[] = [
  TITLE_FIELD,
  PUBLISH_STATUS_FIELD,
  CATEGORY_FIELD,
  START_DATETIME_FIELD,
  CAPACITY_MAX_FIELD,
  THEME_IDS_FIELD,
  SHORT_DESCRIPTION_FIELD,
  TRANSPORT_MODE_FIELD,
  TRANSPORT_COST_FIELD,
  ALLOW_PERSONAL_CAR_FIELD,
  DONG_AMOUNT_FIELD,
  REQUIRES_PAYMENT_FIELD,
  BASE_PRICE_PER_PERSON_FIELD,
  PAYMENT_MODE_FIELD,
  NATIONAL_ID_REQUIRED_FIELD,
  PHOTOS_FIELD,
];

function assertUniqueDenaliFieldPaths(
  model: DenaliRuleModel,
): void {
  const seen = new Set<string>();
  for (const field of model.fields) {
    if (seen.has(field.path)) {
      throw new Error(
        `denaliRuleSet ${model.category}/${model.duration}: duplicate field path "${field.path}"`,
      );
    }
    seen.add(field.path);
  }
}

export const denaliRuleSet: DenaliRuleSet = {
  mountain: {
    single_day: {
      category: "mountain",
      duration: "single_day",
      fields: [
        ...CORE_WIZARD_FIELDS,
        ...OPTIONAL_BASIC_FIELDS,
        DESTINATION_FIELD,
        END_DATETIME_HIDDEN,
        ...OUTDOOR_PROGRAM_FIELDS,
        ALTITUDE_MOUNTAIN,
        ITINERARY_HIDDEN,
        ...OPTIONAL_PROGRAM_FIELDS,
        TRANSPORT_NOTES_FIELD,
        POLICIES_TEXT_FIELD,
        CANCELLATION_DEADLINE_FIELD,
        CANCELLATION_PENALTY_FIELD,
        GEAR_ITEMS_FIELD,
        ...MOUNTAIN_PARTICIPANT_SUBMIT_FIELDS,
      ],
    },
    multi_day: {
      category: "mountain",
      duration: "multi_day",
      fields: [
        ...CORE_WIZARD_FIELDS,
        ...OPTIONAL_BASIC_FIELDS,
        DESTINATION_FIELD,
        END_DATETIME_VISIBLE_REQUIRED,
        ...OUTDOOR_PROGRAM_FIELDS,
        ALTITUDE_MOUNTAIN,
        ITINERARY_VISIBLE,
        ...OPTIONAL_PROGRAM_FIELDS,
        TRANSPORT_NOTES_FIELD,
        POLICIES_TEXT_FIELD,
        CANCELLATION_DEADLINE_FIELD,
        CANCELLATION_PENALTY_FIELD,
        GEAR_ITEMS_FIELD,
        ...MOUNTAIN_PARTICIPANT_SUBMIT_FIELDS,
      ],
    },
  },

  nature: {
    single_day: {
      category: "nature",
      duration: "single_day",
      fields: [
        ...CORE_WIZARD_FIELDS,
        ...OPTIONAL_BASIC_FIELDS,
        DESTINATION_FIELD,
        END_DATETIME_HIDDEN,
        ...OUTDOOR_PROGRAM_FIELDS,
        ALTITUDE_HIDDEN,
        ITINERARY_HIDDEN,
        ...OPTIONAL_PROGRAM_FIELDS,
        TRANSPORT_NOTES_FIELD,
        POLICIES_TEXT_FIELD,
        CANCELLATION_DEADLINE_FIELD,
        CANCELLATION_PENALTY_FIELD,
        GEAR_ITEMS_FIELD,
        ...NON_MOUNTAIN_PARTICIPANT_HIDDEN_FIELDS,
      ],
    },
    multi_day: {
      category: "nature",
      duration: "multi_day",
      fields: [
        ...CORE_WIZARD_FIELDS,
        ...OPTIONAL_BASIC_FIELDS,
        DESTINATION_FIELD,
        END_DATETIME_VISIBLE_REQUIRED,
        ...OUTDOOR_PROGRAM_FIELDS,
        ALTITUDE_HIDDEN,
        ITINERARY_VISIBLE,
        ...OPTIONAL_PROGRAM_FIELDS,
        TRANSPORT_NOTES_FIELD,
        POLICIES_TEXT_FIELD,
        CANCELLATION_DEADLINE_FIELD,
        CANCELLATION_PENALTY_FIELD,
        GEAR_ITEMS_FIELD,
        ...NON_MOUNTAIN_PARTICIPANT_HIDDEN_FIELDS,
      ],
    },
  },

  desert: {
    single_day: {
      category: "desert",
      duration: "single_day",
      fields: [
        ...CORE_WIZARD_FIELDS,
        ...OPTIONAL_BASIC_FIELDS,
        DESTINATION_FIELD,
        END_DATETIME_HIDDEN,
        ...OUTDOOR_PROGRAM_FIELDS,
        ALTITUDE_HIDDEN,
        ITINERARY_HIDDEN,
        ...OPTIONAL_PROGRAM_FIELDS,
        TRANSPORT_NOTES_FIELD,
        POLICIES_TEXT_FIELD,
        CANCELLATION_DEADLINE_FIELD,
        CANCELLATION_PENALTY_FIELD,
        GEAR_ITEMS_FIELD,
        ...NON_MOUNTAIN_PARTICIPANT_HIDDEN_FIELDS,
      ],
    },
    multi_day: {
      category: "desert",
      duration: "multi_day",
      fields: [
        ...CORE_WIZARD_FIELDS,
        ...OPTIONAL_BASIC_FIELDS,
        DESTINATION_FIELD,
        END_DATETIME_VISIBLE_REQUIRED,
        ...OUTDOOR_PROGRAM_FIELDS,
        ALTITUDE_HIDDEN,
        ITINERARY_VISIBLE,
        ...OPTIONAL_PROGRAM_FIELDS,
        TRANSPORT_NOTES_FIELD,
        POLICIES_TEXT_FIELD,
        CANCELLATION_DEADLINE_FIELD,
        CANCELLATION_PENALTY_FIELD,
        GEAR_ITEMS_FIELD,
        ...NON_MOUNTAIN_PARTICIPANT_HIDDEN_FIELDS,
      ],
    },
  },

  event: {
    single_day: {
      category: "event",
      duration: "single_day",
      fields: [
        ...CORE_WIZARD_FIELDS,
        ...OPTIONAL_BASIC_FIELDS,
        DESTINATION_FIELD,
        END_DATETIME_HIDDEN,
        ...EVENT_HIDDEN_PROGRAM_FIELDS,
        ALTITUDE_HIDDEN,
        ITINERARY_HIDDEN,
        ...OPTIONAL_PROGRAM_FIELDS,
        TRANSPORT_NOTES_FIELD,
        POLICIES_TEXT_FIELD,
        CANCELLATION_DEADLINE_FIELD,
        CANCELLATION_PENALTY_FIELD,
        GEAR_ITEMS_FIELD,
        ...NON_MOUNTAIN_PARTICIPANT_HIDDEN_FIELDS,
      ],
    },
    multi_day: null,
  },
};

for (const category of DENALI_RULE_MODEL_CATEGORIES) {
  for (const duration of DENALI_RULE_MODEL_DURATIONS) {
    const model = denaliRuleSet[category][duration];
    if (model != null) {
      assertUniqueDenaliFieldPaths(model);
    }
  }
}

export const denaliRuleModelMountainMultiDay: DenaliRuleModel =
  denaliRuleSet.mountain.multi_day!;
