export {
  FORBIDDEN_TICKETING_MODULE_DISABLED,
  TICKETING_MODULE_THEME_KEY,
  TICKETING_WORKSPACE_UNSUPPORTED,
} from "./ticketing-error-codes.js";
export {
  isTicketingModuleEnabled,
  parseEnabledModulesFromTheme,
  type TicketingModuleEnablementBindings,
} from "./ticketing-module-enabled.js";
export {
  getWorkspaceTicketingCapabilities,
  listTicketingCapableWorkspaceTypes,
  type WorkspaceTicketingCapabilities,
  type WorkspaceTicketingCategoryDefinition,
} from "../catalog/workspace-ticketing-capabilities.generated.js";
