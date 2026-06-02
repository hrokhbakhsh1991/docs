import { getTourFormProfileDescriptor, type TourFormProfile } from "@repo/types";
import { TOUR_LIFECYCLE_TRANSITION_MATRIX } from "@repo/shared";
import {
  getTourWorkspaceDefinition,
  type WorkspaceInvariantViolation,
} from "@repo/shared-contracts";
import type {
  WorkspaceFieldStripRules,
  WorkspacePublishPolicy,
  WorkspaceValidationRules,
  WorkspaceWizardConfig,
} from "./workspace.strategy.interface";

const OPEN_READINESS_FIELDS = [
  "title",
  "totalCapacity",
  "details.durationDays",
] as const satisfies WorkspacePublishPolicy["openReadinessFields"];

const CLASSIC_ALLOWED_LIFECYCLE_TRANSITIONS = TOUR_LIFECYCLE_TRANSITION_MATRIX.filter(
  (rule) => rule.allowed && rule.from !== rule.to,
).map(({ from, to }) => ({ from, to }));

export function buildValidationRules(profile: TourFormProfile): WorkspaceValidationRules {
  const descriptor = getTourFormProfileDescriptor(profile);
  const workspace = getTourWorkspaceDefinition(profile);
  /** Denali rail + urban slim tours share `DENALI_WORKSPACE` but only `denali_pilot` runs trip invariants. */
  const skipWorkspaceTripDetails =
    workspace?.validation != null &&
    descriptor.strip.clearsRootTransportModes &&
    descriptor.inactiveFieldGroups.includes("logistics");

  return {
    profile,
    invariantHints: descriptor.invariants,
    workspaceValidation: workspace?.validation ?? null,
    inactiveFieldGroups: descriptor.inactiveFieldGroups,
    appliesWorkspaceTripDetailsValidation:
      workspace?.validation != null && !skipWorkspaceTripDetails,
    workspaceTripDetailsValidationPhase:
      workspace?.validation != null && !skipWorkspaceTripDetails
        ? profile === "denali_pilot"
          ? "before_canonical"
          : "after_canonical"
        : "never",
  };
}

export function buildFieldStripRules(
  profile: TourFormProfile,
  options: { appliesDenaliSingleDayLogisticsStrip: boolean },
): WorkspaceFieldStripRules {
  const { strip } = getTourFormProfileDescriptor(profile);

  return {
    profile,
    strip,
    appliesDenaliSingleDayLogisticsStrip: options.appliesDenaliSingleDayLogisticsStrip,
  };
}

export function buildWizardConfig(profile: TourFormProfile): WorkspaceWizardConfig {
  const descriptor = getTourFormProfileDescriptor(profile);
  const workspace = getTourWorkspaceDefinition(profile);

  return {
    profile,
    wizardMode: workspace?.ui.wizardMode ?? "classic",
    roots: workspace?.roots ?? [],
    inactiveFieldGroups: descriptor.inactiveFieldGroups,
    wizardCapacityStepRedundant: descriptor.wizardCapacityStepRedundant,
    workspaceDefinitionVersion: workspace?.version ?? null,
  };
}

export function buildPublishPolicy(
  profile: TourFormProfile,
  options: {
    publishGeolocationCheck:
      | ((_tripDetails: unknown) => WorkspaceInvariantViolation | null)
      | null;
  },
): WorkspacePublishPolicy {
  const workspace = getTourWorkspaceDefinition(profile);

  return {
    profile,
    publishLifecycleStatus: workspace?.lifecycle.publishStatus ?? "OPEN",
    requiresDraftBeforePublish: true,
    openReadinessFields: OPEN_READINESS_FIELDS,
    publishGeolocationCheck: options.publishGeolocationCheck,
    allowedLifecycleTransitions:
      workspace?.lifecycle.allowedTransitions ?? CLASSIC_ALLOWED_LIFECYCLE_TRANSITIONS,
  };
}
