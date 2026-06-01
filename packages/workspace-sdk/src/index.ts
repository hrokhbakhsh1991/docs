/**
 * @repo/workspace-sdk — workspace plugin contract (`map.md` Phase 1).
 */
export const WORKSPACE_SDK_VERSION = 1 as const;

export type WorkspaceSdkVersion = typeof WORKSPACE_SDK_VERSION;

export {
  assertCanonicalDocumentRoots,
  CanonicalDocumentValidationError,
  createCanonicalDocument,
  type CanonicalDocument,
} from "./canonical/canonical-document";

export { mockWorkspacePlugin } from "./mock/mock-workspace.plugin";

export {
  isWorkspacePlugin,
  type WorkspacePlugin,
} from "./plugin/workspace-plugin";

export {
  MOCK_WORKSPACE_PLUGIN_ID,
  type WorkspacePluginId,
} from "./plugin/workspace-plugin-id";

export {
  DEFAULT_WORKSPACE_PROFILE_BINDINGS,
  resolveWorkspacePluginIdForProfile,
  type WorkspaceProfileBinding,
} from "./plugin/workspace-profile-binding";

export {
  type WorkspaceLifecycleContract,
  type WorkspaceLifecycleTransition,
} from "./plugin/workspace-lifecycle";

export {
  noopWorkspaceValidationHooks,
  type WorkspaceValidationHooks,
  type WorkspaceViolation,
} from "./plugin/workspace-validation";

export {
  type WorkspaceWizardMode,
  type WorkspaceWizardSurface,
} from "./plugin/workspace-wizard-surface";

export {
  type WorkspaceFieldKind,
  type WorkspaceFieldRegistry,
  type WorkspaceFieldRegistryEntry,
} from "./registry/field-registry";

export {
  getWorkspaceRuleCell,
  type WorkspaceRuleCell,
  type WorkspaceRuleFieldOverride,
  type WorkspaceRuleSet,
} from "./registry/rule-set";
