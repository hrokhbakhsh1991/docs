import type { TourWizardDraft } from "@/tours/tour-wizard-draft";
import { getCanonicalValue, setCanonicalValue } from "@/tours/tour-wizard-draft-path";

import type { DenaliWizardRulesModule } from "@/bootstrap/denali-wizard-rules";

import type { DenaliWizardRuleEvalContext } from "./denali-wizard-ui-context";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function setNestedFormValue(target: Record<string, unknown>, formPath: string, value: unknown): void {
  const segments = formPath.split(".");
  let cursor: Record<string, unknown> = target;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index]!;
    const existing = cursor[key];
    const branch = isRecord(existing) ? { ...existing } : {};
    cursor[key] = branch;
    cursor = branch;
  }

  cursor[segments[segments.length - 1]!] = value;
}

function coerceDraftScalar(value: unknown): unknown {
  if (typeof value === "string") {
    if (value === "true") return true;
    if (value === "false") return false;
    const trimmed = value.trim();
    if (trimmed.length > 0 && /^-?\d+(\.\d+)?$/.test(trimmed)) {
      const parsed = Number(trimmed);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return value;
}

/** Map canonical-path draft values into the legacy Denali RHF form shape for rule evaluation. */
export function tourWizardDraftToDenaliForm(
  draft: TourWizardDraft,
  rules: DenaliWizardRulesModule
): ReturnType<DenaliWizardRulesModule["buildDefaultForm"]> {
  const form = rules.buildDefaultForm() as Record<string, unknown>;

  for (const [canonicalPath, formPath] of Object.entries(rules.canonicalToFormPathMap)) {
    const raw = getCanonicalValue(draft, canonicalPath);
    if (raw === undefined) {
      continue;
    }
    const value = Array.isArray(raw) || isRecord(raw) ? raw : coerceDraftScalar(raw);
    setNestedFormValue(form, formPath, value);
  }

  return form as ReturnType<DenaliWizardRulesModule["buildDefaultForm"]>;
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
  const form = tourWizardDraftToDenaliForm(draft, rules) as Record<string, unknown>;
  const sanitized = rules.applyDenaliInvariantState(
    form,
    evalContext.uiOptions,
    evalContext.ruleSet
  ) as Record<string, unknown>;
  return syncDenaliFormToTourWizardDraft(draft, sanitized, rules);
}
