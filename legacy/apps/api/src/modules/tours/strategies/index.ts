/**
 * Workspace strategy pattern (Phase 2) — contracts, implementations, registry.
 */
export type {
  IWorkspaceStrategy,
  WorkspaceFieldStripRules,
  WorkspacePublishPolicy,
  WorkspaceValidationRules,
  WorkspaceWizardConfig,
  WorkspaceWizardMode,
  WorkspaceWizardRoots,
} from "./workspace.strategy.interface";

export {
  buildFieldStripRules,
  buildPublishPolicy,
  buildValidationRules,
  buildWizardConfig,
} from "./workspace.strategy.builders";

export { GeneralWorkspaceStrategy } from "./general.workspace.strategy";
export { MountainOutdoorWorkspaceStrategy } from "./mountain-outdoor.workspace.strategy";

export {
  DENALI_STRATEGY_PROFILES,
  isDenaliStrategyProfile,
  usesDenaliCanonicalTemplate,
  WorkspaceStrategyRegistry,
  type DenaliStrategyProfile,
} from "./workspace.strategy.registry";
