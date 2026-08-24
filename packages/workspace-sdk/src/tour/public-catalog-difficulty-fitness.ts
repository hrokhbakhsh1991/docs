/**
 * CW7-09 — neutral egress-safe difficulty/fitness fields on public catalog cards.
 * Workspace adapters map canonical tour data into these scalars; no platform scale defaults.
 */

/** Egress-safe difficulty/fitness scalars — workspace-owned semantics at canonical layer. */
export type PublicCatalogDifficultyFitnessFields = {
  readonly difficultyLevel?: number | null;
  readonly fitnessLevel?: string | null;
  readonly fitnessPrerequisiteText?: string | null;
};

/** Workspace-owned filter presentation hooks for marketing catalog list filters. */
export type WorkspaceDifficultyFitnessFilterPresentation = {
  readonly difficultyLevels: readonly number[];
  readonly fitnessLevels: readonly string[];
  readonly difficultyMax: number;
  readonly snapDifficultyLevel: (value: number) => number;
};
