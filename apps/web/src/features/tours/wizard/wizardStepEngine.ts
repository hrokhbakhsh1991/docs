import type { TourFormProfile } from "@repo/types";

import type { TourCreateFormValues } from "@/components/tours/wizard/legacy/schemas/tourCreateSchema";
import {
  getVisibleWizardStepsForTenantContract,
  type TenantTourFormContract,
} from "@/features/tours/contracts/tenant-tour-form-contract";
import { composeWizardSteps } from "@/features/tours/wizard/template/compose-wizard-steps";
import type { TenantWizardStepOverrides } from "@/features/tours/wizard/template/tenant-wizard-template.types";
import {
  tourFormProfileToWizardValidationFlags,
  type TourCreateWizardValidationFlags,
} from "@/components/tours/wizard/legacy/schemas/tourCreateValidationPolicy";

import {
  STEP_PRIMARY_FIELD_GROUP,
  getVisibleWizardStepsForProfile,
  pruneWizardStepsWithoutActiveThemes,
  type FieldGroupId,
} from "./fieldGroups";
import {
  stepTitlesFa,
  stepTriggerFields,
  wizardSteps,
  type TourCreateWizardStepId,
} from "./stepConfig";

/**
 * # Wizard Step Engine
 *
 * Single, explicit surface for **all** step-related decisions in the tour-create wizard. It
 * wraps the existing primitives (`stepConfig`, `fieldGroups`, `tourCreateValidationPolicy`) so
 * that consumers — today only `TourCreateWizardShell`, tomorrow possibly autosave hooks or a
 * future "dynamic step engine" rewrite — depend on **one** module instead of three.
 *
 * ## Source of truth chain
 *
 * | Concern                                | Authoritative module                                | Engine accessor                              |
 * | -------------------------------------- | --------------------------------------------------- | -------------------------------------------- |
 * | Ordered step ids                       | `stepConfig.ts → wizardSteps`                       | {@link wizardStepEngine.getOrderedSteps}     |
 * | RHF trigger paths per step             | `stepConfig.ts → stepTriggerFields`                 | {@link wizardStepEngine.getTriggerFieldsForStep} |
 * | Persian title per step                 | `stepConfig.ts → stepTitlesFa`                      | {@link wizardStepEngine.getStepTitleFa}      |
 * | Primary field group per step           | `fieldGroups.ts → STEP_PRIMARY_FIELD_GROUP`         | {@link wizardStepEngine.getPrimaryGroupForStep} |
 * | Step visibility for a profile          | `fieldGroups.ts → getVisibleWizardStepsForProfile`  | {@link wizardStepEngine.getStepsForProfile}  |
 * | Empty-theme-catalog prune              | `fieldGroups.ts → pruneWizardStepsWithoutActiveThemes` | merged into {@link wizardStepEngine.getVisibleStepsForRuntime} |
 * | Zod relax flags for current step       | `tourCreateValidationPolicy.ts → tourFormProfileToWizardValidationFlags` + position rules | {@link wizardStepEngine.getValidationFlagsForStep} |
 *
 * ## Interactions
 *
 * - **Field groups (`STEP_PRIMARY_FIELD_GROUP`):** every visible step (except `review`) is owned by
 *   one {@link FieldGroupId}. When a profile makes a group inactive
 *   ({@link getVisibleWizardStepsForProfile}), the engine simply does not list that step. Future
 *   group-by-group autosave can read {@link WizardStepConfig.primaryGroup} from
 *   {@link wizardStepEngine.getStepConfig} to know which top-level form roots to persist.
 * - **Profile (`TourFormProfile`):** all visibility rules flow through `fieldGroups.ts` which is the
 *   only place where "this profile hides these groups" is encoded. The engine never re-derives
 *   profile-specific knowledge — it merely composes existing primitives.
 * - **Validation flags (`buildTourWizardValidationFlags`):** the engine merges two signals into one
 *   {@link TourCreateWizardValidationFlags}:
 *     1. Static profile defaults from `tourFormProfileToWizardValidationFlags(profile)`.
 *     2. **Position-based relaxation**: while the user is on a step *before* `itinerary` or
 *        `logistics`, those refinements are relaxed so RHF cannot fail validation on fields the
 *        user has not yet reached. This pre-existed as `buildTourWizardValidationFlags` inside the
 *        wizard component; it is now testable and reusable here.
 *
 * ## Behavior guarantees
 *
 * - **No behavior change** vs the pre-engine code. Each accessor delegates to the same primitives
 *   the wizard used directly. Parity is exercised by `wizardStepEngine.spec.ts`.
 * - The engine is **pure**: no React hooks, no `useState`, no `useMemo`. Callers are expected to
 *   memoize results where it matters (e.g. `useMemo(() => engine.getVisibleStepsForRuntime(...), [...])`).
 *
 * ## Future readiness
 *
 * The {@link WizardStepConfig} array exposes `id + primaryGroup + triggerFields + titleFa` in one
 * place, which is the data shape a future autosave-per-group hook needs to know which RHF roots
 * to persist when a step is left. See `TourCreateWizard.tsx` for draft restore and profile
 * orchestration alongside this engine.
 */

