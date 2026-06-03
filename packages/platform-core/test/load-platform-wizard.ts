import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";

import { PlatformWizardEngine } from "../src/engine/platform-wizard.engine.js";
import { unwrapPlatformResult } from "../src/errors/platform-result.js";

/** Create + init via {@link PlatformWizardEngine.tryFromPlugin} (replaces removed `fromPlugin`). */
export function loadPlatformWizard(plugin: WorkspacePlugin): PlatformWizardEngine {
  return unwrapPlatformResult(PlatformWizardEngine.tryFromPlugin(plugin));
}
