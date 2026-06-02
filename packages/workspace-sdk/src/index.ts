export const WORKSPACE_SDK_VERSION = 1 as const;

export type WorkspaceSdkVersion = typeof WORKSPACE_SDK_VERSION;

export {
  assertCanonicalDocument,
  assertCanonicalDocumentRoots,
  assertCanonicalPathSegments,
  CanonicalDocumentValidationError,
  createCanonicalDocument,
  freezeCanonicalDocumentData,
  type CanonicalDocument,
  type CanonicalDocumentValidationErrorCode,
} from "./canonical/canonical-document";

export {
  assertPlainObjectShield,
  assertStablePlainPrototype,
  readOwnDataProperty,
} from "./canonical/plain-object-shield";

export { parseCanonicalDocumentFromStorage } from "./ingress/parse-canonical-document";
export { parseWorkspacePluginFromStorage } from "./ingress/parse-workspace-plugin";

export { starterWorkspacePlugin } from "./reference/starter-workspace.plugin";

export {
  assertWorkspacePlugin,
  isWorkspacePlugin,
  WorkspacePluginValidationError,
  type WorkspacePlugin,
  type WorkspacePluginValidationErrorCode,
} from "./plugin/workspace-plugin";

export {
  STARTER_WORKSPACE_PLUGIN_ID,
  type WorkspacePluginId,
} from "./plugin/workspace-plugin-id";

export {
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  resolveWorkspacePluginIdForType,
  type WorkspaceTypeBinding,
} from "./plugin/workspace-type-binding";

export {
  isWorkspaceTypeId,
  STARTER_WORKSPACE_TYPE,
  workspaceTypesFromPlugin,
  type WorkspaceTypeId,
} from "./plugin/workspace-type";

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