export type WizardStepKey = TourCreateWizardStepId;

/** Descriptive entry for one wizard step. The order of {@link WIZARD_STEP_CONFIGS} is canonical. */
export type WizardStepConfig = {
  readonly id: WizardStepKey;
  /** Primary owning field group. `null` for the summary `review` step. */
  readonly primaryGroup: FieldGroupId | null;
  /** RHF field paths the wizard `trigger(...)`s before letting the user move past this step. */
  readonly triggerFields: readonly (keyof TourCreateFormValues | string)[];
  /** Persian display title used in the stepper rail and per-step heading. */
  readonly titleFa: string;
};

/** Inputs for {@link wizardStepEngine.getVisibleStepsForRuntime} that depend on the live request state. */
export type WizardStepVisibilityRuntime = {
  /** `true` once the workspace tour-themes query has resolved (success or error). */
  readonly themesQueryFinishedLoading: boolean;
  /** Number of `isActive` rows in the workspace tour-themes catalog. */
  readonly activeThemeCount: number;
  /** Workspace module overlay (`form_builder` unlocks itinerary/participation/logistics). */
  readonly tenantFormContract?: TenantTourFormContract;
  /** DB template step overrides applied after profile + tenant visibility. */
  readonly stepOverrides?: TenantWizardStepOverrides;
};

/** Re-exported here so consumers do not need a second import for the flags shape. */
export type WizardStepValidationFlags = TourCreateWizardValidationFlags;

/** Canonical, profile-agnostic step configs in display order. Derived once at module load. */
export const WIZARD_STEP_CONFIGS: readonly WizardStepConfig[] = wizardSteps.map((id) => ({
  id,
  primaryGroup: STEP_PRIMARY_FIELD_GROUP[id],
  triggerFields: stepTriggerFields[id],
  titleFa: stepTitlesFa[id],
}));

const STEP_CONFIG_BY_ID: Record<WizardStepKey, WizardStepConfig> = WIZARD_STEP_CONFIGS.reduce(
  (acc, cfg) => {
    acc[cfg.id] = cfg;
    return acc;
  },
  {} as Record<WizardStepKey, WizardStepConfig>,
);

/**
 * Position-based validation relaxation (Phase 3 bridge).
 *
 * RHF must not fail on `itinerary.days.min(1)` or `logistics.primaryTransportMode required` until
 * the user has actually visited those steps. We OR profile-static flags with these position-aware
 * relaxations so:
 * - On step `basic` of a `general` profile, both `itinerary` and `logistics` are relaxed.
 * - On step `policies` of the same profile, both have been visited → no relaxation.
 * - On any step of `urban_event`, `relaxLogisticsPrimary` is always true (profile-static).
 */
