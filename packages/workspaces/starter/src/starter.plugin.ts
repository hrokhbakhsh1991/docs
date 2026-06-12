import { createPlatformWizardHostHooks } from "@app-tour/platform-core";
import {
  getStarterWorkspacePlugin as getSdkStarterWorkspacePlugin,
  STARTER_THEME_TOKENS_STYLESHEET,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

const starterWizardHostHooks = createPlatformWizardHostHooks({
  dimensions: { variant: "default" },
});

function attachStarterWizardHost(plugin: WorkspacePlugin): WorkspacePlugin {
  return Object.freeze({
    ...plugin,
    wizardHost: Object.freeze({ ...starterWizardHostHooks }),
  });
}

const starterWorkspacePlugin = attachStarterWizardHost(getSdkStarterWorkspacePlugin());

/**
 * Production starter plugin — SDK reference + platform wizard host hooks (Phase 12.8).
 * @see packages/workspaces/starter/test/sdk-reference-parity.spec.ts
 */
export function getStarterWorkspacePlugin(): typeof starterWorkspacePlugin {
  return starterWorkspacePlugin;
}

export { STARTER_THEME_TOKENS_STYLESHEET };
