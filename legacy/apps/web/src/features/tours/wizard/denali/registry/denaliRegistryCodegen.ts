/**
 * Shared codegen logic for registry → rule model / path map.
 * Used by `scripts/generate-denali-wizard-config.ts` and `scripts/registry-integrity-audit.ts`.
 */

import { DENALI_FIELD_DEFINITIONS, type DenaliFieldDefinition } from "@repo/denali-domain";
import { DENALI_MATRIX_CELL_TAGS, type DenaliMatrixCell } from "./denaliRuleMatrixRecipes";
import {
  DENALI_RULE_MODEL_CATEGORIES,
  DENALI_RULE_MODEL_DURATIONS,
  type DenaliRuleFieldDefinition,
  type DenaliRuleSet,
} from "../rules/denaliRuleModel.types";

export function fieldInCell(def: DenaliFieldDefinition, cell: DenaliMatrixCell): boolean {
  const cellTags = DENALI_MATRIX_CELL_TAGS[cell];
  if (cellTags == null) return false;
  if (def.inRuleModel === false) return false;
  if (def.tags.length === 0) return false;
  return def.tags.some((tag) => cellTags.includes(tag));
}

export function resolveRuleRow(
  def: DenaliFieldDefinition,
  cell: DenaliMatrixCell,
): Pick<DenaliRuleFieldDefinition, "required" | "hidden"> {
  const override = def.cellOverrides?.[cell];
  if (override) return override;

  const cellTags = DENALI_MATRIX_CELL_TAGS[cell] ?? [];

  if (def.canonicalPath === "endDateTime") {
    if (cellTags.includes("end_datetime_required")) {
      return { required: true, hidden: false };
    }
    if (cellTags.includes("end_datetime_hidden")) {
      return { required: false, hidden: true };
    }
  }

  if (
    def.canonicalPath === "program.itinerary" &&
    cellTags.includes("itinerary_visible")
  ) {
    return { required: true, hidden: false };
  }

  return def.ruleDefaults;
}

export function buildDenaliRuleSetFromRegistry(): DenaliRuleSet {
  const set = {} as DenaliRuleSet;

  for (const category of DENALI_RULE_MODEL_CATEGORIES) {
    set[category] = {} as DenaliRuleSet[typeof category];
    for (const duration of DENALI_RULE_MODEL_DURATIONS) {
      const cell = `${category}:${duration}` as DenaliMatrixCell;
      const cellTags = DENALI_MATRIX_CELL_TAGS[cell];
      if (cellTags == null) {
        set[category][duration] = null;
        continue;
      }

      const fields: DenaliRuleFieldDefinition[] = [];
      for (const def of DENALI_FIELD_DEFINITIONS) {
        if (!fieldInCell(def, cell)) continue;
        const { required, hidden } = resolveRuleRow(def, cell);
        fields.push({
          path: def.canonicalPath,
          required,
          hidden,
          step: def.stepId,
        });
      }

      fields.sort((a, b) => a.path.localeCompare(b.path));
      set[category][duration] = {
        category,
        duration,
        fields,
      };
    }
  }

  return set;
}

export function buildDenaliCanonicalMapFromRegistry(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const def of DENALI_FIELD_DEFINITIONS) {
    map[def.canonicalPath] = def.rhfPath;
  }
  return map;
}

/** Canonical paths validated at submit when `contextualRequired` is set on the registry row. */
export function buildDenaliConditionallyRequiredCanonicalPathsFromRegistry(): readonly string[] {
  return DENALI_FIELD_DEFINITIONS.filter((def) => def.contextualRequired != null)
    .map((def) => def.canonicalPath)
    .sort();
}

function serializeRuleSet(ruleSet: DenaliRuleSet): string {
  const snapshot: Record<string, unknown> = {};
  for (const category of DENALI_RULE_MODEL_CATEGORIES) {
    for (const duration of DENALI_RULE_MODEL_DURATIONS) {
      const model = ruleSet[category][duration];
      const key = `${category}:${duration}`;
      snapshot[key] =
        model == null
          ? null
          : model.fields.map((f) => ({
              path: f.path,
              required: f.required,
              hidden: f.hidden,
              step: f.step,
            }));
    }
  }
  return JSON.stringify(snapshot);
}

function serializeCanonicalMap(map: Record<string, string>): string {
  const sorted = Object.keys(map)
    .sort()
    .map((key) => [key, map[key]!] as const);
  return JSON.stringify(Object.fromEntries(sorted));
}

/** Returns human-readable sync errors (empty = in sync). */
export function collectGeneratedArtifactSyncErrors(
  committedRuleSet: DenaliRuleSet,
  committedCanonicalMap: Record<string, string>,
): string[] {
  const errors: string[] = [];
  const expectedRuleSet = buildDenaliRuleSetFromRegistry();
  const expectedMap = buildDenaliCanonicalMapFromRegistry();

  if (serializeRuleSet(committedRuleSet) !== serializeRuleSet(expectedRuleSet)) {
    errors.push(
      "denaliRuleSet.generated.ts is out of sync with the registry. Run: pnpm --filter web generate:denali-wizard",
    );
  }

  if (serializeCanonicalMap(committedCanonicalMap) !== serializeCanonicalMap(expectedMap)) {
    errors.push(
      "denaliCanonicalPathMap.generated.ts is out of sync with the registry. Run: pnpm --filter web generate:denali-wizard",
    );
  }

  return errors;
}
