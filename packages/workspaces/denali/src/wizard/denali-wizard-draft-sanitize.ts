import type { DenaliWizardRuleEvalContext } from "./denali-wizard-rule-eval-context";
import {
  getCanonicalValueFromDraft,
  setCanonicalValueOnDraft,
  type CanonicalWizardDraftEnvelope,
} from "./canonical-draft-access";
import type { DenaliWizardRulesModule } from "./denali-wizard-rules-module";
import { hasDenaliWizardClassification } from "./apply-contextual-render-plan";
import { shouldPersistCanonicalPathFromForm } from "./denali-canonical-form-sync";
import { tourWizardDraftToDenaliForm } from "./denali-wizard-form-adapter";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function asDraftEnvelope(draft: Readonly<Record<string, unknown>>): CanonicalWizardDraftEnvelope {
  if (draft.data != null && typeof draft.data === "object" && !Array.isArray(draft.data)) {
    return { data: draft.data as Record<string, unknown> };
  }
  return { data: draft as Record<string, unknown> };
}

function getNestedFormValue(form: Record<string, unknown>, formPath: string): unknown {
  const segments = formPath.split(".");
  let current: unknown = form;
  for (const segment of segments) {
    if (!isRecord(current) || !(segment in current)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

function formValueToDraftScalar(value: unknown): unknown {
  if (value === true) return "true";
  if (value === false) return "false";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return value;
}

function coerceScalarFormValueForDraft(formValue: unknown): unknown {
  if (formValue === null || formValue === undefined) {
    return formValue;
  }
  if (Array.isArray(formValue)) {
    return formValue;
  }
  if (isRecord(formValue)) {
    if (Object.keys(formValue).length === 0) {
      return undefined;
    }
    if (typeof formValue.value === "string" || typeof formValue.value === "number") {
      return formValueToDraftScalar(formValue.value);
    }
    return formValue;
  }
  return formValueToDraftScalar(formValue);
}

function syncDenaliFormToDraftEnvelope(
  draft: CanonicalWizardDraftEnvelope,
  form: Record<string, unknown>,
  rules: DenaliWizardRulesModule
): CanonicalWizardDraftEnvelope {
  let next = draft;
  for (const [canonicalPath, formPath] of Object.entries(rules.canonicalToFormPathMap)) {
    if (!shouldPersistCanonicalPathFromForm(canonicalPath)) {
      continue;
    }
    const formValue = getNestedFormValue(form, formPath);
    const draftValue = getCanonicalValueFromDraft(next, canonicalPath);
    if (formValue === undefined) {
      if (draftValue !== undefined) {
        next = setCanonicalValueOnDraft(next, canonicalPath, undefined);
      }
      continue;
    }
    const mapped = coerceScalarFormValueForDraft(formValue);
    if (JSON.stringify(mapped) !== JSON.stringify(draftValue)) {
      next = setCanonicalValueOnDraft(next, canonicalPath, mapped);
    }
  }
  return next;
}

export function sanitizeDenaliWizardDraftEnvelope(
  draft: CanonicalWizardDraftEnvelope,
  rules: DenaliWizardRulesModule,
  evalContext: DenaliWizardRuleEvalContext
): CanonicalWizardDraftEnvelope {
  if (!hasDenaliWizardClassification(draft, rules)) {
    return draft;
  }
  const form = tourWizardDraftToDenaliForm(draft, rules);
  const sanitized = rules.applyDenaliInvariantState(
    form,
    evalContext.uiOptions as Parameters<DenaliWizardRulesModule["applyDenaliInvariantState"]>[1],
    evalContext.ruleSet
  );
  return syncDenaliFormToDraftEnvelope(draft, sanitized as unknown as Record<string, unknown>, rules);
}

export function sanitizeDenaliWizardDraftRecord(
  draft: Readonly<Record<string, unknown>>,
  rules: DenaliWizardRulesModule,
  evalContext: DenaliWizardRuleEvalContext
): Record<string, unknown> {
  const envelope = sanitizeDenaliWizardDraftEnvelope(asDraftEnvelope(draft), rules, evalContext);
  if (draft.data != null && typeof draft.data === "object" && !Array.isArray(draft.data)) {
    return { ...draft, data: envelope.data };
  }
  return envelope.data;
}
