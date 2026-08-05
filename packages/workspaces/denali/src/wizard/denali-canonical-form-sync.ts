import { DENALI_COMPOSITE_DEPENDENT_PATHS } from "../composites/denali-composite-anchors";
import { getDenaliFieldDefinitionByCanonicalPath } from "../rules/denaliContextualRules";

/**
 * Composite-dependent paths normally skip form→draft sanitize (anchors / UI are write SoT).
 * Exception (INV-DENALI-WIZ-010): `defaultWhenVisible` dependents (e.g. fitnessLevel) must
 * persist the seeded leaf so draft matches what sanitize wrote on the form.
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
