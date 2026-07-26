/**
 * Workspaces with extended operator chrome (finance, team, welcome, flat-edit create).
 * Runtime SoT: capabilities.wizardCreate (Phase 4bg) — warm cache after ensure/seed.
 */
import { isWizardExtendedCreatePlugin } from "@/workspace/wizard-create-registry";

export function isExtendedOperatorWorkspace(pluginId: string): boolean {
  return isWizardExtendedCreatePlugin(pluginId);
}
