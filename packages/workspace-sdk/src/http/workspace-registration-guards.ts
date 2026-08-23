/**
 * Shared registration/catalog guard helpers (DG-1.5 / DG-1.6).
 * CW5-02 — implementation in @app-tour/tour-core; SDK one-way compatibility surface.
 */
export {
  assertWorkspaceRegistrationContactBasics,
  assertWorkspaceTypeOrThrow,
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
} from "@app-tour/tour-core";
