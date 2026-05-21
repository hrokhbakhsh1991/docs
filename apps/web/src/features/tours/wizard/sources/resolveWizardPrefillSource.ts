import type { WizardPrefillQuery, WizardPrefillSource } from "./types";
import { parseWizardPrefillQuery } from "./parseWizardPrefillQuery";

type SearchParamReader = {
  get(name: string): string | null;
};

/** Parses URL query into a discriminated prefill source (map-phase F1.7). */
export function resolveWizardPrefillSource(params: SearchParamReader): WizardPrefillSource {
  return parseWizardPrefillQuery(params);
}

export function isWizardPrefillSource(query: WizardPrefillQuery): query is Exclude<WizardPrefillSource, { kind: "blank" }> {
  return query.kind !== "blank";
}
