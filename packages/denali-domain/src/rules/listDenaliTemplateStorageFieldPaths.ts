import { toDenaliTemplateStoragePath } from "@repo/types/denali";

import { listDenaliRuleFieldPaths } from "./denaliRuleModel";
import type { DenaliRuleSet } from "./denaliRuleModel";
import { denaliRuleSet } from "./denaliRuleModel";

/**
 * Canonical dot paths allowed in `canonicalData` JSON and `fieldRulesOverlay` at save time.
 * Derived from the rule registry, normalized to flat template storage vocabulary.
 */
export function listDenaliTemplateStorageFieldPaths(
  ruleSet: DenaliRuleSet = denaliRuleSet,
): readonly string[] {
  const paths = new Set<string>();
  for (const rulePath of listDenaliRuleFieldPaths(ruleSet)) {
    paths.add(toDenaliTemplateStoragePath(rulePath));
  }
  return [...paths].sort();
}
