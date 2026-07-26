import { createPlatformWizardHostHooks } from "@app-tour/platform-core";
import {
  getStarterWorkspacePlugin as getSdkStarterWorkspacePlugin,
  STARTER_THEME_TOKENS_STYLESHEET,
  type WorkspacePlugin,
} from "@app-tour/workspace-sdk";

import { starterExposureSurface } from "./exposure/starter-exposure.surface";

const starterWizardHostHooks = createPlatformWizardHostHooks({
  dimensions: { variant: "default" },
});

function attachStarterWizardHost(plugin: WorkspacePlugin): WorkspacePlugin {
  const wizardHost = Object.freeze({
    ...starterWizardHostHooks,
    compositeSurfaceId: "platform",
    reviewSurfaceId: "platform",
  });
  return Object.freeze({
    ...plugin,
    exposureSurface: Object.freeze({ ...starterExposureSurface }),
    wizardHost,
    capabilities: Object.freeze({ wizardHost }),
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

/** Canonical host-contract getter (manifest plugin/web.export; Phase 4p). */
export function getWorkspacePlugin(): typeof starterWorkspacePlugin {
  return getStarterWorkspacePlugin();
}

export { STARTER_THEME_TOKENS_STYLESHEET };
