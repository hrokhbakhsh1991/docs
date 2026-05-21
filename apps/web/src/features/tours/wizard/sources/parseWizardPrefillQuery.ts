import type { WizardPrefillQuery } from "./types";

type SearchParamReader = {
  get(name: string): string | null;
};

/**
 * Parses `/tours/new` query into a single prefill source.
 * Priority: clone > preset > blank (map-phase F1.7).
 */
export function parseWizardPrefillQuery(params: SearchParamReader): WizardPrefillQuery {
  const cloneTourId = params.get("clone")?.trim() ?? "";
  if (cloneTourId) {
    return { kind: "clone", cloneTourId };
  }
  const presetId = params.get("presetId")?.trim() ?? "";
  if (presetId) {
    return { kind: "preset", presetId };
  }
  return { kind: "blank" };
}

export function wizardPrefillNeedsBootstrap(query: WizardPrefillQuery): boolean {
  return query.kind !== "blank";
}
