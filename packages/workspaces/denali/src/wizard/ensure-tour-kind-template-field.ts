/**
 * INV-DENALI-WIZ-001 — tour kind (canonical `category`) is mandatory on create wizard.
 * INV-DENALI-WIZ-008 — catalog-critical fields cannot be disabled in tenant template overlay.
 * Tenant template overlays may trim optional fields but must not remove frozen set.
 */

export const DENALI_TOUR_KIND_CANONICAL_PATH = "category" as const;
export const DENALI_TOUR_KIND_STEP_ID = "denali_basic" as const;

export type DenaliWizardTemplateFieldRef = {
  readonly canonicalPath: string;
  readonly required?: boolean;
  readonly hidden?: boolean;
  readonly defaultValue?: unknown;
};

export type DenaliWizardTemplateStepRef = {
  readonly stepId: string;
  readonly label?: string;
  readonly enabled?: boolean;
  readonly fields: readonly DenaliWizardTemplateFieldRef[];
};

/**
 * Catalog + wizard core fields — always injected and not disableable in Settings template UI.
 * `program.themeIds` is the composite anchor for short description (INV-DENALI-WIZ-006).
 */
export const DENALI_FROZEN_TEMPLATE_FIELDS: Readonly<
  Record<string, readonly DenaliWizardTemplateFieldRef[]>
> = Object.freeze({
  denali_basic: Object.freeze([
    { canonicalPath: "category", required: true },
    { canonicalPath: "title", required: true },
    { canonicalPath: "destinationId", required: true },
    { canonicalPath: "startDateTime", required: true },
    { canonicalPath: "capacityMax", required: true },
  ]),
  denali_photos: Object.freeze([
    { canonicalPath: "program.themeIds" },
    { canonicalPath: "photos" },
  ]),
  denali_logistics: Object.freeze([{ canonicalPath: "transport.mode", required: true }]),
});

/** @deprecated Use DENALI_FROZEN_TEMPLATE_FIELDS — kept for matrix-inject tests and docs cross-refs. */
export const DENALI_MATRIX_REQUIRED_TEMPLATE_FIELDS: Readonly<
  Record<string, readonly DenaliWizardTemplateFieldRef[]>
> = Object.freeze({
  denali_photos: [{ canonicalPath: "program.shortDescription", required: true }],
});

function stepHasVisibleField(step: DenaliWizardTemplateStepRef, canonicalPath: string): boolean {
  if (step.enabled === false) {
    return false;
  }
  return step.fields.some(
    (field) => field.canonicalPath.trim() === canonicalPath && field.hidden !== true
  );
}

function stepHasVisibleFrozenField(
  steps: readonly DenaliWizardTemplateStepRef[],
  canonicalPath: string
): boolean {
  return steps.some(
    (step) =>
      step.enabled !== false &&
      step.fields.some(
        (field) => field.canonicalPath.trim() === canonicalPath && field.hidden !== true
      )
  );
}

function injectFieldsOnStep<T extends DenaliWizardTemplateStepRef>(
  steps: readonly T[],
  stepId: string,
  fields: readonly DenaliWizardTemplateFieldRef[],
  createIfMissing = false
): readonly T[] {
  const stepIndex = steps.findIndex((step) => step.stepId === stepId);
  if (stepIndex < 0) {
    if (!createIfMissing || fields.length === 0) {
      return steps;
    }
    return [
      ...steps,
      {
        stepId,
        enabled: true,
        fields: [...fields],
      } as unknown as T,
    ];
  }
  const step = steps[stepIndex]!;
  const missing = fields.filter(
    (field) => !stepHasVisibleField(step, field.canonicalPath.trim())
  );
  if (missing.length === 0) {
    return steps;
  }
  const nextStep = { ...step, fields: [...missing, ...step.fields] } as unknown as T;
  return steps.map((item, index) => (index === stepIndex ? nextStep : item));
}

export function listDenaliFrozenTemplateCanonicalPaths(): readonly string[] {
  return Object.freeze(
    Object.values(DENALI_FROZEN_TEMPLATE_FIELDS).flatMap((fields) =>
      fields.map((field) => field.canonicalPath.trim())
    )
  );
}

export function isDenaliFrozenTemplateCanonicalPath(canonicalPath: string): boolean {
  const trimmed = canonicalPath.trim();
  return listDenaliFrozenTemplateCanonicalPaths().includes(trimmed);
}

