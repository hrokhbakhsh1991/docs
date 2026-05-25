/**
 * Single source of truth for the Denali create wizard.
 *
 * Edit field rows in {@link ./denaliFieldRegistryData.ts} and matrix recipes in
 * {@link ./denaliRuleMatrixRecipes.ts}, then run:
 *
 *   pnpm --filter web generate:denali-wizard
 *
 * Generated outputs (do not edit by hand):
 * - {@link ../rules/generated/denaliRuleSet.generated.ts}
 * - {@link ../rules/generated/denaliCanonicalPathMap.generated.ts}
 * - {@link ../../schemas/denaliTourCreateBaseSchema.generated.ts}
 */

import type { DenaliCreateWizardStepId } from "@/features/tours/wizard/denaliStepConfig";
import type { DenaliRuleFieldDefinition } from "../rules/denaliRuleModel.types";

import {
  DENALI_FIELD_DEFINITIONS,
  type DenaliFieldDefinition,
  type DenaliZodFieldKind,
} from "./denaliFieldRegistryData";
import { getDenaliFieldCompletionWeight } from "./denaliFieldCompletionWeights";
export type { DenaliFieldDefinition, DenaliZodFieldKind };
export { DENALI_FIELD_DEFINITIONS };

export type {
  DenaliFieldKind,
  DenaliFieldWireProjection,
} from "./DenaliFieldRegistry.types";

import type { DenaliFieldKind, DenaliFieldWireProjection } from "./DenaliFieldRegistry.types";
import {
  DENALI_MATRIX_CELL_TAGS,
  type DenaliMatrixCell,
  type DenaliMatrixTag,
} from "./denaliRuleMatrixRecipes";
export {
  DENALI_MATRIX_CELL_TAGS,
  DENALI_MATRIX_CELLS,
  type DenaliMatrixCell,
  type DenaliMatrixTag,
} from "./denaliRuleMatrixRecipes";

/** Registry row (alias for definitions used by UI + codegen). */
export interface DenaliFieldRegistryEntry {
  fieldKind?: DenaliFieldKind;
  canonicalPath: string;
  stepId: DenaliCreateWizardStepId;
  rhfPath: string;
  zodPath: string;
  wire?: DenaliFieldWireProjection | readonly DenaliFieldWireProjection[];
  ruleDefaults: Pick<DenaliRuleFieldDefinition, "required" | "hidden">;
  classificationOverrides?: {
    event?: Pick<DenaliRuleFieldDefinition, "required" | "hidden">;
  };
  notes?: string;
  tags?: readonly DenaliMatrixTag[];
  cellOverrides?: DenaliFieldDefinition["cellOverrides"];
  inRuleModel?: boolean;
  zodKind?: DenaliZodFieldKind;
  /** Content-quality weight for the wizard completion progress indicator. */
  weight: number;
}

function toRegistryEntry(def: DenaliFieldDefinition): DenaliFieldRegistryEntry {
  return {
    canonicalPath: def.canonicalPath,
    stepId: def.stepId,
    rhfPath: def.rhfPath,
    zodPath: def.zodPath,
    wire: def.wire,
    ruleDefaults: def.ruleDefaults,
    fieldKind: def.fieldKind,
    notes: def.notes,
    tags: def.tags,
    cellOverrides: def.cellOverrides,
    inRuleModel: def.inRuleModel,
    zodKind: def.zodKind,
    weight: def.weight ?? getDenaliFieldCompletionWeight(def.canonicalPath),
  };
}

/** All wizard fields (Basic, Program, Logistics, Photos, Pricing). */
export const DENALI_FIELD_REGISTRY: readonly DenaliFieldRegistryEntry[] =
  DENALI_FIELD_DEFINITIONS.map(toRegistryEntry);

export const DENALI_ASYNC_ASSET_CANONICAL_PATHS: ReadonlySet<string> = new Set(
  DENALI_FIELD_REGISTRY.filter((row) => row.fieldKind === "asyncAsset").map(
    (row) => row.canonicalPath,
  ),
);

export function isDenaliAsyncAssetCanonicalPath(path: string): boolean {
  return DENALI_ASYNC_ASSET_CANONICAL_PATHS.has(path);
}

export function getDenaliFieldRegistryByStep(
  stepId: DenaliCreateWizardStepId,
): readonly DenaliFieldRegistryEntry[] {
  return DENALI_FIELD_REGISTRY.filter((row) => row.stepId === stepId);
}

/** Canonical → RHF map (generator also emits this for denaliRuleRequired). */
export function denaliRegistryCanonicalToFormMap(
  entries: readonly DenaliFieldRegistryEntry[] = DENALI_FIELD_REGISTRY,
): Record<string, string> {
  return Object.fromEntries(entries.map((row) => [row.canonicalPath, row.rhfPath]));
}

/** Rule-model field rows from registry defaults (outdoor profile; prefer generated set). */
export function denaliRegistryToRuleFields(
  entries: readonly DenaliFieldRegistryEntry[],
  options?: { classification?: "event" | "outdoor" },
): DenaliRuleFieldDefinition[] {
  return entries.map((row) => {
    const override =
      options?.classification === "event"
        ? row.classificationOverrides?.event
        : undefined;
    const { required, hidden } = override ?? row.ruleDefaults;
    return {
      path: row.canonicalPath,
      required,
      hidden,
      step: row.stepId,
    };
  });
}

export function listDenaliRegistryCanonicalPaths(
  entries: readonly DenaliFieldRegistryEntry[] = DENALI_FIELD_REGISTRY,
): string[] {
  return entries.map((row) => row.canonicalPath);
}

/** Whether a field participates in a category × duration matrix cell. */
export function isDenaliFieldInMatrixCell(
  def: DenaliFieldDefinition,
  cell: DenaliMatrixCell,
): boolean {
  const cellTags = DENALI_MATRIX_CELL_TAGS[cell];
  if (cellTags == null || def.inRuleModel === false) return false;
  if (def.tags.length === 0) return false;
  return def.tags.some((tag) => cellTags.includes(tag));
}
