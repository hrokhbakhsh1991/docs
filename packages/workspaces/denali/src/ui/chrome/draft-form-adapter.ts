import {
  shouldPersistCanonicalPathFromForm,
  tourWizardDraftToDenaliForm,
} from "../../wizard/contextual";
import {
  sanitizeDenaliWizardDraftRecord,
  type DenaliWizardRuleEvalContext,
} from "../../wizard/denali-wizard-submit-payload";
import type { DenaliWizardRulesModule } from "../../wizard/denali-wizard-rules-module";
import {
  type DenaliTourWizardDraft,
  getCanonicalValue,
  setCanonicalValue,
} from "../../draft/denali-tour-wizard-draft";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export { tourWizardDraftToDenaliForm };

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

/** Merge sanitized Denali form leaves back onto canonical draft (invariant ghost purge). */
export function syncDenaliFormToTourWizardDraft(
  draft: DenaliTourWizardDraft,
  form: Record<string, unknown>,
  rules: DenaliWizardRulesModule
): DenaliTourWizardDraft {
  let next = draft;
  for (const [canonicalPath, formPath] of Object.entries(rules.canonicalToFormPathMap)) {
    const formValue = getNestedFormValue(form, formPath);
    const draftValue = getCanonicalValue(draft, canonicalPath);
    if (formValue === undefined) {
      if (draftValue !== undefined) {
        next = setCanonicalValue(next, canonicalPath, undefined);
      }
      continue;
    }
    if (!shouldPersistCanonicalPathFromForm(canonicalPath)) {
      continue;
    }
    const mapped =
      Array.isArray(formValue) || isRecord(formValue) ? formValue : formValueToDraftScalar(formValue);
    if (JSON.stringify(mapped) !== JSON.stringify(draftValue)) {
      next = setCanonicalValue(next, canonicalPath, mapped);
    }
  }
  return next;
}

export function sanitizeDenaliWizardDraft(
  draft: DenaliTourWizardDraft,
  rules: DenaliWizardRulesModule,
  evalContext: DenaliWizardRuleEvalContext
): DenaliTourWizardDraft {
  const next = sanitizeDenaliWizardDraftRecord(
    draft as unknown as Record<string, unknown>,
    rules,
    evalContext
  );
  if (draft.data != null && typeof draft.data === "object") {
    return { ...draft, data: next.data as DenaliTourWizardDraft["data"] };
  }
  return next as unknown as DenaliTourWizardDraft;
}
