#!/usr/bin/env node
/**
 * Regenerates rules/generated/* from field-registry sources (Phase 6.2 — no legacy/ import).
 *
 *   pnpm --filter @app-tour/workspace-denali run denali:codegen
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GENERATED_DIR = join(ROOT, "src/rules/generated");

const BANNER = `// DEPRECATED: DO NOT EDIT. AUTO-GENERATED.
/**
 * AUTO-GENERATED — do not edit by hand.
 * Source: field-registry/denaliFieldRegistryData.ts (+ denaliRuleMatrixRecipes.ts)
 * Run: pnpm --filter @app-tour/workspace-denali run denali:codegen
 */\n`;

async function loadCodegen() {
  const codegenUrl = pathToFileURL(join(ROOT, "src/field-registry/denaliRegistryCodegen.ts")).href;
  const typesUrl = pathToFileURL(join(ROOT, "src/rules/denaliRuleModel.types.ts")).href;
  const codegen = await import(codegenUrl);
  const types = await import(typesUrl);
  return { codegen, types };
}

function formatRuleSetExport(ruleSet, categories, durations) {
  const lines = [];
  lines.push('import type { DenaliRuleSet } from "../denaliRuleModel.types";');
  lines.push("");
  lines.push("export const denaliRuleSet: DenaliRuleSet = {");

  for (const category of categories) {
    lines.push(`  ${category}: {`);
    for (const duration of durations) {
      const model = ruleSet[category][duration];
      if (model == null) {
        lines.push(`    ${duration}: null,`);
        continue;
      }
      lines.push(`    ${duration}: {`);
      lines.push(`      category: "${category}",`);
      lines.push(`      duration: "${duration}",`);
      lines.push("      fields: [");
      for (const field of model.fields) {
        lines.push(
          `        { path: "${field.path}", required: ${field.required}, hidden: ${field.hidden}, step: "${field.step}" },`
        );
      }
      lines.push("      ],");
      lines.push("    },");
    }
    lines.push("  },");
  }

  lines.push("};");
  lines.push("");
  lines.push("export const denaliRuleModelMountainMultiDay = denaliRuleSet.mountain.multi_day!;");
  return lines.join("\n");
}

function formatCanonicalMap(map) {
  const lines = [];
  lines.push('import type { DenaliCreateTourWizardForm } from "../../schemas/denaliCore.schema";');
  lines.push("");
  lines.push("export const DENALI_CANONICAL_TO_FORM_PATH_MAP: Record<string, string> = {");
  for (const key of Object.keys(map).sort()) {
    lines.push(`  "${key}": "${map[key]}",`);
  }
  lines.push("} as const satisfies Record<string, keyof DenaliCreateTourWizardForm | string>;");
  return lines.join("\n");
}

function formatConditionalPaths(paths) {
  const lines = [];
  lines.push("export const DENALI_CONDITIONALLY_REQUIRED_CANONICAL_PATHS = [");
  for (const path of paths) {
    lines.push(`  "${path}",`);
  }
  lines.push("] as const;");
  return lines.join("\n");
}

async function main() {
  const { codegen, types } = await loadCodegen();
  const ruleSet = codegen.buildDenaliRuleSetFromRegistry();
  const canonicalMap = codegen.buildDenaliCanonicalMapFromRegistry();
  const conditionalPaths = codegen.buildDenaliConditionallyRequiredCanonicalPathsFromRegistry();

  mkdirSync(GENERATED_DIR, { recursive: true });

  writeFileSync(
    join(GENERATED_DIR, "denaliRuleSet.generated.ts"),
    BANNER +
      formatRuleSetExport(
        ruleSet,
        types.DENALI_RULE_MODEL_CATEGORIES,
        types.DENALI_RULE_MODEL_DURATIONS
      ),
    "utf8"
  );

  writeFileSync(
    join(GENERATED_DIR, "denaliCanonicalPathMap.generated.ts"),
    BANNER + formatCanonicalMap(canonicalMap),
    "utf8"
  );

  writeFileSync(
    join(GENERATED_DIR, "denaliConditionallyRequiredPaths.generated.ts"),
    BANNER + formatConditionalPaths(conditionalPaths),
    "utf8"
  );

  console.log("denali:codegen — wrote 3 files under src/rules/generated/");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
