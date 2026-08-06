import { DENALI_COMPOSITE_DEPENDENT_PATHS } from "../composites/denali-composite-anchors";
import { getDenaliFieldDefinitionByCanonicalPath } from "../rules/denaliContextualRules";

/**
 * Composite-dependent paths normally skip form→draft sanitize (anchors / UI are write SoT).
 * Exception (INV-DENALI-WIZ-010): remaining `defaultWhenVisible` dependents must persist the
 * seeded leaf so draft matches sanitize. Fitness/difficulty no longer use that invariant.
 */
export function shouldPersistCanonicalPathFromForm(canonicalPath: string): boolean {
  if (!DENALI_COMPOSITE_DEPENDENT_PATHS.has(canonicalPath)) {
    return true;
  }
  return (
    getDenaliFieldDefinitionByCanonicalPath(canonicalPath)?.structuralInvariant?.kind ===
    "defaultWhenVisible"
  );
}
