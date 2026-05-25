/**
 * Denali wizard field definitions — edit this file (or DenaliFieldRegistry.ts helpers only).
 * Run `pnpm --filter web generate:denali-wizard` after changes.
 */

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import type { DenaliMatrixCell, DenaliMatrixTag } from "./denaliRuleMatrixRecipes";
import type {
  DenaliContextualRule,
  DenaliFieldKind,
  DenaliFieldWireProjection,
  DenaliStructuralInvariant,
} from "./DenaliFieldRegistry.types";

export type DenaliZodFieldKind =
  | "title"
  | "tourType"
  | "publishStatus"
  | "destinationId"
  | "isoDateTime"
  | "isoDateTimeOptional"
  | "capacityMax"
  | "optionalInt"
  | "optionalPositiveInt"
  | "stringOptional"
  | "stringArrayDefault"
  | "booleanOptional"
  | "socialMediaLink"
  | "approximateReturnTime"
  | "difficultyLevel"
  | "itinerary"
  | "locationData"
  | "gatheringPoints"
  | "gearItems"
  | "transportMode"
  | "photos"
  | "paymentMode"
  | "fitnessLevel"
  | "minRequiredPeaks"
  | "adminCapacityApproval";

export interface DenaliFieldDefinition {
  canonicalPath: string;
  stepId: DenaliCreateWizardStepId;
  rhfPath: string;
  zodPath: string;
  zodKind: DenaliZodFieldKind;
  tags: readonly DenaliMatrixTag[];
  ruleDefaults: { required: boolean; hidden: boolean };
  cellOverrides?: Partial<Record<DenaliMatrixCell, { required: boolean; hidden: boolean }>>;
  inRuleModel?: boolean;
  fieldKind?: DenaliFieldKind;
  wire?: DenaliFieldWireProjection | readonly DenaliFieldWireProjection[];
  notes?: string;
  /** Override default content-quality weight (see denaliFieldCompletionWeights). */
  weight?: number;
  /** Shown only when this rule passes (see denaliUIAdapter.ts). */
  contextualVisibility?: DenaliContextualRule;
  /** Required only when this rule passes (after visibility). */
  contextualRequired?: DenaliContextualRule;
  /** Ghost-state normalize (see denaliInvariantEngine.ts). */
  structuralInvariant?: DenaliStructuralInvariant;
}

