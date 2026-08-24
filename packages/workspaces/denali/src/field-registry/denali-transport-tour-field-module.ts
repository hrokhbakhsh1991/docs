import type { DenaliCreateWizardStepId } from "../layout/stepIds";

import type { DenaliFieldDefinition } from "./denaliFieldRegistryData";

export const DENALI_TRANSPORT_MODE_CANONICAL_PATH = "transport.mode" as const;

export const denaliTransportModeField = Object.freeze({
  canonicalPath: DENALI_TRANSPORT_MODE_CANONICAL_PATH,
  stepId: "denali_logistics" as DenaliCreateWizardStepId,
  rhfPath: "transport.transportMode",
  zodPath: "transport.transportMode",
  zodKind: "transportMode",
  tags: ["core"] as const,
  ruleDefaults: { required: true, hidden: false },
  wire: [
    { kind: "createTourDto" as const, field: "transportModes" as const },
    { kind: "tripDetails.logistics" as const, field: "primaryTransportMode" as const },
    { kind: "tripDetails" as const, field: "transport" as const },
  ],
}) satisfies DenaliFieldDefinition;

export const denaliTransportDependentFields = Object.freeze([
  Object.freeze({
    canonicalPath: "transport.transportCost",
    stepId: "denali_logistics" as DenaliCreateWizardStepId,
    rhfPath: "transport.transportCost",
    zodPath: "transport.transportCost",
    zodKind: "optionalInt",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
    contextualVisibility: { kind: "transportOrganizedCostVisible" as const },
    structuralInvariant: { kind: "clearWhenNotVisible" as const },
    wire: { kind: "tripDetails" as const, field: "transport" as const },
  }),
  Object.freeze({
    canonicalPath: "transport.allowPersonalCar",
    stepId: "denali_logistics" as DenaliCreateWizardStepId,
    rhfPath: "transport.allowPersonalCar",
    zodPath: "transport.allowPersonalCar",
    zodKind: "booleanOptional",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
    contextualVisibility: { kind: "transportPersonalCarOptionVisible" as const },
    structuralInvariant: { kind: "clearWhenNotVisible" as const },
    wire: [
      { kind: "tripDetails" as const, field: "transport" as const },
      { kind: "derived" as const, description: "May set logistics.privateCarMode." },
    ],
  }),
  Object.freeze({
    canonicalPath: "transport.dongAmount",
    stepId: "denali_logistics" as DenaliCreateWizardStepId,
    rhfPath: "transport.dongAmount",
    zodPath: "transport.dongAmount",
    zodKind: "optionalInt",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
    contextualVisibility: { kind: "transportDongVisible" as const },
    contextualRequired: { kind: "transportDongVisible" as const },
    structuralInvariant: { kind: "clearWhenNotVisible" as const },
    wire: [
      { kind: "tripDetails.logistics" as const, field: "fuelShareToman" as const },
      { kind: "tripDetails" as const, field: "transport" as const },
    ],
  }),
  Object.freeze({
    canonicalPath: "transport.transportNotes",
    stepId: "denali_logistics" as DenaliCreateWizardStepId,
    rhfPath: "transport.transportNotes",
    zodPath: "transport.transportNotes",
    zodKind: "stringOptional",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
    inRuleModel: false,
    settingsSurface: "implicit",
    wire: { kind: "tripDetails.logistics" as const, field: "transportationNotes" as const },
    notes: "Wire/hydrate only; no create-wizard section input.",
  }),
  Object.freeze({
    canonicalPath: "transport.seatPreference",
    stepId: "denali_logistics" as DenaliCreateWizardStepId,
    rhfPath: "transport.seatPreference",
    zodPath: "transport.seatPreference",
    zodKind: "stringOptional",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
    inRuleModel: false,
    settingsSurface: "deprecated",
    contextualVisibility: { kind: "transportTrainSeatVisible" as const },
    contextualRequired: { kind: "transportTrainSeatVisible" as const },
    structuralInvariant: { kind: "clearWhenNotVisible" as const },
    wire: { kind: "tripDetails" as const, field: "transport" as const },
    notes:
      "Train seat preference — rendered inside denali.transport-mode (not a standalone Settings overlay leaf). settingsSurface deprecated = wizard_overlay_exclude only (INV-WIZ-002).",
  }),
  Object.freeze({
    canonicalPath: "transport.adminCapacityApproval",
    stepId: "denali_logistics" as DenaliCreateWizardStepId,
    rhfPath: "transport.adminCapacityApproval",
    zodPath: "transport.adminCapacityApproval",
    zodKind: "adminCapacityApproval",
    tags: ["core"] as const,
    ruleDefaults: { required: false, hidden: false },
    contextualVisibility: { kind: "transportAdminCapacityVisible" as const },
    structuralInvariant: { kind: "clearWhenNotVisible" as const },
    wire: { kind: "tripDetails" as const, field: "transport" as const },
    notes: "Separate capacity calculation when personal car is permitted on organized transport.",
  }),
] as const satisfies readonly DenaliFieldDefinition[]);

/** CW7-07 — tour-field configs bound via manifest `workspaceTransport.fieldModule`. */
export const denaliTransportFieldModule = Object.freeze({
  moduleId: "workspaceTransport.tourField" as const,
  fields: Object.freeze([denaliTransportModeField, ...denaliTransportDependentFields]),
});
