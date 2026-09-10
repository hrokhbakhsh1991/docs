import {
  isTicketingModuleEnabled as isTicketingModuleEnabledCore,
  parseEnabledModulesFromTheme,
  type TicketingModuleEnablementBindings,
} from "@app-tour/workspace-sdk/ticketing";

import {
  isTicketingDefaultEnabledWhenModulesUnset,
  isTicketingSupportedWorkspace,
} from "./workspace-ticketing-bindings.generated.ts";

const TICKETING_MODULE_BINDINGS: TicketingModuleEnablementBindings = {
  isSupportedWorkspace: isTicketingSupportedWorkspace,
  isDefaultEnabledWhenModulesUnset: isTicketingDefaultEnabledWhenModulesUnset,
};

export { parseEnabledModulesFromTheme };

export function isTicketingModuleEnabled(theme: unknown, workspaceType: string): boolean {
  return isTicketingModuleEnabledCore(theme, workspaceType, TICKETING_MODULE_BINDINGS);
}
