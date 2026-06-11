/** Root barrel surface — re-exported from `index.ts` only. */
export {
  assertCanonicalDocument,
  assertCanonicalDocumentRoots,
  assertCanonicalPathSegments,
  CanonicalDocumentValidationError,
  createCanonicalDocument,
  freezeCanonicalDocumentData,
  type CanonicalDocument,
  type CanonicalDocumentValidationErrorCode,
} from "./canonical/canonical-document";
export { assertStablePlainPrototype, readOwnDataProperty } from "./canonical/plain-object-shield";
export {
  parseCanonicalDocumentFromStorage,
  tryParseCanonicalDocumentFromStorage,
  type CanonicalIngressErrorCode,
} from "./ingress/parse-canonical-document";
export {
  parseWorkspacePluginFromStorage,
  tryParseWorkspacePluginFromStorage,
  type ParseWorkspacePluginOptions,
  type WorkspacePluginIngressErrorCode,
} from "./ingress/parse-workspace-plugin";
export {
  IngressSanitizationError,
  WorkspacePluginIngressError,
  WorkspaceThemeValidationError,
  sdkErr,
  sdkOk,
  type IngressSanitizationErrorCode,
  type SdkResult,
  workspaceSdkValidationErrorCode,
  type WorkspacePluginIngressErrorCode as WorkspacePluginRootIngressErrorCode,
  type WorkspaceThemeValidationErrorCode,
} from "./errors";
export {
  createStarterWorkspacePlugin,
  getStarterWorkspacePlugin,
  starterWorkspacePlugin,
  STARTER_THEME_TOKENS_STYLESHEET,
  explainWorkspacePluginRejection,
  isWorkspacePlugin,
  validateWorkspacePlugin,
  isWorkspaceSdkValidationError,
  assertWorkspacePlugin,
  assertWorkspaceThemeContract,
  STARTER_WORKSPACE_PLUGIN_ID,
  DEFAULT_WORKSPACE_TYPE_BINDINGS,
  resolveWorkspacePluginIdForType,
  STARTER_WORKSPACE_TYPE,
  workspaceTypesFromPlugin,
  isWorkspaceTypeId,
  noopWorkspaceValidationHooks,
  WorkspacePluginShapeError,
  type WorkspacePlugin,
  type WorkspacePluginId,
  type WorkspaceTypeBinding,
  type WorkspaceTypeId,
  type WorkspaceLifecycleContract,
  type WorkspaceLifecycleTransition,
  type WorkspaceValidationHooks,
  type WorkspaceViolation,
  type WorkspaceWizardMode,
  type WorkspaceWizardSurface,
  type WorkspaceSdkValidationError,
  type WorkspaceSdkValidationErrorCode,
  type WorkspacePluginValidationErrorCode,
} from "./plugin/index";
export {
  tryValidateTenantTheme,
  validateTenantTheme,
  snapshotWorkspaceTheme,
  getWorkspaceThemePresets,
  workspaceThemePresets,
  WORKSPACE_THEME_CSS_VARIABLE,
  workspaceAccentCssValue,
  normalizeThemeCssKey,
  normalizeTenantCssKey,
  type TenantThemeConfig,
  type TenantBrandLogo,
  assertTenantBrandLogoKeyTenantScope,
  buildTenantBrandLogoObjectKey,
  isTenantBrandLogoContentType,
  isTenantBrandLogoStorageKey,
  TENANT_BRAND_LOGO_ALLOWED_CONTENT_TYPES,
  TENANT_BRAND_LOGO_MAX_BYTES,
  assertTenantBrandLogoBytesMatchContentType,
  sniffTenantBrandLogoContentType,
  isTenantBrandingEmpty,
  resolveEffectiveTenantBranding,
  type WorkspaceThemeContract,
  type SealedTenantTheme,
  type SealedWorkspaceTheme,
  type WorkspaceThemeCssVariable,
  type WorkspaceThemePresetId,
  assertWorkspaceThemeSealed,
  assertTenantThemeSealed,
} from "./theme/index";
export { tryParseTenantAuthContext, type AuthContextErrorCode } from "./auth/validate-auth-context";
export {
  buildTenantAuthz,
  canAccessWorkspaceTheme,
  createTenantAuthz,
  isWorkspaceOwner,
  parseTenantAuthContext,
} from "./auth/index";
export type {
  ActorRole,
  MembershipStatus,
  TenantAuthContext,
  TenantAuthz,
  WorkspaceAuthSurface,
  WorkspaceOwnerMutationPolicy,
  ScopedTenantAuthz,
  CanAccessWorkspaceThemeAuthzParams,
  WorkspaceThemeSubject,
} from "./auth/index";
export {
  getWorkspaceRuleCell,
  type WorkspaceFieldKind,
  type WorkspaceFieldRegistry,
  type WorkspaceFieldRegistryEntry,
  type WorkspaceRuleCell,
  type WorkspaceRuleFieldOverride,
  type WorkspaceRuleSet,
} from "./registry";
export {
  validateRegistrationOpsManifest,
  type OperatorRegistrationOpsSurface,
  type RegistrationOpsFilterId,
  type RegistrationOpsKpiCardId,
  type RegistrationOpsManifest,
  type RegistrationOpsViewId,
} from "./operator/bookings/registration-ops-manifest";
export {
  validateSettingsManifest,
  type OperatorSettingsSurface,
  type SettingsModuleKind,
  type SettingsModuleManifest,
  type SettingsNavGroup,
} from "./operator/settings/settings-module-manifest";
export {
  buildTourListProjection,
  type OperatorTourListSurface,
  type TourListProjection,
  type TourListProjectionFields,
  type TourListProjectionExtractor,
  type TourListRowMeta,
  type TourListStatus,
  type TourUiStatus,
} from "./tour/tour-list-projection.contract";
export {
  type PublicCatalogCard,
  type PublicCatalogSurface,
  type PublicCatalogTourInput,
} from "./tour/public-catalog.contract";
export {
  resolveCatalogListApiPath,
  resolveCatalogTourApiPath,
  UnknownCatalogPluginError,
} from "./catalog/resolve-catalog-api-path";
export {
  type DenaliPhotoRemintPlanEntry,
  type TourCloneHydrationInput,
  type TourCloneHydrationResult,
  type TourCloneHydrator,
} from "./tour/tour-clone-hydrator.contract";
