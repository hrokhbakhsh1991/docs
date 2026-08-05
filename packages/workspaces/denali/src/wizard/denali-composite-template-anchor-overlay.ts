import { DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR } from "../composites/denali-composite-anchors";

/**
 * Template/settings helpers historically kept a transport-only overlay map.
 * INV-DENALI-WIZ-013 — single SoT is `DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR`
 * (includes transport + pricing/program anchors). Alias retained for imports.
 */
export const DENALI_COMPOSITE_TEMPLATE_ANCHOR_OVERLAY: Readonly<
  Record<string, readonly string[]>
> = DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR;

export function listDenaliCompositeTemplateDependentsForAnchor(
  anchorPath: string
): readonly string[] {
  return DENALI_COMPOSITE_DEPENDENTS_BY_ANCHOR[anchorPath] ?? [];
}
