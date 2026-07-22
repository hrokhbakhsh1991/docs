/**
 * Phase 8.1 — product-blind shell re-export of the canLoad contract (DEC-P8-004).
 * Gap Closure B.16 — CamelCase product policy symbols are not re-exported here;
 * Phase 8 / Wave H tests import those from the contract module.
 * @see docs/phase-8/appendices/CANLOAD-URBAN-SETTINGS.contract.ts
 * @see docs/dev/wave-h-workspace-owner-shell-typing.mdoc
 */
export {
  WORKSPACE_OWNER_SETTINGS_PLUGIN_ID,
  canLoadWorkspaceOwnerSettings,
  resolveWorkspaceOwnerSettingsPageBranch,
  type CanLoadWorkspaceOwnerSettingsParams,
  type CanLoadWorkspaceOwnerSettingsResult,
  type WorkspaceOwnerSettingsPageRenderBranch,
  CANLOAD_URBAN_SETTINGS_PLUGIN_ID,
  CANLOAD_URBAN_SETTINGS_SURFACE,
  URBAN_SETTINGS_ACCESS_MODULE,
  URBAN_SETTINGS_FORBIDDEN_DOM,
  URBAN_SETTINGS_FORBIDDEN_RULES,
  URBAN_SETTINGS_PAGE_MODULE,
  URBAN_SETTINGS_PAGE_PATH,
  URBAN_SETTINGS_PAGE_PATH_LEGACY,
} from "../../../../../../docs/phase-8/appendices/CANLOAD-URBAN-SETTINGS.contract";
