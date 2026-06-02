export const PLATFORM_CORE_VERSION = 1 as const;

export type PlatformCoreVersion = typeof PLATFORM_CORE_VERSION;

export { PlatformWizardEngine } from "./engine/platform-wizard.engine";

export {
  PlatformCoreError,
  type PlatformCoreErrorCode,
} from "./errors/platform-core.error";

export type { RuleContext } from "./types/rule-context";
export type { RenderFieldPlan, RenderStepPlan } from "./types/render-plan";
export type { ValidationResult, ValidationViolation } from "./types/validation-result";
