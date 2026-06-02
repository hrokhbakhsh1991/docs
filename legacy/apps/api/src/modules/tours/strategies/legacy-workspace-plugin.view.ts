import type {
  WorkspaceFieldRegistry,
  WorkspaceLifecycleContract,
  WorkspacePlugin,
  WorkspacePluginId,
  WorkspaceRuleSet,
  WorkspaceValidationHooks,
  WorkspaceWizardMode,
  WorkspaceWizardSurface,
} from "@repo/workspace-sdk";
import { noopWorkspaceValidationHooks } from "@repo/workspace-sdk";
import type { TourFormProfile } from "@repo/types";

import type { IWorkspaceStrategy } from "./workspace.strategy.interface";
import type { WorkspaceWizardMode as ApiWorkspaceWizardMode } from "./workspace.strategy.interface";

function mapApiWizardModeToSdk(mode: ApiWorkspaceWizardMode): WorkspaceWizardMode {
  return mode === "denali" ? "schema" : "classic";
}

function pluginIdForProfile(profile: TourFormProfile): WorkspacePluginId {
  return `legacy:${profile}`;
}

/**
 * Phase 1.3b — read-only {@link WorkspacePlugin} view from legacy {@link IWorkspaceStrategy}
 * (no behavior change; used for contract tests and future registry loader).
 */
export function buildWorkspacePluginViewFromStrategy(
  strategy: IWorkspaceStrategy,
): WorkspacePlugin {
  const wizardConfig = strategy.getWizardConfig();
  const validationRules = strategy.getValidationRules();
  const publishPolicy = strategy.getPublishPolicy();
  const workspaceValidation = validationRules.workspaceValidation;

  const wizard: WorkspaceWizardSurface = {
    wizardMode: mapApiWizardModeToSdk(wizardConfig.wizardMode),
    railId: wizardConfig.wizardMode === "denali" ? "denali" : "generic_base",
    roots: wizardConfig.roots,
    inactiveFieldGroups: [...validationRules.inactiveFieldGroups],
    wizardCapacityStepRedundant: wizardConfig.wizardCapacityStepRedundant,
  };

  const fieldRegistry: WorkspaceFieldRegistry = {
    version: wizardConfig.workspaceDefinitionVersion ?? 0,
    fields: [],
  };

  const ruleSet: WorkspaceRuleSet = {
    version: 0,
    matrixDimensions: [],
    cells: [],
    defaultCellId: "legacy",
  };

  const lifecycle: WorkspaceLifecycleContract = {
    initialStatus: publishPolicy.allowedLifecycleTransitions.length
      ? "DRAFT"
      : "DRAFT",
    publishStatus: publishPolicy.publishLifecycleStatus,
    allowedTransitions: [...publishPolicy.allowedLifecycleTransitions],
  };

  const validation: WorkspaceValidationHooks =
    workspaceValidation != null
      ? {
          checkCapacity: (capacity) => workspaceValidation.checkCapacity(capacity),
          checkTripDetails: (tripDetails, transportModes) =>
            workspaceValidation.checkTripDetails(tripDetails, transportModes),
        }
      : noopWorkspaceValidationHooks;

  return {
    id: pluginIdForProfile(strategy.profile),
    version: wizardConfig.workspaceDefinitionVersion ?? 1,
    supportedProfiles: [strategy.profile],
    fieldRegistry,
    ruleSet,
    wizard,
    validation,
    lifecycle,
  };
}
