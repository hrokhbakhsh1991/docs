import { FormRuleEngine, LookupRegistry } from "@repo/shared";

import type { DenaliCreateTourWizardForm } from "@/features/tours/wizard/schemas/denaliTourCreateSchema";
import { mapDenaliCanonicalToFormPath } from "@/features/tours/wizard/denali/rules/denaliRuleRequired";

import { DENALI_FORM_RULE_CONFIG } from "./denaliFormRuleConfig";
import { LOOKUP_PROVIDER_IDS } from "./lookupProviderIds";
import { registerWebLookupProviders } from "./registerWebLookupProviders";

export type CreateDenaliFormRuleEngineOptions = {
  getFormValues: () => DenaliCreateTourWizardForm;
  registry?: LookupRegistry;
};

/**
 * Factory for a Denali-scoped {@link FormRuleEngine} with web lookup providers registered.
 * UI layers call `handleFieldChange` / `subscribeLookup` — no React inside the engine.
 */
export function createDenaliFormRuleEngine(
  options: CreateDenaliFormRuleEngineOptions,
): FormRuleEngine<DenaliCreateTourWizardForm> {
  const registry = options.registry ?? new LookupRegistry();
  if (!registry.has(LOOKUP_PROVIDER_IDS.destinationSearch)) {
    registerWebLookupProviders(registry);
  }

  return new FormRuleEngine<DenaliCreateTourWizardForm>({
    rules: DENALI_FORM_RULE_CONFIG,
    registry,
    getFormValues: options.getFormValues,
    readPath: (form, path) => {
      const formPath = path.includes(".") ? path : mapDenaliCanonicalToFormPath(path);
      const segments = formPath.split(".");
      let current: unknown = form;
      for (const segment of segments) {
        if (current == null || typeof current !== "object") return undefined;
        current = (current as Record<string, unknown>)[segment];
      }
      return current;
    },
  });
}
