/** Root barrel surface — re-exported from `index.ts` only. */
export {
  clearWorkspaceMemberPortalRenderersForTests,
  getWorkspaceMemberPortalRenderer,
  registerWorkspaceMemberPortalRenderers,
} from "./portal/member-portal-renderer-registry";
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
  type ValidationMode,
  type WorkspacePolicyValidator,
  type WorkspaceValidationCatalogRefAllowlists,
  type WorkspaceValidationPipeline,
  type WorkspaceValidationPipelineContext,
  type WorkspaceValidationPipelineStage,
  type WorkspaceValidationPipelineStageId,
  type WorkspaceValidationPipelineViolation,
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
  type WorkspacePluginCapabilities,
  type WorkspacePluginCapabilityHostSlice,
  type WorkspaceHostProbeCapability,
  type WorkspaceDraftShellCapability,
  type WorkspaceCreateChromeCapability,
  type WorkspaceFlatEditChromeCapability,
  type WorkspaceCreateViewCapability,
  type WorkspaceFlatEditFormCapability,
  type WorkspaceFlatEditPageCapability,
  type WorkspaceTemplateGateCapability,
  type WorkspaceOperatorUiCapability,
  type WorkspaceTourActionSubmitCapability,
  type WorkspaceTourActionSubmitErrorPayload,
  type WorkspaceLabelsCapability,
  type WorkspaceWizardSurfacesCapability,
  type WorkspaceTemplatePresetCapability,
  type WorkspaceSettingsHubFallbackCapability,
  type WorkspaceTemplateEditorCapability,
  type WorkspaceTemplateEditorCatalogFieldMeta,
  type WorkspaceTourListCategoryCapability,
  type WorkspaceTourCommercialCapability,
  type WorkspaceTourListCategoryFilterGroup,
  type WorkspaceSettingsDestinationCapability,
  type WorkspaceSettingsDestinationLocationType,
  type WorkspaceSettingsDestinationMetadataField,
  type WorkspaceSettingsDestinationLocationTypeEntry,
  type WorkspaceSettingsEquipmentUiCapability,
  type WorkspaceSettingsExposureSurfacesUiCapability,
  type WorkspaceOperatorShellNavCapability,
  type WorkspaceOperatorShellNavLink,
  type WorkspaceFinanceNavCapability,
  type WorkspaceFinanceOpsCapability,
  type WorkspaceBookingOpsCapability,
  type WorkspaceWizardCreateCapability,
  resolveWizardHostCapability,
  ensureWizardHostReady,
  resolveHostProbeCapability,
  resolveDraftShellCapability,
  resolveCreateChromeCapability,
  ensureCreateChromeReady,
  resolveFlatEditChromeCapability,
  ensureFlatEditChromeReady,
  resolveCreateViewCapability,
  ensureCreateViewReady,
  resolveFlatEditFormCapability,
  ensureFlatEditFormReady,
  resolveFlatEditPageCapability,
  ensureFlatEditPageReady,
  resolveTemplateGateCapability,
  resolveOperatorUiCapability,
  ensureOperatorUiReady,
  resolveTourActionSubmitCapability,
  resolveLabelsCapability,
  ensureLabelsReady,
  resolveWizardSurfacesCapability,
  ensureWizardSurfacesReady,
  resolveTemplatePresetCapability,
  resolveSettingsHubFallbackCapability,
  resolveTemplateEditorCapability,
  resolveTourListCategoryCapability,
  resolveTourCommercialCapability,
  resolveSettingsDestinationCapability,
  resolveSettingsEquipmentUiCapability,
  ensureSettingsEquipmentUiReady,
  resolveSettingsExposureSurfacesUiCapability,
  ensureSettingsExposureSurfacesUiReady,
  resolveOperatorShellNavCapability,
  resolveFinanceNavCapability,
  resolveFinanceCaseMeaningCapability,
  resolveFinanceOpsCapability,
  resolveBookingOpsCapability,
  resolveMemberPortalRenderersCapability,
  resolveWizardCreateCapability,
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
  resolveTenantBrandingDisplayName,
  getWorkspaceThemePresets,
  workspaceThemePresets,
  WORKSPACE_THEME_CSS_VARIABLE,
  workspaceAccentCssValue,
  normalizeThemeCssKey,
  normalizeTenantCssKey,
  type TenantDefaultLocale,
  type TenantThemeConfig,
  type TenantBrandingDisplayNameSource,
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
  createCanPerformWorkspaceOwnerMutation,
  isWorkspaceAuthSurfaceAllowed,
  isWorkspaceAuthSurfaceInAllowlist,
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
  CanPerformWorkspaceOwnerMutation,
  WorkspaceThemeSubject,
} from "./auth/index";
export {
  getWorkspaceRuleCell,
  mergeWorkspaceFieldRegistryWithEquipmentFragments,
  mergeWorkspaceFieldRegistryWithDifficultyFitnessFragments,
  mergeWorkspaceFieldRegistryWithTransportFragments,
  mergeWorkspaceFieldRegistryWithItineraryFragments,
  mergeWorkspaceFieldRegistryWithPricingFragments,
  validateFieldPolicyManifest,
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
export type { WorkspaceFieldKind } from "./registry/field-registry";
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
  type WorkspaceCanonicalDeliveryProjectionInput,
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
  type TourListProjectionBinding,
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
  type TourPublishVisibilityBinding,
  type TourPublishVisibilityPort,
  type TourPublishVisibilityPredicate,
} from "./tour/tour-publish-visibility.port";
export {
  type TourPublishVisibilityBucket,
  type WorkspacePublishLabelMapping,
  mapPublishLabelToVisibilityBucket,
  resolveLifecycleStatusFromVisibilityBucket,
} from "./tour/tour-publish-label-mapping.contract";
export {
  type MemberRegistrationDisplayStatus,
  MEMBER_REGISTRATION_DISPLAY_STATUSES,
  isMemberRegistrationDisplayStatus,
} from "./registration/member-registration-display-status";
export {
  type RegistrationCapacityStrategy,
  type RegistrationLifecycleProfile,
  type RegistrationModelContract,
  BOOKING_REGISTRATION_MODEL,
  URBAN_REGISTRATION_MODEL,
  registrationAwaitingOperatorDecision,
  registrationOccupiesSeat,
  registrationQueuedWithoutSeat,
  registrationTerminalNegative,
  registrationVoided,
} from "./registration/registration-model-divergence.contract";
export { resolveMemberRegistrationDisplayStatus } from "./portal/resolve-member-registration-display-status";
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
  resolveProductionCertificationForPlugin,
  ProductionCertificationNotConfiguredError,
  type WorkspaceProductionCertificationTier,
} from "./catalog/resolve-production-certification";
export { WORKSPACE_PRODUCTION_CERTIFICATION } from "./catalog/workspace-production-certification.generated";
export {
  resolveCatalogListFeatures,
  catalogListSupportsServerFilter,
  type CatalogListFeatures,
  type CatalogListServerFilterParam,
  UnknownCatalogPresentationPluginError,
} from "./catalog/resolve-catalog-list-features";
export {
  operatorCapabilitySupportsUsersDirectory,
  operatorCapabilitySupportsReconciliationTriage,
  operatorCapabilitySupportsFieldExposureSurfaces,
} from "./operator/resolve-operator-capabilities";
export { WORKSPACE_OPERATOR_CAPABILITIES } from "./operator/workspace-operator-capabilities.generated";
export {
  resolveCatalogDetailSections,
  type CatalogDetailSections,
} from "./catalog/resolve-catalog-detail-sections";
export {
  resolveCatalogPriceDisplay,
  type CatalogPriceDisplayPolicy,
} from "./catalog/resolve-catalog-price-display";
export {
  resolveGuestLandingFeatures,
  UnknownGuestLandingPluginError,
  type GuestLandingFeatures,
  type GuestLandingVariant,
} from "./catalog/resolve-guest-landing-features";
export { WORKSPACE_GUEST_LANDING } from "./catalog/workspace-guest-landing.generated";
export {
  getWorkspaceEquipmentCapabilities,
  type WorkspaceEquipmentCapabilities,
} from "./catalog/workspace-equipment-capabilities.generated";
export {
  getWorkspaceTransportCapabilities,
  type WorkspaceTransportCapabilities,
} from "./catalog/workspace-transport-capabilities.generated";
export {
  getWorkspaceDifficultyFitnessCapabilities,
  type WorkspaceDifficultyFitnessCapabilities,
} from "./catalog/workspace-difficulty-fitness-capabilities.generated";
export {
  resolveWorkspaceDifficultyFitnessFilterPresentation,
} from "./catalog/workspace-difficulty-fitness-filter-presentation.generated";
export {
  resolveCatalogTransportSnapshotReader,
  type CatalogTransportSnapshotReaderBinding,
  CATALOG_TRANSPORT_SNAPSHOT_READER_WORKSPACE_TYPES,
} from "./catalog/catalog-transport-snapshot-readers.generated";
export {
  resolveCatalogIntakeTransportSurface,
} from "./catalog/catalog-intake-transport-surfaces.generated";
export {
  defineWorkspaceEquipmentFieldFragment,
  listWorkspaceEquipmentCanonicalPaths,
  type WorkspaceEquipmentFieldFragment,
  type WorkspaceEquipmentFieldRegistryFragment,
  type WorkspaceEquipmentFieldWireProjection,
  type WorkspaceEquipmentTourFieldConfig,
} from "./equipment";
export {
  defineWorkspaceDifficultyFitnessFieldFragment,
  defineWorkspaceDifficultyFitnessFieldFragments,
  listWorkspaceDifficultyFitnessCanonicalPaths,
  type WorkspaceDifficultyFitnessFieldFragment,
  type WorkspaceDifficultyFitnessFieldRegistryFragment,
  type WorkspaceDifficultyFitnessFieldWireProjection,
  type WorkspaceDifficultyFitnessTourFieldConfig,
  type WorkspaceDifficultyFitnessFilterPresentation,
  type PublicCatalogDifficultyFitnessFields,
} from "./difficulty-fitness";
export {
  defineWorkspaceTransportFieldFragment,
  listWorkspaceTransportCanonicalPaths,
  type WorkspaceTransportFieldFragment,
  type WorkspaceTransportFieldRegistryFragment,
  type WorkspaceTransportTourFieldConfig,
  type WorkspaceTransportWizardCompositeBinding,
} from "./transport";
export {
  defineWorkspaceItineraryFieldFragment,
  listWorkspaceItineraryCanonicalPaths,
  type WorkspaceItineraryFieldFragment,
  type WorkspaceItineraryFieldRegistryFragment,
  type WorkspaceItineraryTourFieldConfig,
  type WorkspaceItineraryWizardCompositeBinding,
  type PublicCatalogItineraryFields,
} from "./itinerary";
export {
  getWorkspaceItineraryCapabilities,
  type WorkspaceItineraryCapabilities,
} from "./catalog/workspace-itinerary-capabilities.generated";
export {
  WORKSPACE_PRICING_ALLOW_MEMBERSHIP_DISCOUNT_CANONICAL_PATH,
  WORKSPACE_PRICING_BASE_PRICE_CANONICAL_PATH,
  defineWorkspacePricingFieldFragment,
  defineWorkspacePricingFieldsFragment,
  listWorkspacePricingCanonicalPaths,
  type WorkspacePricingFieldFragment,
  type WorkspacePricingFieldRegistryFragment,
  type WorkspacePricingTourFieldConfig,
  type WorkspacePricingWizardCompositeBinding,
} from "./pricing";
export {
  getWorkspacePricingCapabilities,
  type WorkspacePricingCapabilities,
} from "./catalog/workspace-pricing-capabilities.generated";
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
export { tryResolveCatalogRegistrationForTourApiPath } from "./catalog/resolve-catalog-registration-for-tour-api-path";
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
  applyCatalogRegistrationFlowEvent,
} from "./catalog/registration-flow.contract";
export {
  defineCatalogRegistrationFlowSurface,
  type CatalogRegistrationFlowState,
  type DefineCatalogRegistrationFlowSurfaceInput,
} from "./catalog/define-catalog-registration-flow-surface";
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
  classifyIranianNationalId,
  validateMemberProfileBirthDate,
  validateMemberProfileDisplayName,
  validateMemberProfileFatherName,
  validateMemberProfileGender,
  validateMemberProfileNationalId,
  resolveMemberProfileFieldValidator,
  type IranianNationalIdClass,
  type MemberProfileFieldValidator,
} from "./profile/member-profile-validators";
export {
  resolveMemberProfileCapabilities,
  MemberProfileNotConfiguredError,
  type MemberProfileCapabilities,
  type MemberProfileSection,
} from "./profile/resolve-member-profile-capabilities";
export {
  MEMBER_PORTAL_RESERVED_MODULE_IDS,
  validateMemberPortalManifest,
  type MemberModuleManifest,
  type MemberNavTier,
  type MemberPortalReservedModuleId,
  type MemberPortalSurface,
} from "./portal/member-module-manifest";
export {
  evaluateMemberPortalEntitlements,
  evaluateMemberPortalEntitlementsForSurface,
  listMemberPortalDefaultGrantedEntitlementKeys,
  type MemberEntitlementDenial,
  type MemberEntitlementDenialReason,
  type MemberPortalEntitlementsEvaluation,
} from "./portal/evaluate-member-portal-entitlements";
export {
  MEMBER_PORTAL_HUB_VIRTUALISATION_THRESHOLD,
  MEMBER_PORTAL_MORE_ROUTE_PATH,
  resolveMemberPortalHubPresentation,
  resolveMemberPortalSecondaryModules,
  shouldRenderMemberPortalMoreHub,
  type MemberPortalHubPresentation,
  type MemberPortalHubPresentationMode,
} from "./portal/resolve-member-portal-hub";
export {
  resolveMemberPortalDefaultRoutePath,
  resolveMemberPortalModuleRoutePath,
  resolveMemberPortalModuleByRoutePath,
  resolveMemberPortalModules,
  listMemberPortalEntitlementKeys,
  tryResolveMemberPortalDefaultRoutePath,
  MemberPortalNotConfiguredError,
  MemberPortalUnknownRouteError,
  MemberPortalDisabledError,
  assertMemberPortalEnabled,
  isMemberPortalEnabled,
  resolveMemberPortalContract,
  type MemberPortalAvailability,
  type MemberPortalContract,
  type ResolvedMemberPortalSurface,
} from "./portal/resolve-member-portal-modules";
export {
  PLATFORM_MEMBER_PORTAL_HOME_MODULE,
  mergePlatformMemberPortalModules,
  memberPortalEntitlementKey,
} from "./portal/platform-member-portal-modules";
export {
  GUEST_CROSS_SURFACE_PLATFORM_MOTHER_ONLY_PATHS,
  validateGuestCrossSurfaceNavLinks,
  type GuestCrossSurfaceNavEgressKind,
  type GuestCrossSurfaceNavLink,
  type GuestCrossSurfaceNavSurface,
  type GuestCrossSurfaceNavSurfaceKind,
  type GuestCrossSurfaceNavVisibility,
} from "./catalog/guest-cross-surface-nav";
export {
  GuestCrossSurfaceNavNotConfiguredError,
  requireGuestCrossSurfaceNav,
  resolveGuestCrossSurfaceNav,
} from "./catalog/resolve-guest-cross-surface-nav";
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
export { formatCanonicalPathToLabel } from "./labels/format-canonical-path-label";
export type { WorkspaceHttpMethod } from "./http/workspace-http-method";
export {
  readWorkspaceJsonBody,
  sendWorkspaceGuestStub,
  sendWorkspaceJson,
  sendWorkspaceNotFound,
  buildWorkspaceSuccessDataBody,
  WORKSPACE_HTTP_ERROR_NOT_FOUND,
} from "./http/guest-json-response";
export {
  createWorkspaceGuestSmokeHttpHandlers,
  type CreateWorkspaceGuestSmokeHttpHandlersOptions,
  type WorkspaceGuestSmokeCatalogPort,
  type WorkspaceGuestSmokeHttpHandlers,
  type WorkspaceGuestSmokeMaybeAsync,
  type WorkspaceGuestSmokeRegistrationInput,
  type WorkspaceGuestSmokeRegistrationResult,
} from "./http/create-workspace-guest-smoke-http-handlers";
export {
  assertWorkspaceOwnerMutation,
  type AssertWorkspaceOwnerMutationParams,
} from "./http/assert-workspace-owner-mutation";
export {
  createWorkspaceHttpHostSlot,
  type WorkspaceHttpHostSlot,
} from "./http/create-workspace-http-host-slot";
export {
  defineWorkspaceCodedError,
  isWorkspaceCodedError,
  type DefinedWorkspaceCodedErrorSimple,
  type DefinedWorkspaceCodedErrorWithSurface,
  type WorkspaceCodedErrorInstance,
  type WorkspaceCodedErrorOptions,
} from "./http/define-workspace-coded-error";
export {
  mergeWorkspaceCanonicalPatchData,
  type WorkspaceCanonicalPatchMergeStrategy,
} from "./http/merge-workspace-canonical-patch-data";
export type {
  WorkspaceExposureResolverInput,
  WorkspaceExposureResolverPort,
  WorkspaceProductHttpHostBasePorts,
  WorkspaceTourListPageResult,
  WorkspaceTourRecord,
  WorkspaceTourStorePort,
} from "./http/workspace-http-ports";
export {
  clampWorkspaceCatalogPageLimit,
  filterWorkspacePublishedTours,
  mapWorkspaceCatalogSliceAsync,
  parseWorkspaceCatalogCursorLimitQuery,
  buildWorkspaceCatalogListSuccessBody,
  sliceWorkspaceCatalogByIdCursor,
  type ClampWorkspaceCatalogPageLimitOptions,
  type FilterWorkspacePublishedToursParams,
  type SliceWorkspaceCatalogByIdCursorResult,
  type WorkspaceCatalogCursorLimitQuery,
  type WorkspaceCatalogIdCursorItem,
  type WorkspaceCatalogListSuccessBody,
} from "./http/workspace-catalog-list";
export {
  applyWorkspaceCatalogCardExposure,
  applyWorkspaceCatalogCardFieldBindings,
  clearWorkspaceCatalogCardStringField,
  omitWorkspaceCatalogCardKey,
  type ApplyWorkspaceCatalogCardExposureParams,
  type WorkspaceCatalogCardFieldBinding,
} from "./http/apply-workspace-catalog-card-exposure";
export {
  parseWorkspaceZodOrThrow,
  type WorkspaceZodSafeParseFailure,
  type WorkspaceZodSafeParseResult,
  type WorkspaceZodSafeParseSuccess,
} from "./http/parse-workspace-zod-or-throw";

