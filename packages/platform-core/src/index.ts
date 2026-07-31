export const PLATFORM_CORE_VERSION = 1 as const;

export type PlatformCoreVersion = typeof PLATFORM_CORE_VERSION;

export { PlatformWizardEngine, stripWorkspacePluginForWizardEngine, type PlatformWizardEngineOptions } from "./engine/platform-wizard.engine";

export {
  PlatformCoreError,
  type PlatformCoreErrorCode,
} from "./errors/platform-core.error";

export {
  platformFail,
  platformOk,
  platformErr,
  isPlatformCoreError,
  type PlatformResult,
} from "./errors/platform-result";

export type { RuleContext } from "./types/rule-context";
export type { RenderFieldPlan, RenderStepPlan } from "./types/render-plan";
export type { ValidationResult, ValidationViolation } from "./types/validation-result";

export {
  createPlatformWizardHostHooks,
  type PlatformWizardHostHooksOptions,
} from "./host/create-platform-wizard-host-hooks";

export {
  resolveWorkspaceThemeTokens,
  validateWorkspaceThemeTokenMap,
  WorkspaceThemeTokenValidationError,
  type WorkspaceDefinitionThemeTokensInput,
} from "./theme/resolve-workspace-theme-tokens";

export { getCanonicalValue } from "./utils/canonical-path";

export {
  adaptWorkspaceFieldRegistryToFieldDefinitions,
  adaptWorkspaceFieldPolicyManifest,
  adaptWorkspaceRuleSetToFieldPolicy,
  evaluateSimpleCondition,
  filterDeliveryEligibleFields,
  resolveFieldState,
  FIELD_POLICY_ENTITY_PATH,
  type FieldDefinition,
  type FieldDefinitionKind,
  type FieldPolicyEntityState,
  type FieldPolicyRule,
  type FieldPolicyState,
  type FieldPolicySurface,
  type FilterDeliveryEligibleFieldsInput,
  type ResolvedFieldState,
  type ResolveFieldStateInput,
  type SimpleCondition,
  type UnsupportedWorkspaceRuleCell,
  type WorkspaceFieldPolicyManifestAdapterInput,
  type WorkspaceFieldRegistryDefinitionsAdapterInput,
  type WorkspaceRuleSetPolicyAdapterInput,
  type WorkspaceRuleSetPolicyAdapterResult,
  groupFieldPresentations,
  resolveFieldPresentation,
  type FieldPresentation,
} from "./field-policy";

export {
  normalizeIntegrationEventType,
  resolveFieldExposureDecision,
  type ExposureDecision,
  type ExposureDecisionLegacyComparison,
  type ExposureDecisionState,
  type FieldExposureDecisionInput,
  type NormalizedExposureTrigger,
} from "./exposure";
