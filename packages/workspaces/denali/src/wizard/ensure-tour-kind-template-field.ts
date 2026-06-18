/**
 * INV-DENALI-WIZ-001 — tour kind (canonical `category`) is mandatory on create wizard.
 * Tenant template overlays may trim optional fields but must not remove classification.
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

const CATEGORY_FIELD: DenaliWizardTemplateFieldRef = {
  canonicalPath: DENALI_TOUR_KIND_CANONICAL_PATH,
  required: true,
};

function stepHasVisibleCategory(step: DenaliWizardTemplateStepRef): boolean {
  if (step.enabled === false) {
    return false;
  }
  return step.fields.some(
    (field) =>
      field.canonicalPath.trim() === DENALI_TOUR_KIND_CANONICAL_PATH && field.hidden !== true
  );
}

/** Inject `category` on `denali_basic` when tenant template omitted tour kind. */
export function ensureDenaliTourKindTemplateSteps<T extends DenaliWizardTemplateStepRef>(
  steps: readonly T[]
): readonly T[] {
  if (steps.some(stepHasVisibleCategory)) {
    return steps;
  }

  const basicIndex = steps.findIndex((step) => step.stepId === DENALI_TOUR_KIND_STEP_ID);
  if (basicIndex >= 0) {
    const basic = steps[basicIndex]!;
    const withoutCategory = basic.fields.filter(
      (field) => field.canonicalPath.trim() !== DENALI_TOUR_KIND_CANONICAL_PATH
    );
    const nextBasic = {
      ...basic,
      fields: [CATEGORY_FIELD, ...withoutCategory],
    } as unknown as T;
    return steps.map((step, index) => (index === basicIndex ? nextBasic : step));
  }

  return [
    {
      stepId: DENALI_TOUR_KIND_STEP_ID,
      label: "Basic",
      enabled: true,
      fields: [CATEGORY_FIELD],
    } as unknown as T,
    ...steps,
  ];
}

export function ensureDenaliTourKindAllowedPaths(paths: readonly string[]): readonly string[] {
  if (paths.includes(DENALI_TOUR_KIND_CANONICAL_PATH)) {
    return paths;
  }
  return [DENALI_TOUR_KIND_CANONICAL_PATH, ...paths];
}