export function resolveDenaliFrozenTemplateFieldDefaultRequired(
  canonicalPath: string
): boolean {
  const trimmed = canonicalPath.trim();
  for (const fields of Object.values(DENALI_FROZEN_TEMPLATE_FIELDS)) {
    const match = fields.find((field) => field.canonicalPath.trim() === trimmed);
    if (match != null) {
      return match.required === true;
    }
  }
  return false;
}

/** Inject frozen fields when tenant template omitted them (INV-DENALI-WIZ-008). */
export function ensureDenaliFrozenTemplateSteps<T extends DenaliWizardTemplateStepRef>(
  steps: readonly T[]
): readonly T[] {
  let result = steps;
  for (const [stepId, fields] of Object.entries(DENALI_FROZEN_TEMPLATE_FIELDS)) {
    result = injectFieldsOnStep(result, stepId, fields, true);
  }
  return result;
}

export function ensureDenaliFrozenAllowedPaths(paths: readonly string[]): readonly string[] {
  const frozen = listDenaliFrozenTemplateCanonicalPaths();
  const missing = frozen.filter((path) => !paths.includes(path));
  return missing.length === 0 ? paths : [...missing, ...paths];
}

export class DenaliWizardTemplateFrozenFieldMissingError extends Error {
  readonly code = "SETTINGS_WIZARD_FROZEN_FIELD_MISSING" as const;

  constructor(readonly canonicalPath: string) {
    super(`SETTINGS_WIZARD_FROZEN_FIELD_MISSING:${canonicalPath}`);
    this.name = "DenaliWizardTemplateFrozenFieldMissingError";
  }
}

/** Fail closed on PUT when published template omits a frozen field (pre-normalize guard). */
export function assertDenaliFrozenWizardTemplateFieldsPresent(payload: {
  readonly published?: boolean;
  readonly steps?: readonly DenaliWizardTemplateStepRef[];
}): void {
  if (payload.published !== true || payload.steps === undefined || payload.steps.length === 0) {
    return;
  }
  for (const path of listDenaliFrozenTemplateCanonicalPaths()) {
    if (!stepHasVisibleFrozenField(payload.steps, path)) {
      throw new DenaliWizardTemplateFrozenFieldMissingError(path);
    }
  }
}

export type DenaliWizardTemplatePayloadLike = {
  readonly published?: boolean;
  readonly steps?: readonly DenaliWizardTemplateStepRef[];
};

/** Normalize published tenant template before persist (Settings PUT). */
export function normalizeDenaliWizardTemplatePayloadSteps<T extends DenaliWizardTemplatePayloadLike>(
  payload: T
): T {
  if (payload.published !== true || payload.steps === undefined) {
    return payload;
  }
  return {
    ...payload,
    steps: ensureDenaliFrozenTemplateSteps(payload.steps),
  } as T;
}

/** Inject matrix-required fields when tenant template omitted them (INV-DENALI-WIZ-005). */
export function ensureDenaliMatrixRequiredTemplateSteps<T extends DenaliWizardTemplateStepRef>(
  steps: readonly T[]
): readonly T[] {
  let result = steps;
  for (const [stepId, fields] of Object.entries(DENALI_MATRIX_REQUIRED_TEMPLATE_FIELDS)) {
    result = injectFieldsOnStep(result, stepId, fields);
  }
  return result;
}

export function ensureDenaliMatrixRequiredAllowedPaths(paths: readonly string[]): readonly string[] {
  const required = Object.values(DENALI_MATRIX_REQUIRED_TEMPLATE_FIELDS).flatMap((fields) =>
    fields.map((field) => field.canonicalPath.trim())
  );
  const missing = required.filter((path) => !paths.includes(path));
  return missing.length === 0 ? paths : [...missing, ...paths];
}

/** @deprecated Prefer `ensureDenaliFrozenTemplateSteps` — kept for INV-DENALI-WIZ-001 export parity. */
export function ensureDenaliTourKindTemplateSteps<T extends DenaliWizardTemplateStepRef>(
  steps: readonly T[]
): readonly T[] {
  return ensureDenaliFrozenTemplateSteps(steps);
}

/** @deprecated Prefer `ensureDenaliFrozenAllowedPaths`. */
export function ensureDenaliTourKindAllowedPaths(paths: readonly string[]): readonly string[] {
  return ensureDenaliFrozenAllowedPaths(paths);
}
