export type { WorkspaceHttpMethod } from "./workspace-http-method";
export {
  readWorkspaceJsonBody,
  sendWorkspaceGuestStub,
  sendWorkspaceJson,
  sendWorkspaceNotFound,
  buildWorkspaceSuccessDataBody,
  WORKSPACE_HTTP_ERROR_NOT_FOUND,
} from "./guest-json-response";
export {
  assertWorkspaceOwnerMutation,
  type AssertWorkspaceOwnerMutationParams,
} from "./assert-workspace-owner-mutation";
export {
  createWorkspaceHttpHostSlot,
  type WorkspaceHttpHostSlot,
} from "./create-workspace-http-host-slot";
export {
  defineWorkspaceCodedError,
  isWorkspaceCodedError,
  type DefinedWorkspaceCodedErrorSimple,
  type DefinedWorkspaceCodedErrorWithSurface,
  type WorkspaceCodedErrorInstance,
  type WorkspaceCodedErrorOptions,
} from "./define-workspace-coded-error";
export {
  mergeWorkspaceCanonicalPatchData,
  type WorkspaceCanonicalPatchMergeStrategy,
} from "./merge-workspace-canonical-patch-data";
export type {
  WorkspaceExposureResolverInput,
  WorkspaceExposureResolverPort,
  WorkspaceProductHttpHostBasePorts,
  WorkspaceTourListPageResult,
  WorkspaceTourRecord,
  WorkspaceTourStorePort,
} from "./workspace-http-ports";
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
} from "./workspace-catalog-list";
export {
  applyWorkspaceCatalogCardExposure,
  applyWorkspaceCatalogCardFieldBindings,
  clearWorkspaceCatalogCardStringField,
  omitWorkspaceCatalogCardKey,
  type ApplyWorkspaceCatalogCardExposureParams,
  type WorkspaceCatalogCardFieldBinding,
} from "./apply-workspace-catalog-card-exposure";
export {
  parseWorkspaceZodOrThrow,
  type WorkspaceZodSafeParseFailure,
  type WorkspaceZodSafeParseResult,
  type WorkspaceZodSafeParseSuccess,
} from "./parse-workspace-zod-or-throw";

export {
  detectWorkspaceTourPublishTransition,
  type WorkspaceTourPublishTransition,
} from "./detect-workspace-tour-publish-transition";
export {
  workspaceTourPatchTouchesPublishFields,
  type WorkspaceTourPatchBody,
  type WorkspaceTourPatchTouchesPublishFieldsOptions,
} from "./workspace-tour-patch-publish-fields";
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
} from "./workspace-registration-guards";
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
} from "./workspace-public-auth";
export {
  createWorkspaceGuestSmokeHttpHandlers,
  type CreateWorkspaceGuestSmokeHttpHandlersOptions,
  type WorkspaceGuestSmokeCatalogPort,
  type WorkspaceGuestSmokeHttpHandlers,
  type WorkspaceGuestSmokeRegistrationInput,
  type WorkspaceGuestSmokeRegistrationResult,
} from "./create-workspace-guest-smoke-http-handlers";
