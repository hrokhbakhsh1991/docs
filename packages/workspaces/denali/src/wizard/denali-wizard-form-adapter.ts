import type { DenaliWizardRulesModule } from "./denali-wizard-rules-module";
import {
  getCanonicalValueFromDraft,
  type CanonicalWizardDraftEnvelope,
} from "./canonical-draft-access";
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

/**
 * Map canonical-path draft values into legacy Denali form shape for rule evaluation.
 * Composite-dependent paths (e.g. `program.shortDescription`) are included here so publish
 * readiness and contextual rules see wizard draft values. Form→draft persistence still
 * uses `shouldPersistCanonicalPathFromForm` in sanitize / sync adapters.
 */
export function tourWizardDraftToDenaliForm(
  draft: CanonicalWizardDraftEnvelope,
  rules: DenaliWizardRulesModule
): ReturnType<DenaliWizardRulesModule["buildDefaultForm"]> {
  const form = rules.buildDefaultForm() as unknown as Record<string, unknown>;
  const writtenFormPaths = new Set<string>();

  for (const [canonicalPath, formPath] of Object.entries(rules.canonicalToFormPathMap)) {
    // Shared storage aliases (for example category/duration/eventVariant -> basicInfo.tourType)
    // must preserve the anchor's raw persisted value instead of overwriting it with derived values.
    if (writtenFormPaths.has(formPath)) {
      continue;
    }
    const raw = getCanonicalValueFromDraft(draft, canonicalPath);
    if (raw === undefined) {
      continue;
    }
    const value = Array.isArray(raw) || isRecord(raw) ? raw : coerceDraftScalar(raw);
    setNestedFormValue(form, formPath, value);
    writtenFormPaths.add(formPath);
  }

  return form as unknown as ReturnType<DenaliWizardRulesModule["buildDefaultForm"]>;
}
