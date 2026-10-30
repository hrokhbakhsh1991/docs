import { assertSecondTenantStagingTarget } from "./denali-second-staging-target";

const APPLY_CONFIRMATIONS = {
  seed: "seed-denali-first-s2e-draft-tour-to-tour_db_staging",
  cleanup: "cleanup-denali-first-s2e-draft-tour-from-tour_db_staging",
} as const;

export type FirstStagingDraftTourMutation = keyof typeof APPLY_CONFIRMATIONS;

/** Reuse the pinned staging DB/profile validation, with independent A-fixture apply guards. */
export function assertFirstStagingDraftTourTarget(
  env: Readonly<Record<string, string | undefined>>,
  apply: boolean,
  mutation: FirstStagingDraftTourMutation
): void {
  assertSecondTenantStagingTarget(env, false);
  if (!apply) return;
  const confirmationVariable =
    mutation === "seed"
      ? "DENALI_FIRST_STAGING_DRAFT_TOUR_CONFIRM"
      : "DENALI_FIRST_STAGING_DRAFT_TOUR_CLEANUP_CONFIRM";
  if (env[confirmationVariable] !== APPLY_CONFIRMATIONS[mutation]) {
    throw new Error("DENALI_FIRST_STAGING_DRAFT_TOUR_CONFIRMATION_REQUIRED");
  }
}
