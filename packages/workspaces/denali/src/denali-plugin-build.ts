import { WORKSPACE_THEME_CSS_VARIABLE, workspaceThemePresets } from "@app-tour/workspace-sdk";

import {
  buildDenaliWizardRoots,
  buildDenaliWorkspaceFieldRegistry,
  buildDenaliWorkspaceRuleSet,
} from "./denali-plugin-adapter";
import { denaliRuleSet } from "./rules/denaliRuleModel";
import {
  buildDenaliTokenBridgeContexts,
  DENALI_GUEST_SURFACE_CSS_VARIABLES,
} from "./theme/denali-token-bridge";
import { DENALI_THEME_ADMIN_STYLESHEET } from "./denali-identity";

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value)) {
      deepFreeze(child);
    }
  }
  return value;
}

export const DENALI_FIELD_REGISTRY = buildDenaliWorkspaceFieldRegistry();
export const DENALI_RULE_SET = buildDenaliWorkspaceRuleSet(denaliRuleSet, DENALI_FIELD_REGISTRY);

export const DENALI_WIZARD_SURFACE = deepFreeze({
  wizardMode: "classic" as const,
  railId: "denali_base",
  roots: buildDenaliWizardRoots(),
  inactiveFieldGroups: [],
  wizardCapacityStepRedundant: false,
});

export const DENALI_LIFECYCLE = deepFreeze({
  initialStatus: "DRAFT",
  publishStatus: "OPEN",
  allowedTransitions: [{ from: "DRAFT", to: "OPEN" }],
});

export const denaliTokenBridge = buildDenaliTokenBridgeContexts();

export const denaliAdminThemeCssVariables = {
  ...denaliTokenBridge.admin.cssVariables,
  [WORKSPACE_THEME_CSS_VARIABLE.colorAccent]: "var(--color-primary)",
} as const;

export const denaliWorkspaceTheme = deepFreeze({
  ...workspaceThemePresets["platform-primary"],
  optionalStylesheet: DENALI_THEME_ADMIN_STYLESHEET,
  cssVariables: denaliAdminThemeCssVariables,
});

export { DENALI_GUEST_SURFACE_CSS_VARIABLES };
