import { WORKSPACE_WIZARD_EXTENDED_CREATE_PLUGIN_IDS } from "@/bootstrap/wizard-create-bindings.generated";

/** Workspaces with extended operator chrome (finance, team, welcome flows). */
export function isExtendedOperatorWorkspace(pluginId: string): boolean {
  return WORKSPACE_WIZARD_EXTENDED_CREATE_PLUGIN_IDS.has(pluginId);
}
