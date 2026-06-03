import { createStarterWorkspacePlugin } from "@app-tour/workspace-sdk/plugin";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";
import { workspaceThemePresets } from "@app-tour/workspace-sdk/theme";

/** Fresh starter-shaped plugin per call via createStarterWorkspacePlugin (not SDK reference singleton). */
export function createTestStarterPlugin(): WorkspacePlugin {
  return createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
}

/** Alias — same factory semantics as {@link createTestStarterPlugin}. */
export const createFreshStarterPlugin = createTestStarterPlugin;

export function testStarterFieldRegistry() {
  return createTestStarterPlugin().fieldRegistry;
}

export function testStarterRuleSet() {
  return createTestStarterPlugin().ruleSet;
}

export function testStarterWizardSurface() {
  return createTestStarterPlugin().wizard;
}
