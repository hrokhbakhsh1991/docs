import { toDenaliTemplateStoragePath } from "@repo/types/denali";

import { listDenaliRuleFieldPaths } from "./denaliRuleModel";
import type { DenaliRuleSet } from "./denaliRuleModel";
import { denaliRuleSet } from "./denaliRuleModel";

/**
 * Canonical dot paths allowed in `canonicalData` JSON and `fieldRulesOverlay` at save time.
 * Derived from the rule registry, normalized to flat template storage vocabulary.
 */
/** Layer A keys allowed in template JSONB but omitted from rule-model path listing. */
const TEMPLATE_STORAGE_PATH_EXTRAS = ["duration"] as const;

export function listDenaliTemplateStorageFieldPaths(
  ruleSet: DenaliRuleSet = denaliRuleSet,
): readonly string[] {
  const paths = new Set<string>(TEMPLATE_STORAGE_PATH_EXTRAS);
  for (const rulePath of listDenaliRuleFieldPaths(ruleSet)) {
    paths.add(toDenaliTemplateStoragePath(rulePath));
  }
  return [...paths].sort();
}
