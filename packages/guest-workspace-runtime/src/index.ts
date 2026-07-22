/// <reference path="./workspace-theme-css.d.ts" />

export { bindWorkspacePluginRegisterInvokers } from "./bind-workspace-plugin-register-invokers";
export {
  WORKSPACE_PLUGIN_REGISTER_IDS,
  WORKSPACE_PLUGIN_REGISTER_REVISION,
  invokeWorkspaceIntakeRegister,
  invokeWorkspacePluginRegister,
} from "./workspace-plugin-register-manifest.generated";
export {
  importGuestPortalThemeForPlugin,
  WORKSPACE_GUEST_PORTAL_DEFAULT_SKIN,
  WORKSPACE_GUEST_PORTAL_THEME_REGISTRY,
} from "./workspace-guest-theme-stylesheets.portal.generated";
export {
  importGuestMarketingThemeForPlugin,
  WORKSPACE_GUEST_MARKETING_DEFAULT_SKIN,
  WORKSPACE_GUEST_MARKETING_THEME_REGISTRY,
} from "./workspace-guest-theme-stylesheets.marketing.generated";
export {
  hasMarketingCatalogSurface,
  resolveMarketingCatalogSurface,
} from "./marketing-catalog";
export type {
  MarketingCatalogDetailPdpGates,
  MarketingCatalogSurface,
  MarketingCatalogTourSlice,
  MarketingCategoryGroup,
} from "./marketing-catalog-surface-types";
