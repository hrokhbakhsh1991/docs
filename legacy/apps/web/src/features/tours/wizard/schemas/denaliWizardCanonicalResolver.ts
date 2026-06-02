import type { FieldErrors, Resolver } from "react-hook-form";

import {
  evaluateDenaliWizardSubmitGate,
  mergeDenaliActiveSubmitIssues,
} from "@/features/tours/wizard/denali/validation/denaliSubmitValidation";
import { validateDenaliWizardForm } from "@/features/tours/wizard/denali/validation/denaliWizardFormZod";

import type { DenaliCreateTourWizardForm } from "./denaliTourCreateFormModel";

function issuesToFieldErrors(
  issues: { path: (string | number)[]; message: string }[],
): FieldErrors<DenaliCreateTourWizardForm> {
  const errors: FieldErrors<DenaliCreateTourWizardForm> = {};

  for (const issue of issues) {
    const segments = issue.path.map(String);
    let cursor: Record<string, unknown> = errors as Record<string, unknown>;

    for (let i = 0; i < segments.length - 1; i += 1) {
      const segment = segments[i]!;
      if (cursor[segment] == null || typeof cursor[segment] !== "object") {
        cursor[segment] = {};
      }
      cursor = cursor[segment] as Record<string, unknown>;
    }

    const leaf = segments[segments.length - 1]!;
    cursor[leaf] = { type: "custom", message: issue.message };
  }

  return errors;
}

/**
 * RHF resolver — same pipeline as POST submit ({@link getDenaliWizardSubmitIssues}).
 * Pass `resolveUiOptions` so theme-based altitude rules match the program step.
 */
export function createDenaliCanonicalWizardResolver(
  resolveUiOptions?: () => import("@/features/tours/wizard/denali/rules/denaliUIAdapter").DenaliUIContextOptions,
  resolveRuleSet?: () => import("@/features/tours/wizard/denali/rules/denaliRuleModel").DenaliRuleSet,
): Resolver<DenaliCreateTourWizardForm> {
  return async (values, _context, _options) => {
    const gate = evaluateDenaliWizardSubmitGate(values, {
      uiOptions: resolveUiOptions?.(),
      ruleSet: resolveRuleSet?.(),
    });
    if (gate.success) {
      return { values: values as any, errors: {} };
    }
    const issues = mergeDenaliActiveSubmitIssues(gate.submitIssues, gate.publishIssues);
    return {
      values: values as any,
      errors: issuesToFieldErrors(issues as { path: (string | number)[]; message: string }[]),
    };
  };
}

/** Default resolver (no theme profile — altitude uses category only until themes load). */
export const denaliCanonicalWizardResolver: Resolver<DenaliCreateTourWizardForm> =
  createDenaliCanonicalWizardResolver();

export { validateDenaliWizardForm };
