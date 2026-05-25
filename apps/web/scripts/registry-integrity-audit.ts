/**
 * Registry integrity audit: registry vs generated artifacts, path map, Zod.
 * Run: pnpm --filter web audit:denali-registry
 */
import { z } from "zod";

import {
  DENALI_FIELD_REGISTRY,
  isDenaliFieldInMatrixCell,
} from "../src/features/tours/wizard/denali/registry/DenaliFieldRegistry";
import { DENALI_MATRIX_CELLS } from "../src/features/tours/wizard/denali/registry/denaliRuleMatrixRecipes";
import { DENALI_FIELD_DEFINITIONS } from "../src/features/tours/wizard/denali/registry/denaliFieldRegistryData";
import { collectGeneratedArtifactSyncErrors } from "../src/features/tours/wizard/denali/registry/denaliRegistryCodegen";
import { DENALI_CANONICAL_TO_FORM_PATH_MAP } from "../src/features/tours/wizard/denali/rules/generated/denaliCanonicalPathMap.generated";
import {
  denaliRuleSet,
  findDenaliRuleField,
  listDenaliRuleFieldPaths,
} from "../src/features/tours/wizard/denali/rules/denaliRuleModel";
import { mapDenaliCanonicalToFormPath } from "../src/features/tours/wizard/denali/rules/denaliRuleRequired";
import { denaliTourCreateBaseSchema } from "../src/features/tours/wizard/schemas/denaliTourCreateBaseSchema";
import { buildDenaliTourCreateDefaultValues } from "../src/features/tours/wizard/schemas/denaliTourCreateSchema";

function zodShapeHasPath(schema: z.ZodTypeAny, path: string): boolean {
  const parts = path.split(".");
  let cur: z.ZodTypeAny = schema;
  for (const part of parts) {
    while (cur instanceof z.ZodOptional || cur instanceof z.ZodDefault) {
      cur = cur._def.innerType as z.ZodTypeAny;
    }
    if (!(cur instanceof z.ZodObject)) return false;
    const shape = cur.shape as Record<string, z.ZodTypeAny>;
    if (!(part in shape)) return false;
    cur = shape[part]!;
  }
  return true;
}

const rulePaths = new Set(listDenaliRuleFieldPaths());
const mf = denaliRuleSet.mountain.single_day!;
const form = buildDenaliTourCreateDefaultValues();

interface Issue {
  canonical: string;
  layer: string;
  detail: string;
}

const issues: Issue[] = [];

for (const message of collectGeneratedArtifactSyncErrors(
  denaliRuleSet,
  DENALI_CANONICAL_TO_FORM_PATH_MAP,
)) {
  issues.push({
    canonical: "*",
    layer: "generated",
    detail: message,
  });
}

for (const e of DENALI_FIELD_REGISTRY) {
  if (e.inRuleModel === false) {
    if (!rulePaths.has(e.canonicalPath)) {
      // zod-only fields are OK
    }
  } else if (!rulePaths.has(e.canonicalPath)) {
    issues.push({
      canonical: e.canonicalPath,
      layer: "denaliRuleModel",
      detail: "missing from listDenaliRuleFieldPaths()",
    });
  }

  const def = DENALI_FIELD_DEFINITIONS.find((d) => d.canonicalPath === e.canonicalPath);
  if (def && e.inRuleModel !== false) {
    const inMountain = isDenaliFieldInMatrixCell(def, "mountain:single_day");
    const row = findDenaliRuleField(mf, e.canonicalPath);
    if (inMountain && !row) {
      issues.push({
        canonical: e.canonicalPath,
        layer: "denaliRuleModel",
        detail: "expected on mountain.single_day but missing",
      });
    }
    if (row && row.step !== e.stepId) {
      issues.push({
        canonical: e.canonicalPath,
        layer: "denaliRuleModel",
        detail: `step mismatch registry=${e.stepId} rule=${row.step}`,
      });
    }
  }

  const mapped = mapDenaliCanonicalToFormPath(e.canonicalPath);
  if (mapped !== e.rhfPath) {
    issues.push({
      canonical: e.canonicalPath,
      layer: "denaliRuleRequired",
      detail: `CANONICAL_TO_FORM_MAP=${mapped} registry rhf=${e.rhfPath}`,
    });
  }

  if (!zodShapeHasPath(denaliTourCreateBaseSchema, e.zodPath)) {
    issues.push({
      canonical: e.canonicalPath,
      layer: "denaliTourCreateBaseSchema",
      detail: `zodPath missing from schema shape: ${e.zodPath}`,
    });
  } else if (e.zodPath.split(".").length > 0) {
    void form;
  }
}

const registryPaths = new Set(
  DENALI_FIELD_REGISTRY.filter((e) => e.inRuleModel !== false).map((e) => e.canonicalPath),
);
const ruleNotInRegistry = [...rulePaths].filter((p) => !registryPaths.has(p));

let matrixCellsOk = true;
for (const cell of DENALI_MATRIX_CELLS) {
  const model = denaliRuleSet[cell.split(":")[0] as keyof typeof denaliRuleSet]?.[
    cell.split(":")[1] as "single_day" | "multi_day"
  ];
  if (DENALI_MATRIX_CELLS.includes(cell) && cell === "event:multi_day") {
    if (model != null) matrixCellsOk = false;
  }
}

console.log(
  JSON.stringify(
    {
      registryCount: DENALI_FIELD_REGISTRY.length,
      rulePathCount: rulePaths.size,
      issues,
      ruleNotInRegistryCount: ruleNotInRegistry.length,
      ruleNotInRegistry,
      matrixCellsOk,
    },
    null,
    2,
  ),
);

if (issues.length > 0 || ruleNotInRegistry.length > 0) {
  console.error("\nARCHITECTURAL_DRIFT_DETECTED");
  process.exit(1);
}