function composeValidationFlagsForStep(
  profile: TourFormProfile,
  currentStepKey: WizardStepKey,
  visibleSteps: readonly WizardStepKey[],
): WizardStepValidationFlags {
  const itineraryIdx = visibleSteps.indexOf("itinerary");
  const logisticsIdx = visibleSteps.indexOf("logistics");
  const stepIdx = visibleSteps.indexOf(currentStepKey);
  const beforeItineraryStep =
    itineraryIdx !== -1 && stepIdx !== -1 && stepIdx < itineraryIdx;
  const beforeLogisticsStep =
    logisticsIdx !== -1 && stepIdx !== -1 && stepIdx < logisticsIdx;
  const profileFlags = tourFormProfileToWizardValidationFlags(profile);
  return {
    relaxItineraryMinDays: profileFlags.relaxItineraryMinDays || beforeItineraryStep,
    relaxLogisticsPrimary: profileFlags.relaxLogisticsPrimary || beforeLogisticsStep,
  };
}

/**
 * Public engine surface. Use a single import:
 * ```ts
 * import { wizardStepEngine } from "@/features/tours/wizard/wizardStepEngine";
 * ```
 *
 * All accessors are pure delegations to existing primitives — see the JSDoc on this module for
 * the source-of-truth map.
 */
export const wizardStepEngine = {
  /** Canonical ordered step ids (profile-agnostic). */
  getOrderedSteps(): readonly WizardStepKey[] {
    return wizardSteps;
  },
  /** Canonical ordered configs (id + primary group + trigger fields + title). */
  getOrderedConfigs(): readonly WizardStepConfig[] {
    return WIZARD_STEP_CONFIGS;
  },
  /** Config lookup for a single step. */
  getStepConfig(stepKey: WizardStepKey): WizardStepConfig {
    return STEP_CONFIG_BY_ID[stepKey];
  },
  /**
   * Step ids visible for a profile (delegates to {@link getVisibleWizardStepsForProfile}: primary-group
   * skip + redundancy rules). Does **not** apply the workspace-theme prune.
   */
  getStepsForProfile(profile: TourFormProfile): readonly WizardStepKey[] {
    return getVisibleWizardStepsForProfile(profile);
  },
  /**
   * Step ids visible for the **live** wizard, combining profile visibility with the workspace
   * tour-themes catalog state (e.g. drop the `theme` step when no themes are active). The single
   * accessor mirrors the prior `getVisibleWizardStepsForProfile + pruneWizardStepsWithoutActiveThemes`
   * call sequence in `TourCreateWizard.tsx`.
   */
  getVisibleStepsForRuntime(
    profile: TourFormProfile,
    runtime: WizardStepVisibilityRuntime,
  ): WizardStepKey[] {
    const base = runtime.tenantFormContract
      ? getVisibleWizardStepsForTenantContract(profile, runtime.tenantFormContract)
      : getVisibleWizardStepsForProfile(profile);
    const pruned = pruneWizardStepsWithoutActiveThemes(base, runtime);
    return composeWizardSteps(pruned, runtime.stepOverrides);
  },
  /** RHF field paths to `trigger(...)` before allowing the user to advance past this step. */
  getTriggerFieldsForStep(
    stepKey: WizardStepKey,
  ): readonly (keyof TourCreateFormValues | string)[] {
    return stepTriggerFields[stepKey];
  },
  /** Primary {@link FieldGroupId} owning this step (`null` for the summary `review` step). */
  getPrimaryGroupForStep(stepKey: WizardStepKey): FieldGroupId | null {
    return STEP_PRIMARY_FIELD_GROUP[stepKey];
  },
  /** Persian display title for the stepper rail. */
  getStepTitleFa(stepKey: WizardStepKey): string {
    return stepTitlesFa[stepKey];
  },
  /**
   * Zod relaxation flags to publish via `setTourCreateWizardValidationFlags(...)` for the current
   * step. Merges profile-static flags with position-based relaxations
   * (see {@link composeValidationFlagsForStep}).
   */
  getValidationFlagsForStep(
    profile: TourFormProfile,
    currentStepKey: WizardStepKey,
    visibleSteps: readonly WizardStepKey[],
  ): WizardStepValidationFlags {
    return composeValidationFlagsForStep(profile, currentStepKey, visibleSteps);
  },
} as const;

export type WizardStepEngine = typeof wizardStepEngine;