export const DENALI_FIELD_DEFINITIONS: readonly DenaliFieldDefinition[] = [
  {
    canonicalPath: "title",
    stepId: "denali_basic",
    rhfPath: "basicInfo.title",
    zodPath: "basicInfo.title",
    zodKind: "title",
    tags: ["core"] as const,
    ruleDefaults: { required: true, hidden: false },
    weight: 5,
  },
  {
    canonicalPath: "publishStatus",
    stepId: "denali_basic",
    rhfPath: "basicInfo.publishStatus",
    zodPath: "basicInfo.publishStatus",
    zodKind: "publishStatus",
    tags: ["core"] as const,
    ruleDefaults: { required: true, hidden: false },
  },
  {
    canonicalPath: "category",
    stepId: "denali_basic",
    rhfPath: "basicInfo.tourType",
    zodPath: "basicInfo.tourType",
    zodKind: "tourType",
    tags: ["core"] as const,
    ruleDefaults: { required: true, hidden: false },
  },
  {
    canonicalPath: "eventVariant",
    stepId: "denali_basic",
    rhfPath: "basicInfo.tourType",
    zodPath: "basicInfo.tourType",
    zodKind: "tourType",
    tags: ["event_variant"] as const,
    ruleDefaults: { required: false, hidden: false },
  },
  {
    canonicalPath: "duration",
    stepId: "denali_basic",
    rhfPath: "basicInfo.tourType",
    zodPath: "basicInfo.tourType",
    zodKind: "tourType",
    tags: ["core"] as const,
    ruleDefaults: { required: true, hidden: false },
    inRuleModel: false,
    notes: "Canonical submit schema duration; maps to tourType rail control for issue paths.",
  },
  {
    canonicalPath: "destinationId",
    stepId: "denali_basic",
    rhfPath: "basicInfo.destinationId",
    zodPath: "basicInfo.destinationId",
    zodKind: "destinationId",
    tags: ["destination"] as const,
    ruleDefaults: { required: true, hidden: false },
  },
  {
    canonicalPath: "startDateTime",
    stepId: "denali_basic",
    rhfPath: "basicInfo.startDateTime",
    zodPath: "basicInfo.startDateTime",
    zodKind: "isoDateTime",
    tags: ["core"] as const,
    ruleDefaults: { required: true, hidden: false },
  },
  {
    canonicalPath: "endDateTime",
    stepId: "denali_basic",
    rhfPath: "basicInfo.endDateTime",
    zodPath: "basicInfo.endDateTime",
    zodKind: "isoDateTimeOptional",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: true },
    contextualRequired: { kind: "multiDayEndDateTimeRequired" },

  cellOverrides: {
    "desert:multi_day": { required: true, hidden: false },
    "mountain:multi_day": { required: true, hidden: false },
    "nature:multi_day": { required: true, hidden: false },
  }
  },
  {
    canonicalPath: "capacityMax",
    stepId: "denali_basic",
    rhfPath: "basicInfo.capacityMax",
    zodPath: "basicInfo.capacityMax",
    zodKind: "capacityMax",
    tags: ["core"] as const,
    ruleDefaults: { required: true, hidden: false },
  },
  {
    canonicalPath: "capacityMin",
    stepId: "denali_basic",
    rhfPath: "basicInfo.capacityMin",
    zodPath: "basicInfo.capacityMin",
    zodKind: "optionalInt",
    tags: ["optional_basic"] as const,
    ruleDefaults: { required: false, hidden: false },
  },
  {
    canonicalPath: "meetingPoint",
    stepId: "denali_basic",
    rhfPath: "basicInfo.meetingPoint",
    zodPath: "basicInfo.meetingPoint",
    zodKind: "stringOptional",
    tags: [] as const,
    ruleDefaults: { required: false, hidden: false },
    inRuleModel: false,
  },
  {
    canonicalPath: "startPointLocationText",
    stepId: "denali_basic",
    rhfPath: "basicInfo.startPointLocationText",
    zodPath: "basicInfo.startPointLocationText",
    zodKind: "stringOptional",
    tags: ["optional_basic"] as const,
    ruleDefaults: { required: false, hidden: false },
  },
  {
    canonicalPath: "approximateReturnTime",
    stepId: "denali_basic",
    rhfPath: "basicInfo.approximateReturnTime",
    zodPath: "basicInfo.approximateReturnTime",
    zodKind: "approximateReturnTime",
    tags: ["optional_basic"] as const,
    ruleDefaults: { required: false, hidden: false },
  },
  {
    canonicalPath: "leaderUserIds",
    stepId: "denali_basic",
    rhfPath: "basicInfo.leaderUserIds",
    zodPath: "basicInfo.leaderUserIds",
    zodKind: "stringArrayDefault",
    tags: ["optional_basic"] as const,
    ruleDefaults: { required: false, hidden: false },
  },
  {
    canonicalPath: "requiresLocalGuide",
    stepId: "denali_basic",
    rhfPath: "basicInfo.requiresLocalGuide",
    zodPath: "basicInfo.requiresLocalGuide",
    zodKind: "booleanOptional",
    tags: ["optional_basic"] as const,
    ruleDefaults: { required: false, hidden: false },
  },
  {
    canonicalPath: "localGuideName",
    stepId: "denali_basic",
    rhfPath: "basicInfo.localGuideName",
    zodPath: "basicInfo.localGuideName",
    zodKind: "stringOptional",
    tags: ["optional_basic"] as const,
    ruleDefaults: { required: false, hidden: false },
    contextualVisibility: { kind: "whenTruthy", watchCanonical: "requiresLocalGuide" },
  },
  {
    canonicalPath: "requiresManualAdminApproval",
    stepId: "denali_basic",
    rhfPath: "basicInfo.requiresManualAdminApproval",
    zodPath: "basicInfo.requiresManualAdminApproval",
    zodKind: "booleanOptional",
    tags: ["optional_basic"] as const,
    ruleDefaults: { required: false, hidden: false },
  },
  {
    canonicalPath: "socialMediaLink",
    stepId: "denali_basic",
    rhfPath: "basicInfo.socialMediaLink",
    zodPath: "basicInfo.socialMediaLink",
    zodKind: "socialMediaLink",
    tags: ["optional_basic"] as const,
    ruleDefaults: { required: false, hidden: false },
  },
  {
    canonicalPath: "program.themeIds",
    stepId: "denali_program",
    rhfPath: "programNature.themeIds",
    zodPath: "programNature.themeIds",
    zodKind: "stringArrayDefault",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
  },
  {
    canonicalPath: "program.shortDescription",
    stepId: "denali_program",
    rhfPath: "programNature.shortDescription",
    zodPath: "programNature.shortDescription",
    zodKind: "stringOptional",
    tags: ["core"] as const,
    ruleDefaults: { required: true, hidden: false },
  },
  {
    canonicalPath: "program.longDescription",
    stepId: "denali_program",
    rhfPath: "programNature.longDescription",
    zodPath: "programNature.longDescription",
    zodKind: "stringOptional",
    tags: ["optional_program"] as const,
    ruleDefaults: { required: false, hidden: false },
  },
  {
    canonicalPath: "program.difficultyLevel",
    stepId: "denali_program",
    rhfPath: "programNature.difficultyLevel",
    zodPath: "programNature.difficultyLevel",
    zodKind: "difficultyLevel",
    tags: ["outdoor_program", "event_program_hidden"] as const,
    ruleDefaults: { required: true, hidden: false },
    structuralInvariant: { kind: "defaultWhenVisible", value: 5 },
    cellOverrides: {
      "event:single_day": { required: false, hidden: true },
    },
  },
  {
    canonicalPath: "program.hikingHoursApprox",
    stepId: "denali_program",
    rhfPath: "programNature.hikingHoursApprox",
    zodPath: "programNature.hikingHoursApprox",
    zodKind: "optionalPositiveInt",
    tags: ["outdoor_program", "event_program_hidden"] as const,
    ruleDefaults: { required: true, hidden: false },
    cellOverrides: {
      "event:single_day": { required: false, hidden: true },
    },
  },
  {
    canonicalPath: "program.hikingGoHours",
    stepId: "denali_program",
    rhfPath: "programNature.hikingGoHours",
    zodPath: "programNature.hikingGoHours",
    zodKind: "optionalPositiveInt",
    tags: ["outdoor_program", "event_program_hidden"] as const,
    ruleDefaults: { required: false, hidden: false },
    cellOverrides: {
      "event:single_day": { required: false, hidden: true },
    },
  },
  {
    canonicalPath: "program.hikingReturnHours",
    stepId: "denali_program",
    rhfPath: "programNature.hikingReturnHours",
    zodPath: "programNature.hikingReturnHours",
    zodKind: "optionalPositiveInt",
    tags: ["outdoor_program", "event_program_hidden"] as const,
    ruleDefaults: { required: false, hidden: false },
    cellOverrides: {
      "event:single_day": { required: false, hidden: true },
    },
  },
  {
    canonicalPath: "program.altitudeMeasurement",
    stepId: "denali_program",
    rhfPath: "programNature.altitudeMeasurement",
    zodPath: "programNature.altitudeMeasurement",
    zodKind: "optionalInt",
    tags: ["altitude_mountain", "altitude_hidden"] as const,
    ruleDefaults: { required: true, hidden: false },
    structuralInvariant: { kind: "clearWhenNotVisible" },
    cellOverrides: {
      "desert:multi_day": { required: false, hidden: true },
      "desert:single_day": { required: false, hidden: true },
      "event:single_day": { required: false, hidden: true },
      "nature:multi_day": { required: false, hidden: true },
      "nature:single_day": { required: false, hidden: true },
    },
  },
  {
    canonicalPath: "program.itinerary",
    stepId: "denali_program",
    rhfPath: "programNature.itinerary",
    zodPath: "programNature.itinerary",
    zodKind: "itinerary",
    tags: ["itinerary_hidden", "itinerary_visible"] as const,
    ruleDefaults: { required: false, hidden: true },
    structuralInvariant: { kind: "clearWhenNotVisible" },

  cellOverrides: {
    "desert:multi_day": { required: true, hidden: false },
    "mountain:multi_day": { required: true, hidden: false },
    "nature:multi_day": { required: true, hidden: false },
  }
  },
  {
    canonicalPath: "gatheringPoint",
    stepId: "denali_logistics",
    rhfPath: "basicInfo.gatheringPoint",
    zodPath: "basicInfo.gatheringPoint",
    zodKind: "locationData",
    tags: ["outdoor_logistics_location", "event_logistics_hidden"] as const,
    ruleDefaults: { required: false, hidden: false },
    cellOverrides: {
      "event:single_day": { required: false, hidden: true },
    },
    inRuleModel: false,
    wire: { kind: "tripDetails.overview", field: "gatheringPoint" },
    notes: "Canonical 5-zone gathering point (singular); nested coords use prefix lookup.",
  },
  {
    canonicalPath: "gatheringPoints",
    stepId: "denali_logistics",
    rhfPath: "tripDetails.logistics.gatheringPoints",
    zodPath: "tripDetails.logistics.gatheringPoints",
    zodKind: "gatheringPoints",
    tags: ["outdoor_logistics_location", "event_logistics_hidden"] as const,
    ruleDefaults: { required: false, hidden: false },
    cellOverrides: {
      "event:single_day": { required: false, hidden: true },
    },
    wire: [{ kind: "tripDetails.logistics", field: "gatheringPoints" }, { kind: "derived", description: "Primary station feeds logistics.meetingPoint when set." }],
  },
  {
    canonicalPath: "startPoint",
    stepId: "denali_logistics",
    rhfPath: "basicInfo.startPoint",
    zodPath: "basicInfo.startPoint",
    zodKind: "locationData",
    tags: ["outdoor_logistics_location", "event_logistics_hidden"] as const,
    ruleDefaults: { required: false, hidden: false },
    cellOverrides: {
      "event:single_day": { required: false, hidden: true },
    },
    wire: [{ kind: "tripDetails.overview", field: "startPoint" }, { kind: "derived", description: "May set logistics.startPointVillage." }],
  },
  {
    canonicalPath: "summitPoint",
    stepId: "denali_logistics",
    rhfPath: "basicInfo.summitPoint",
    zodPath: "basicInfo.summitPoint",
    zodKind: "locationData",
    tags: ["outdoor_logistics_location", "event_logistics_hidden"] as const,
    ruleDefaults: { required: false, hidden: false },
    cellOverrides: {
      "event:single_day": { required: false, hidden: true },
    },
    wire: { kind: "tripDetails.overview", field: "summitPoint" },
  },
  {
    canonicalPath: "campPoint",
    stepId: "denali_logistics",
    rhfPath: "basicInfo.campPoint",
    zodPath: "basicInfo.campPoint",
    zodKind: "locationData",
    tags: ["outdoor_logistics_location", "event_logistics_hidden"] as const,
    ruleDefaults: { required: false, hidden: false },
    cellOverrides: {
      "event:single_day": { required: false, hidden: true },
    },
    wire: { kind: "tripDetails.overview", field: "campPoint" },
  },
  {
    canonicalPath: "endPoint",
    stepId: "denali_logistics",
    rhfPath: "basicInfo.endPoint",
    zodPath: "basicInfo.endPoint",
    zodKind: "locationData",
    tags: ["outdoor_logistics_location", "event_logistics_hidden"] as const,
    ruleDefaults: { required: false, hidden: false },
    cellOverrides: {
      "event:single_day": { required: false, hidden: true },
    },
    wire: [{ kind: "tripDetails.overview", field: "endPoint" }, { kind: "derived", description: "May set logistics.returnPoint." }],
  },
  {
    canonicalPath: "participants.gearItems",
    stepId: "denali_logistics",
    rhfPath: "participantRequirements.gearItems",
    zodPath: "participantRequirements.gearItems",
    zodKind: "gearItems",
    tags: ["gear"] as const,
    ruleDefaults: { required: false, hidden: false },
    wire: { kind: "derived", description: "Splits into tripDetails.participation gearRequiredIds / gearOptionalIds." },
  },
  {
    canonicalPath: "transport.mode",
    stepId: "denali_logistics",
    rhfPath: "transport.transportMode",
    zodPath: "transport.transportMode",
    zodKind: "transportMode",
    tags: ["core"] as const,
    ruleDefaults: { required: true, hidden: false },
    wire: [{ kind: "createTourDto", field: "transportModes" }, { kind: "tripDetails.logistics", field: "primaryTransportMode" }, { kind: "tripDetails", field: "transport" }],
  },
  {
    canonicalPath: "transport.transportCost",
    stepId: "denali_logistics",
    rhfPath: "transport.transportCost",
    zodPath: "transport.transportCost",
    zodKind: "optionalInt",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
    contextualVisibility: { kind: "transportOrganizedCostVisible" },
    structuralInvariant: { kind: "clearWhenNotVisible" },
    wire: { kind: "tripDetails", field: "transport" },
  },
  {
    canonicalPath: "transport.allowPersonalCar",
    stepId: "denali_logistics",
    rhfPath: "transport.allowPersonalCar",
    zodPath: "transport.allowPersonalCar",
    zodKind: "booleanOptional",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
    contextualVisibility: { kind: "transportPersonalCarOptionVisible" },
    structuralInvariant: { kind: "clearWhenNotVisible" },
    wire: [{ kind: "tripDetails", field: "transport" }, { kind: "derived", description: "May set logistics.privateCarMode." }],
  },
  {
    canonicalPath: "transport.dongAmount",
    stepId: "denali_logistics",
    rhfPath: "transport.dongAmount",
    zodPath: "transport.dongAmount",
    zodKind: "optionalInt",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
    contextualVisibility: { kind: "transportDongVisible" },
    contextualRequired: { kind: "transportDongVisible" },
    structuralInvariant: { kind: "clearWhenNotVisible" },
    wire: [{ kind: "tripDetails.logistics", field: "fuelShareToman" }, { kind: "tripDetails", field: "transport" }],
  },
  {
    canonicalPath: "transport.transportNotes",
    stepId: "denali_logistics",
    rhfPath: "transport.transportNotes",
    zodPath: "transport.transportNotes",
    zodKind: "stringOptional",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
    wire: { kind: "tripDetails.logistics", field: "transportationNotes" },
  },
  {
    canonicalPath: "transport.seatPreference",
    stepId: "denali_logistics",
    rhfPath: "transport.seatPreference",
    zodPath: "transport.seatPreference",
    zodKind: "stringOptional",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
    inRuleModel: false,
    contextualVisibility: { kind: "transportTrainSeatVisible" },
    contextualRequired: { kind: "transportTrainSeatVisible" },
    wire: { kind: "tripDetails", field: "transport" },
  },
  {
    canonicalPath: "transport.adminCapacityApproval",
    stepId: "denali_logistics",
    rhfPath: "transport.adminCapacityApproval",
    zodPath: "transport.adminCapacityApproval",
    zodKind: "adminCapacityApproval",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
    contextualVisibility: { kind: "transportAdminCapacityVisible" },
    structuralInvariant: { kind: "clearWhenNotVisible" },
    wire: { kind: "tripDetails", field: "transport" },
    notes: "Separate capacity calculation when personal car is permitted on organized transport.",
  },
  {
    canonicalPath: "photos",
    stepId: "denali_photos",
    rhfPath: "photosData.photos",
    zodPath: "photosData.photos",
    zodKind: "photos",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
    fieldKind: "asyncAsset",
    wire: { kind: "tripDetails", field: "photos" },
    weight: 10,
  },
  {
    canonicalPath: "pricing.requiresPayment",
    stepId: "denali_pricing",
    rhfPath: "pricingPayment.requiresPayment",
    zodPath: "pricingPayment.requiresPayment",
    zodKind: "booleanOptional",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
  },
  {
    canonicalPath: "pricing.basePricePerPerson",
    stepId: "denali_pricing",
    rhfPath: "pricingPayment.basePricePerPerson",
    zodPath: "pricingPayment.basePricePerPerson",
    zodKind: "optionalInt",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
    contextualVisibility: { kind: "whenTruthy", watchCanonical: "pricing.requiresPayment" },
    contextualRequired: { kind: "whenTruthy", watchCanonical: "pricing.requiresPayment" },
    structuralInvariant: { kind: "clearWhenNotVisible" },
  },
  {
    canonicalPath: "pricing.paymentMode",
    stepId: "denali_pricing",
    rhfPath: "pricingPayment.paymentMode",
    zodPath: "pricingPayment.paymentMode",
    zodKind: "paymentMode",
    tags: ["core"] as const,
    ruleDefaults: { required: true, hidden: false },
  },
  {
    canonicalPath: "pricing.includesTourInsurance",
    stepId: "denali_pricing",
    rhfPath: "pricingPayment.includesTourInsurance",
    zodPath: "pricingPayment.includesTourInsurance",
    zodKind: "booleanOptional",
    tags: [] as const,
    ruleDefaults: { required: false, hidden: false },
    inRuleModel: false,
  },
  {
    canonicalPath: "participants.nationalIdRequired",
    stepId: "denali_pricing",
    rhfPath: "participantRequirements.nationalIdRequired",
    zodPath: "participantRequirements.nationalIdRequired",
    zodKind: "booleanOptional",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
  },
  {
    canonicalPath: "policies.cancellationDeadlineHours",
    stepId: "denali_pricing",
    rhfPath: "policies.cancellationDeadlineHours",
    zodPath: "policies.cancellationDeadlineHours",
    zodKind: "optionalPositiveInt",
    tags: ["policies_pricing"] as const,
    ruleDefaults: { required: false, hidden: false },
  },
  {
    canonicalPath: "policies.cancellationPenaltyPercentage",
    stepId: "denali_pricing",
    rhfPath: "policies.cancellationPenaltyPercentage",
    zodPath: "policies.cancellationPenaltyPercentage",
    zodKind: "optionalInt",
    tags: ["policies_pricing"] as const,
    ruleDefaults: { required: false, hidden: false },
  },
  {
    canonicalPath: "policies.policiesText",
    stepId: "denali_pricing",
    rhfPath: "policies.policiesText",
    zodPath: "policies.policiesText",
    zodKind: "stringOptional",
    tags: ["policies_pricing"] as const,
    ruleDefaults: { required: false, hidden: false },
  },
  {
    canonicalPath: "participants.minimumAge",
    stepId: "denali_pricing",
    rhfPath: "participantRequirements.minimumAge",
    zodPath: "participantRequirements.minimumAge",
    zodKind: "optionalInt",
    tags: ["mountain_participants", "non_mountain_participants_hidden"] as const,
    ruleDefaults: { required: true, hidden: false },

  cellOverrides: {
    "desert:multi_day": { required: false, hidden: true },
    "desert:single_day": { required: false, hidden: true },
    "event:single_day": { required: false, hidden: true },
    "nature:multi_day": { required: false, hidden: true },
    "nature:single_day": { required: false, hidden: true },
  }
  },
  {
    canonicalPath: "participants.maximumAge",
    stepId: "denali_pricing",
    rhfPath: "participantRequirements.maximumAge",
    zodPath: "participantRequirements.maximumAge",
    zodKind: "optionalInt",
    tags: ["mountain_participants", "non_mountain_participants_hidden"] as const,
    ruleDefaults: { required: false, hidden: false },

  cellOverrides: {
    "desert:multi_day": { required: false, hidden: true },
    "desert:single_day": { required: false, hidden: true },
    "event:single_day": { required: false, hidden: true },
    "nature:multi_day": { required: false, hidden: true },
    "nature:single_day": { required: false, hidden: true },
  }
  },
  {
    canonicalPath: "participants.fitnessLevel",
    stepId: "denali_pricing",
    rhfPath: "participantRequirements.fitnessLevel",
    zodPath: "participantRequirements.fitnessLevel",
    zodKind: "fitnessLevel",
    tags: ["mountain_participants", "non_mountain_participants_hidden"] as const,
    ruleDefaults: { required: true, hidden: false },

  cellOverrides: {
    "desert:multi_day": { required: false, hidden: true },
    "desert:single_day": { required: false, hidden: true },
    "event:single_day": { required: false, hidden: true },
    "nature:multi_day": { required: false, hidden: true },
    "nature:single_day": { required: false, hidden: true },
  }
  },
  {
    canonicalPath: "participants.sportsInsuranceRequired",
    stepId: "denali_pricing",
    rhfPath: "participantRequirements.sportsInsuranceRequired",
    zodPath: "participantRequirements.sportsInsuranceRequired",
    zodKind: "booleanOptional",
    tags: ["mountain_participants", "non_mountain_participants_hidden"] as const,
    ruleDefaults: { required: true, hidden: false },
    structuralInvariant: { kind: "enforceValueWhenCategory", category: "mountain", value: true },

  cellOverrides: {
    "desert:multi_day": { required: false, hidden: true },
    "desert:single_day": { required: false, hidden: true },
    "event:single_day": { required: false, hidden: true },
    "nature:multi_day": { required: false, hidden: true },
    "nature:single_day": { required: false, hidden: true },
  }
  },
  {
    canonicalPath: "participants.fitnessPrerequisiteText",
    stepId: "denali_pricing",
    rhfPath: "participantRequirements.fitnessPrerequisiteText",
    zodPath: "participantRequirements.fitnessPrerequisiteText",
    zodKind: "stringOptional",
    tags: ["mountain_participants", "non_mountain_participants_hidden"] as const,
    ruleDefaults: { required: false, hidden: false },

  cellOverrides: {
    "desert:multi_day": { required: false, hidden: true },
    "desert:single_day": { required: false, hidden: true },
    "event:single_day": { required: false, hidden: true },
    "nature:multi_day": { required: false, hidden: true },
    "nature:single_day": { required: false, hidden: true },
  }
  },
  {
    canonicalPath: "participants.minRequiredPeaks",
    stepId: "denali_pricing",
    rhfPath: "participantRequirements.minRequiredPeaks",
    zodPath: "participantRequirements.minRequiredPeaks",
    zodKind: "minRequiredPeaks",
    tags: [] as const,
    ruleDefaults: { required: false, hidden: false },
    inRuleModel: false,
  },
] as const;
