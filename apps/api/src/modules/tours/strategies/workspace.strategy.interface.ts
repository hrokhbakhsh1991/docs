import type {
  TourFormProfile,
  TourFormProfileInvariantHints,
  TourFormProfileStripDeltas,
  WizardFieldGroupSlug,
  WizardSubmitRequiredFieldPath,
} from "@repo/types";
import type { ProfileRequiredSubmitShape } from "../utils/assert-profile-required-fields-for-submit";
import type {
  TourWorkspaceDefinition,
  WorkspaceInvariantViolation,
} from "@repo/shared-contracts";

/**
 * Wizard rail mode — aligned with {@link TourWorkspaceDefinition.ui.wizardMode}.
 */
export type WorkspaceWizardMode = TourWorkspaceDefinition["ui"]["wizardMode"];

/**
 * Canonical DTO / preset roots for this workspace (e.g. {@link DENALI_ROOTS} for Denali).
 */
export type WorkspaceWizardRoots = readonly string[];

/**
 * Trip-details + transport validation contract (replaces scattered
 * `assertTripDetailsForFormProfile` / `getTourWorkspaceDefinition().validation` branches).
 *
 * Implementations delegate to `@repo/types` descriptors and `@repo/shared-contracts`
 * workspace invariant helpers — no inline `profile === "denali_pilot"` in consumers.
 */
export type WorkspaceTripDetailsValidationPhase =
  | "never"
  | "before_canonical"
  | "after_canonical";

export interface WorkspaceValidationRules {
  readonly profile: TourFormProfile;
  /** Descriptor-backed invariant hints (`assert-create-tour-invariants.ts`). */
  readonly invariantHints: TourFormProfileInvariantHints;
  /**
   * Optional workspace strategy checks from {@link TourWorkspaceDefinition.validation}.
   * `null` when the profile has no registered workspace definition (classic-only paths).
   */
  readonly workspaceValidation: TourWorkspaceDefinition["validation"] | null;
  /** Wizard field groups inactive for this profile (rail / required-ness derivation). */
  readonly inactiveFieldGroups: readonly WizardFieldGroupSlug[];
  /**
   * When `false`, skip `workspaceValidation.checkTripDetails` (e.g. `urban_event` shares
   * `DENALI_WORKSPACE` for capacity but not Denali trip-details invariants).
   */
  readonly appliesWorkspaceTripDetailsValidation: boolean;
  /** Ordering of workspace trip-details checks vs canonical / strip asserts. */
  readonly workspaceTripDetailsValidationPhase: WorkspaceTripDetailsValidationPhase;
}

/**
 * Publish / DRAFT→OPEN gate contract (replaces `assertTourIsPublishable` +
 * `assert-tour-publish-transition.ts` profile branches).
 */
export interface WorkspacePublishPolicy {
  readonly profile: TourFormProfile;
  /** Target lifecycle status when publishing (typically `OPEN`). */
  readonly publishLifecycleStatus: TourWorkspaceDefinition["lifecycle"]["publishStatus"];
  /** Whether only `DRAFT` tours may transition to publish (see `assertTourIsPublishable`). */
  readonly requiresDraftBeforePublish: boolean;
  /**
   * Shared open readiness snapshot (title, capacity, optional `details.durationDays`).
   * Mirrors `TourOpenReadinessInput` in `tour-lifecycle.policy.ts`.
   */
  readonly openReadinessFields: readonly ("title" | "totalCapacity" | "details.durationDays")[];
  /**
   * Profile-specific publish geolocation gate (Denali pilot).
   * `null` when publish does not run zone checks.
   */
  readonly publishGeolocationCheck:
    | ((tripDetails: unknown) => WorkspaceInvariantViolation | null)
    | null;
  /** Allowed lifecycle edges for this workspace (from workspace registry). */
  readonly allowedLifecycleTransitions: TourWorkspaceDefinition["lifecycle"]["allowedTransitions"];
}

/**
 * Server strip-on-write contract (replaces `create-tour-form-profile-strip.ts` descriptor reads).
 */
export interface WorkspaceFieldStripRules {
  readonly profile: TourFormProfile;
  /** Declarative strip deltas — single source: `getTourFormProfileDescriptor(profile).strip`. */
  readonly strip: TourFormProfileStripDeltas;
  /**
   * When `true`, apply Denali single-day logistics ghost-field cleanup after strip
   * (`stripDenaliSingleDayLogistics` in `create-tour-form-profile-strip.ts`).
   */
  readonly appliesDenaliSingleDayLogisticsStrip: boolean;
}

/**
 * Wizard shell / rail configuration (replaces `isDenaliWizardContext` / template resolution).
 */
export interface WorkspaceWizardConfig {
  readonly profile: TourFormProfile;
  readonly wizardMode: WorkspaceWizardMode;
  readonly roots: WorkspaceWizardRoots;
  readonly inactiveFieldGroups: readonly WizardFieldGroupSlug[];
  readonly wizardCapacityStepRedundant: boolean;
  /**
   * Registered workspace definition version, when present in {@link TOUR_WORKSPACE_DEFINITIONS}.
   */
  readonly workspaceDefinitionVersion: TourWorkspaceDefinition["version"] | null;
}

/**
 * Phase 2 workspace strategy — one implementation per {@link TourFormProfile} (or shared
 * implementation for aliased profiles). **Contract only**; concrete strategies are not
 * implemented in Phase 2.0.
 *
 * @see SYSTEM_AUDIT.md — Phase 2: Strategy Pattern - Interface Defined
 */
export interface IWorkspaceStrategy {
  /** Resolved workspace profile this strategy serves. */
  readonly profile: TourFormProfile;

  /**
   * Trip-details, transport, and capacity validation rules for create/edit/publish paths.
   */
  getValidationRules(): WorkspaceValidationRules;

  /**
   * DRAFT→OPEN and publish readiness policy (`assertTourIsPublishable`, publish transition).
   */
  getPublishPolicy(): WorkspacePublishPolicy;

  /**
   * Persist-time field strip rules (`stripTripDetailsForFormProfile`, `stripCreateTourDtoForFormProfile`).
   */
  getFieldStripRules(): WorkspaceFieldStripRules;

  /**
   * Wizard mode, canonical roots, and inactive field groups for rail UI.
   */
  getWizardConfig(): WorkspaceWizardConfig;

  /**
   * Submit / publish required-field paths and profile-specific value resolution
   * (`assert-profile-required-fields-for-submit.ts`).
   */
  getRequiredSubmitFields(): WorkspaceRequiredSubmitFields;
}

/** Submit gate contract — replaces inline `profile ===` branches in required-field asserts. */
export interface WorkspaceRequiredSubmitFields {
  readonly profile: TourFormProfile;
  readonly requiredPaths: readonly WizardSubmitRequiredFieldPath[];
  readSubmitFieldValue(
    dto: ProfileRequiredSubmitShape,
    path: WizardSubmitRequiredFieldPath,
  ): unknown;
}
