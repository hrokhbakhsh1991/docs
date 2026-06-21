export const PLATFORM_CORE_VERSION = 1 as const;

export type PlatformCoreVersion = typeof PLATFORM_CORE_VERSION;

export { PlatformWizardEngine, type PlatformWizardEngineOptions } from "./engine/platform-wizard.engine";

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
