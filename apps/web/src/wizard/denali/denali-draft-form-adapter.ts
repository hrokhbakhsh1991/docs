import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";

import type { DenaliWizardRulesModule } from "@/bootstrap/denali-wizard-rules";
import { tourWizardDraftToDenaliForm } from "@app-tour/workspace-denali/wizard/contextual";

import type { DenaliWizardRuleEvalContext } from "./denali-wizard-ui-context";
import { sanitizeDenaliWizardDraftRecord } from "@app-tour/workspace-denali/wizard/submit";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export { tourWizardDraftToDenaliForm };

/** Keep aligned with `@app-tour/workspace-denali` `denali-canonical-form-sync.ts`. */
const DENALI_TOUR_KIND_ALIAS_CANONICAL_PATHS = new Set(["duration", "eventVariant"]);

function shouldPersistCanonicalPathFromForm(canonicalPath: string): boolean {
  return !DENALI_TOUR_KIND_ALIAS_CANONICAL_PATHS.has(canonicalPath);
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

/** Merge sanitized Denali form leaves back onto canonical draft (invariant ghost purge). */
export function syncDenaliFormToTourWizardDraft(
  draft: TourWizardDraft,
  form: Record<string, unknown>,
  rules: DenaliWizardRulesModule
): TourWizardDraft {
  let next = draft;
  for (const [canonicalPath, formPath] of Object.entries(rules.canonicalToFormPathMap)) {
    if (!shouldPersistCanonicalPathFromForm(canonicalPath)) {
      continue;
    }
    const formValue = getNestedFormValue(form, formPath);
    const draftValue = getCanonicalValue(draft, canonicalPath);
    if (formValue === undefined) {
      if (draftValue !== undefined) {
        next = setCanonicalValue(next, canonicalPath, undefined);
      }
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
  draft: TourWizardDraft,
  rules: DenaliWizardRulesModule,
  evalContext: DenaliWizardRuleEvalContext
): TourWizardDraft {
  const next = sanitizeDenaliWizardDraftRecord(
    draft as unknown as Record<string, unknown>,
    rules as unknown as Parameters<typeof sanitizeDenaliWizardDraftRecord>[1],
    evalContext
  );
  if (draft.data != null && typeof draft.data === "object") {
    return { ...draft, data: next.data as TourWizardDraft["data"] };
  }
  return next as unknown as TourWizardDraft;
}
