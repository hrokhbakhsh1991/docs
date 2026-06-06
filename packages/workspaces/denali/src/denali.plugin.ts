import {
  type WorkspacePlugin,
  WORKSPACE_THEME_CSS_VARIABLE,
  workspaceThemePresets,
} from "@app-tour/workspace-sdk";

import {
  buildDenaliWizardRoots,
  buildDenaliWorkspaceFieldRegistry,
  buildDenaliWorkspaceRuleSet,
} from "./denali-plugin-adapter";
import { denaliRuleSet } from "./rules/denaliRuleModel";

/** Relative to workspace package root — published via package exports. */
export const DENALI_THEME_TOKENS_STYLESHEET = "theme/tokens.css" as const;

export const DENALI_WORKSPACE_PLUGIN_ID = "denali" as const;
export const DENALI_WORKSPACE_TYPE = "denali" as const;

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

const denaliTheme = {
  ...workspaceThemePresets["platform-primary"],
  optionalStylesheet: DENALI_THEME_TOKENS_STYLESHEET,
  cssVariables: {
    [WORKSPACE_THEME_CSS_VARIABLE.colorAccent]: "var(--color-primary)",
  },
} as const;

export function createDenaliWorkspacePlugin(): WorkspacePlugin {
  return deepFreeze({
    id: DENALI_WORKSPACE_PLUGIN_ID,
    version: 1,
    contractVersion: 1,
    supportedWorkspaceTypes: deepFreeze([DENALI_WORKSPACE_TYPE]),
    fieldRegistry: DENALI_FIELD_REGISTRY,
    ruleSet: DENALI_RULE_SET,
    wizard: DENALI_WIZARD_SURFACE,
    validation: {
      checkCapacity: () => null,
      checkTripDetails: () => null,
    },
    lifecycle: DENALI_LIFECYCLE,
    theme: deepFreeze({ ...denaliTheme }),
  });
}

export const denaliWorkspacePlugin = Object.freeze(createDenaliWorkspacePlugin()) as ReturnType<
  typeof createDenaliWorkspacePlugin
>;

export function getDenaliWorkspacePlugin(): typeof denaliWorkspacePlugin {
  return denaliWorkspacePlugin;
}