export {
  detectWorkspaceTourPublishTransition,
  type WorkspaceTourPublishTransition,
} from "./http/detect-workspace-tour-publish-transition";
export {
  workspaceTourPatchTouchesPublishFields,
  type WorkspaceTourPatchBody,
  type WorkspaceTourPatchTouchesPublishFieldsOptions,
} from "./http/workspace-tour-patch-publish-fields";

export {
  DEFAULT_CAPABILITY_REVISION,
  parseWorkspaceVersionPinsFromTheme,
  readCapabilityBlockRevision,
  readProfileCatalogVersion,
  resolveEffectiveCapabilityRevision,
  resolveEffectiveProfileVersion,
  runWorkspaceUpgradePreflight,
  type WorkspaceCapabilityPin,
  type WorkspaceProfilePin,
  type WorkspaceUpgradePreflightInput,
  type WorkspaceUpgradePreflightResult,
  type WorkspaceVersionPins,
  type WorkspaceVersioningErrorCode,
  type WorkspaceVersioningViolation,
} from "./manifest/workspace-versioning";
export {
  WORKSPACE_CAPABILITY_REVISION_REGISTRY,
  listWorkspaceCapabilityRevisions,
  resolveRegisteredCapabilityRevision,
  type WorkspaceCapabilityRevisionRegistry,
} from "./manifest/workspace-capability-revision-registry.generated";
export {
  WORKSPACE_PROFILE_VERSION_REGISTRY,
  listSupportedProfileVersions,
  type WorkspaceProfileVersionRegistry,
} from "./manifest/workspace-profile-version-registry.generated";
export {
  WORKSPACE_CAPABILITY_VERSION_CATALOG,
  WORKSPACE_PROFILE_VERSION_CATALOG,
  createWorkspaceUpgradePreflightInput,
} from "./manifest/workspace-versioning-catalog.generated";
export {
  WorkspaceVersionPinCapabilitySchema,
  WorkspaceVersionPinProfileSchema,
  WorkspaceVersionPinsSchema,
} from "./manifest.schema";
export {
  assertWorkspaceTypeOrThrow,
  assertWorkspaceRegistrationContactBasics,
  createTourDepartureNotSetValidationError,
  createTourNotPublishedValidationError,
  loadWorkspaceTourIfPublished,
  normalizeWorkspaceTypeKey,
  readFiniteCapacityNumber,
  readWorkspaceCanonicalCapacityByPath,
  requireWorkspacePublishedTour,
  WORKSPACE_REGISTRATION_EMAIL_PATTERN,
  WORKSPACE_REGISTRATION_PHONE_PATTERN,
  type AssertWorkspaceRegistrationContactBasicsParams,
  type WorkspacePublishedTourLoadParams,
} from "./http/workspace-registration-guards";
export {
  assertWorkspaceRegisteredUserOrThrow,
  readWorkspaceHttpHeaderValue,
  resolveWorkspacePublicAuthFromHeaders,
  resolveWorkspacePublicAuthFromRequest,
  WORKSPACE_PUBLIC_AUTH_MISSING_TENANT,
  WORKSPACE_PUBLIC_AUTH_MISSING_USER_ID,
  WORKSPACE_PUBLIC_AUTH_REGISTERED_USER_REQUIRED,
  WORKSPACE_PUBLIC_CATALOG_GUEST_USER_ID,
  type WorkspacePublicAuthHeaderInput,
} from "./http/workspace-public-auth";
