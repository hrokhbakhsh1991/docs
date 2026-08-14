/**
 * Derive operator presentation surface state (PR13-A).
 * Display chrome only — never invents Case verdicts or ownership.
 */

import type { CaseEncounterPresentation } from "./case-encounter-presentation";

/** HTTP 200 surface states (loading/unavailable are UI chrome). */
export type EncounterPresentationSurfaceState = "normal" | "degraded" | "incomplete";

/** Full operator surface vocabulary including Host chrome. */
export type EncounterOperatorSurfaceState =
  | "loading"
  | "unavailable"
  | "degraded"
  | "incomplete"
  | "normal";

/**
 * Map presentation cues → surface state.
 * Incomplete wins over degraded when inspect is forced.
 */
export function deriveEncounterSurfaceState(
  encounter: CaseEncounterPresentation
): EncounterPresentationSurfaceState {
  if (
    encounter.completeness.inspectForced === true ||
    encounter.completeness.completenessClass === "incomplete_inspect" ||
    encounter.completeness.displayToken === "incomplete_inspect"
  ) {
    return "incomplete";
  }

  const attention = encounter.discoveryAttention?.attentionClass ?? "";
  if (
    attention === "provider_degraded" ||
    attention.includes("degraded") ||
    encounter.completeness.completenessClass === "inspect_forced"
  ) {
    return "degraded";
  }

  return "normal";
}
