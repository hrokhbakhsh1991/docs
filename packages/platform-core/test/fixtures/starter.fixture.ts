import { createStarterWorkspacePlugin } from "@app-tour/workspace-sdk/plugin";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";
import { workspaceThemePresets } from "@app-tour/workspace-sdk/theme";

/** Fresh starter-shaped plugin per call via createStarterWorkspacePlugin (not SDK reference singleton). */
export function createTestStarterPlugin(): WorkspacePlugin {
  return createStarterWorkspacePlugin(workspaceThemePresets["platform-primary"]);
}

/** JSON round-trip for parseWorkspacePluginFromStorage (strips runtime-only functions). */
export function pluginPayloadForStorageIngress(
  plugin: WorkspacePlugin,
): Record<string, unknown> {
  return JSON.parse(JSON.stringify(plugin)) as Record<string, unknown>;
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

/** Starter registry fields excluding ids replaced in a test-local registry overlay. */
export function testStarterFieldsExcept(...excludeIds: readonly string[]) {
  const exclude = new Set(excludeIds);
  return createTestStarterPlugin().fieldRegistry.fields.filter((field) => !exclude.has(field.id));
}
