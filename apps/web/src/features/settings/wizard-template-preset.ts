/**
 * Thin Shell Phase 4au — load full wizard-template preset via capabilities.templatePreset.
 * Generated binder deleted; fail-closed when capability omitted.
 */

import { resolveTemplatePresetCapability } from "@app-tour/workspace-sdk";

import type { WizardTemplatePayload } from "@/features/settings/wizard-template-types";
import { loadBootstrapWorkspacePlugin } from "@/bootstrap/resolve-bootstrap-workspace-plugin";

export async function loadFullWizardTemplatePreset(
  pluginId: string,
  seedLabel?: string
): Promise<WizardTemplatePayload> {
  const plugin = await loadBootstrapWorkspacePlugin(pluginId);
  const preset = resolveTemplatePresetCapability(plugin);
  if (preset == null) {
    throw new Error(`No wizard template preset for plugin: ${pluginId}`);
  }
  return (await preset.buildFullTemplatePreset(seedLabel)) as WizardTemplatePayload;
}
