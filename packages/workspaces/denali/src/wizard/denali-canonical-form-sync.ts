import { DENALI_COMPOSITE_DEPENDENT_PATHS } from "../composites/denali-composite-anchors";

/** Composite-dependent paths (e.g. `duration`, `eventVariant`) share anchors — never persist separately. */
export function shouldPersistCanonicalPathFromForm(canonicalPath: string): boolean {
  return !DENALI_COMPOSITE_DEPENDENT_PATHS.has(canonicalPath);
}
