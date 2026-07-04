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
  isWorkspaceLifecycleTransitionAllowed,
  isWorkspaceUnpublishTransitionAllowed,
  type WorkspaceValidationHooks,
  type WorkspaceViolation,
  type WorkspaceWizardMode,
  type WorkspaceWizardSurface,
  type WorkspaceWizardHostHooks,
  type WorkspaceWizardHostPluginContext,
  type WorkspaceWizardMediaHooks,
  type WorkspaceWizardDraftEnvelope,
  type WorkspaceWizardDraftMeta,
  type WorkspaceWizardTemplateGateNormalizeInput,
  type WorkspaceWizardTemplateGateNormalizeResult,
  type WizardDraftValidationResult,
  type WizardDraftValidationViolation,
  noopWorkspaceDraftTombstoneBinding,
  topLevelRootsRemoved,
  isNonEmptyRootValue,
  type WorkspaceDraftTombstoneBinding,
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
export {
  assertOperatorAvatarKeyScope,
  buildOperatorAvatarObjectKey,
  isOperatorAvatarContentType,
  isOperatorAvatarStorageKey,
  OPERATOR_AVATAR_ALLOWED_CONTENT_TYPES,
  OPERATOR_AVATAR_MAX_BYTES,
  assertOperatorAvatarBytesMatchContentType,
  sniffOperatorAvatarContentType,
  type OperatorMembershipAvatar,
} from "./operator/identity/operator-avatar";
export {
  isOperatorProfileGender,
  OPERATOR_PROFILE_GENDERS,
  type OperatorProfileGender,
} from "./operator/identity/operator-profile-gender";
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
  validateFieldPolicyManifest,
  type WorkspaceFieldKind,
  type WorkspaceFieldPolicyDefinition,
  type WorkspaceFieldPolicyManifest,
  type WorkspaceFieldPolicyRule,
  type WorkspaceFieldPolicyState,
  type WorkspaceFieldPolicySurface,
  type WorkspaceSimpleCondition,
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
  validateIntegrationSurface,
  type IntegrationFieldKind,
  type IntegrationFieldSchema,
  type WorkspaceIntegrationEventMapping,
  type WorkspaceIntegrationEventPolicyDefault,
  type WorkspaceIntegrationProviderSurface,
  type WorkspaceIntegrationSurface,
} from "./operator/integrations/workspace-integration-surface";
export {
  validateExposureSurface,
  type WorkspaceExposureSurface,
  type WorkspaceExposureSurfaceDefinition,
} from "./exposure/workspace-exposure-surface";
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
  type PublicCatalogGearItem,
  type PublicCatalogGatheringPoint,
  type PublicCatalogItineraryDay,
  type PublicCatalogItinerarySegment,
  type PublicCatalogSurface,
  type PublicCatalogTourInput,
  type PublicCatalogTransportMode,
  type PublicCatalogTransportSnapshot,
  isPublicCatalogOrganizedTransportMode,
} from "./tour/public-catalog.contract";
export {
  resolveCatalogListApiPath,
  resolveCatalogTourApiPath,
  UnknownCatalogPluginError,
} from "./catalog/resolve-catalog-api-path";
export {
  resolveGuestConformanceLevelForPlugin,
  GuestConformanceNotConfiguredError,
  type WorkspaceGuestConformanceLevel,
} from "./catalog/resolve-guest-conformance-level";
export { WORKSPACE_GUEST_CONFORMANCE_LEVELS } from "./catalog/workspace-guest-conformance.generated";
export {
  resolveCatalogListFeatures,
  catalogListSupportsServerFilter,
  type CatalogListFeatures,
  type CatalogListServerFilterParam,
  UnknownCatalogPresentationPluginError,
} from "./catalog/resolve-catalog-list-features";
export {
  resolveCatalogDetailSections,
  type CatalogDetailSections,
} from "./catalog/resolve-catalog-detail-sections";
export {
  resolveGuestLandingFeatures,
  UnknownGuestLandingPluginError,
  type GuestLandingFeatures,
  type GuestLandingVariant,
} from "./catalog/resolve-guest-landing-features";
export { WORKSPACE_GUEST_LANDING } from "./catalog/workspace-guest-landing.generated";
export {
  resolveGuestSeoForPlugin,
  GuestSeoNotConfiguredError,
  type WorkspaceGuestSeoConfig,
  type WorkspaceGuestSeoMarketing,
} from "./catalog/resolve-guest-seo-for-plugin";
export { WORKSPACE_GUEST_SEO } from "./catalog/workspace-guest-seo.generated";
export { validateStructuredData, type StructuredDataValidationResult } from "./seo/validate-structured-data";
export { supportsCatalogRegistration } from "./catalog/resolve-catalog-registration-support";
export {
  resolveCatalogRegistrationApiPath,
  UnknownCatalogRegistrationPluginError,
} from "./catalog/resolve-catalog-registration-api-path";
export {
  type FieldRules,
  type IntakeField,
  type IntakeFieldType,
  type IntakeFieldWidget,
  type IntakeSchema,
  type IntakeSchemaContext,
  type IntakeSchemaFeatures,
  type IntakeSchemaTourRequirements,
  type IntakeSchemaValidationIssue,
  type WorkspaceCatalogIntakeSchemaProvider,
} from "./catalog/intake-schema";
export {
  type WorkspaceCatalogIntakeSurface,
} from "./catalog/workspace-catalog-intake-surface";
export {
  type WorkspaceCatalogIntakeTransportSurface,
} from "./catalog/catalog-intake-transport-surface";
export {
  clearWorkspaceIntakePluginRegistryForTests,
  getWorkspaceIntakePlugin,
  listWorkspaceIntakePluginIds,
  registerWorkspaceIntakePlugin,
} from "./catalog/workspace-intake-plugin-registry";
export {
  clearWorkspaceRegistrationFlowRegistryForTests,
  getWorkspaceRegistrationFlowPlugin,
  listWorkspaceRegistrationFlowPluginIds,
  registerWorkspaceRegistrationFlowPlugin,
} from "./catalog/workspace-registration-flow-registry";
export {
  type FlowEvent,
  type FlowRuntimeState,
  type FlowSubmitPayload,
  type FlowValidationIssue,
  type IntakeFlowDefinition,
  type RegistrationFlowContext,
  type RegistrationFlowDispatch,
  type RegistrationFlowStepProps,
  type RegistrationFlowTourRequirements,
  type WorkspaceCatalogRegistrationFlowSurface,
  mergeFlowState,
  transitionFlowStep,
} from "./catalog/registration-flow.contract";
export {
  IntakePluginNotRegisteredError,
  resolveEffectiveIntakeSchema,
  resolveIntakeSchema,
  resolveIntakeSubmitValues,
  validateIntakeSchemaValues,
} from "./catalog/resolve-intake-schema";
export {
  MEMBER_PROFILE_FIELD_IDS,
  type MemberProfileFieldId,
} from "./profile/member-profile-field-id";
export {
  MEMBER_PROFILE_DISPLAY_NAME_MAX_LENGTH,
  MEMBER_PROFILE_FATHER_NAME_MAX_LENGTH,
  validateMemberProfileBirthDate,
  validateMemberProfileDisplayName,
  validateMemberProfileFatherName,
  validateMemberProfileNationalId,
  resolveMemberProfileFieldValidator,
  type MemberProfileFieldValidator,
} from "./profile/member-profile-validators";
export {
  resolveMemberProfileCapabilities,
  MemberProfileNotConfiguredError,
  type MemberProfileCapabilities,
  type MemberProfileSection,
} from "./profile/resolve-member-profile-capabilities";
export {
  buildCatalogRegistrationUpstreamRequest,
  CatalogRegistrationPayloadInvalidError,
  type CatalogRegistrationPortalPayload,
  type CatalogRegistrationUpstreamRequest,
} from "./catalog/build-catalog-registration-upstream-request";
export {
  PUBLIC_CATALOG_REGISTRATION_TRANSPORT_KINDS,
  type PublicCatalogRegistrationTransportKind,
  type PublicCatalogTransportIntakeState,
} from "./catalog/public-catalog-transport-intake";
export {
  formatRegistrationIntakeTransportLabel,
  parseRegistrationIntakeRecord,
  type RegistrationIntakeRecord,
  type RegistrationIntakeTransport,
  type RegistrationRegistrantTarget,
} from "./operator/bookings/registration-intake.contract";
export {
  type DenaliPhotoRemintPlanEntry,
  type WizardPhotoRemintPlanEntry,
  type TourCloneHydrationInput,
  type TourCloneHydrationResult,
  type TourCloneHydrator,
} from "./tour/tour-clone-hydrator.contract";
