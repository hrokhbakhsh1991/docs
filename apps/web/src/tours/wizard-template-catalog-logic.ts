import type { WorkspacePlugin } from "@app-tour/workspace-sdk";

import type {
  WizardTemplatePayload,
  WizardTemplateStepRef,
} from "@/features/settings/wizard-template-types";
import { formatWizardTemplateStepLabel } from "./wizard-template-field-labels";

export { formatWizardTemplateStepLabel };

/** INV-WIZ-002 — Layer C overlay-exclude rows carry this tag via plugin adapter. */
export const WIZARD_OVERLAY_EXCLUDE_TAG = "wizard_overlay_exclude" as const;

/** INV-WIZ-009 — roadmap rows visible in palette but not activatable. */
export const WIZARD_PALETTE_ROADMAP_TAG = "wizard_palette_roadmap" as const;

export function isWizardTemplatePaletteField(
  field: {
    readonly tags?: readonly string[];
    readonly groupSlug?: string;
  },
  inactiveFieldGroups: readonly string[] = []
): boolean {
  if (field.tags?.includes(WIZARD_OVERLAY_EXCLUDE_TAG)) {
    return false;
  }
  const groupSlug = field.groupSlug?.trim();
  if (groupSlug !== undefined && groupSlug.length > 0 && inactiveFieldGroups.includes(groupSlug)) {
    return false;
  }
  return true;
}

export function isWizardTemplateCatalogFieldSelectable(field: {
  readonly tags?: readonly string[];
  readonly selectable?: boolean;
}): boolean {
  if (field.selectable === false) {
    return false;
  }
  return !field.tags?.includes(WIZARD_PALETTE_ROADMAP_TAG);
}

export const WIZARD_TEMPLATE_CATALOG_TEST_IDS = {
  fieldList: "operator-wizard-template-field-list",
  fieldSearch: "operator-wizard-template-field-search",
  fieldToggle: "operator-wizard-template-field-toggle",
  fieldRequired: "operator-wizard-template-field-required",
  fieldDefault: "operator-wizard-template-field-default",
  fieldParent: "operator-wizard-template-field-parent",
  fieldCreateHint: "operator-wizard-template-field-create-hint",
  fieldRoadmap: "operator-wizard-template-field-roadmap",
} as const;

export type WizardTemplateCatalogField = {
  readonly canonicalPath: string;
  readonly stepId: string;
  readonly fieldId: string;
  readonly kind: string;
  readonly selectable: boolean;
};

export type WizardTemplateCatalogStep = {
  readonly stepId: string;
  readonly label: string;
  readonly fields: readonly WizardTemplateCatalogField[];
};

export function buildWizardTemplateCatalogFromPlugin(
  plugin: WorkspacePlugin
): readonly WizardTemplateCatalogStep[] {
  const byStep = new Map<string, WizardTemplateCatalogField[]>();

  const inactiveFieldGroups = plugin.wizard.inactiveFieldGroups;
  for (const field of plugin.fieldRegistry.fields) {
    if (!isWizardTemplatePaletteField(field, inactiveFieldGroups)) {
      continue;
    }
    const path = field.canonicalPath.trim();
    if (path.length === 0) {
      continue;
    }
    const bucket = byStep.get(field.stepId) ?? [];
    bucket.push({
      canonicalPath: path,
      stepId: field.stepId,
      fieldId: field.id,
      kind: field.kind,
      selectable: isWizardTemplateCatalogFieldSelectable(field),
    });
    byStep.set(field.stepId, bucket);
  }

  return [...byStep.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([stepId, fields]) => ({
      stepId,
      label: formatWizardTemplateStepLabel(stepId),
      fields: fields.sort((left, right) => left.canonicalPath.localeCompare(right.canonicalPath)),
    }));
}

export function isWizardTemplateCatalogFieldSelected(
  steps: readonly WizardTemplateStepRef[],
  canonicalPath: string
): boolean {
  return steps.some((step) =>
    step.enabled !== false &&
    step.fields.some((field) => field.canonicalPath === canonicalPath && field.hidden !== true)
  );
}

export function toggleWizardTemplateCatalogField(
  steps: readonly WizardTemplateStepRef[],
  field: WizardTemplateCatalogField,
  selected: boolean,
  options?: { readonly isFrozen?: (canonicalPath: string) => boolean }
): WizardTemplateStepRef[] {
  if (!selected && options?.isFrozen?.(field.canonicalPath) === true) {
    return [...steps];
  }
  if (!isWizardTemplateCatalogFieldSelectable(field)) {
    return [...steps];
  }
  const next = steps.map((step) => ({
    ...step,
    fields: step.fields.map((entry) => ({ ...entry })),
  }));

  if (selected) {
    const stepIndex = next.findIndex((step) => step.stepId === field.stepId);
    if (stepIndex >= 0) {
      const step = next[stepIndex];
      if (!step) {
        return next;
      }
      if (!step.fields.some((entry) => entry.canonicalPath === field.canonicalPath)) {
        step.fields.push({ canonicalPath: field.canonicalPath });
      }
      step.enabled = true;
      return next;
    }
    return [
      ...next,
      {
        stepId: field.stepId,
        label: formatWizardTemplateStepLabel(field.stepId),
        enabled: true,
        fields: [{ canonicalPath: field.canonicalPath }],
      },
    ];
  }

  const stepIndex = next.findIndex((step) => step.stepId === field.stepId);
  if (stepIndex < 0) {
    return next;
  }
  const step = next[stepIndex];
  if (!step) {
    return next;
  }
  step.fields = step.fields.filter((entry) => entry.canonicalPath !== field.canonicalPath);
  if (step.fields.length === 0) {
    next.splice(stepIndex, 1);
  }
  return next;
}

function findWizardTemplateFieldRef(
  steps: readonly WizardTemplateStepRef[],
  canonicalPath: string
): { readonly stepIndex: number; readonly fieldIndex: number } | null {
  for (let stepIndex = 0; stepIndex < steps.length; stepIndex += 1) {
    const step = steps[stepIndex];
    if (!step || step.enabled === false) {
      continue;
    }
    const fieldIndex = step.fields.findIndex((field) => field.canonicalPath === canonicalPath);
    if (fieldIndex >= 0) {
      return { stepIndex, fieldIndex };
    }
  }
  return null;
}

export function resolveWizardTemplateFieldRef(
  steps: readonly WizardTemplateStepRef[],
  canonicalPath: string
): WizardTemplateStepRef["fields"][number] | null {
  const location = findWizardTemplateFieldRef(steps, canonicalPath);
  if (location === null) {
    return null;
  }
  const step = steps[location.stepIndex];
  return step?.fields[location.fieldIndex] ?? null;
}

export function filterWizardTemplateCatalog(
  catalog: readonly WizardTemplateCatalogStep[],
  query: string,
  matchesField: (field: WizardTemplateCatalogField, stepLabel: string) => boolean
): readonly WizardTemplateCatalogStep[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return catalog;
  }
  return catalog
    .map((step) => ({
      ...step,
      fields: step.fields.filter((field) => matchesField(field, step.label)),
    }))
    .filter((step) => step.fields.length > 0);
}

export type WizardTemplatePreset = Pick<
  WizardTemplatePayload,
  "seedLabel" | "published" | "steps"
>;

/** Merge a workspace preset with the live catalog — drops paths not in the palette. */
export function applyWizardTemplatePreset(
  preset: WizardTemplatePreset,
  catalog: readonly WizardTemplateCatalogStep[],
  current: WizardTemplatePayload
): WizardTemplatePayload {
  const catalogPaths = new Set(
    catalog
      .flatMap((step) => step.fields)
      .filter((field) => field.selectable)
      .map((field) => field.canonicalPath)
  );

  const steps = (preset.steps ?? [])
    .map((step) => ({
      stepId: step.stepId,
      label: step.label,
      enabled: step.enabled !== false,
      fields: step.fields
        .filter((field) => catalogPaths.has(field.canonicalPath))
        .map((field) => ({
          canonicalPath: field.canonicalPath,
          ...(field.required === true ? { required: true } : {}),
        })),
    }))
    .filter((step) => step.fields.length > 0);

  const trimmedSeed = preset.seedLabel?.trim() ?? "";
  return {
    seedLabel: trimmedSeed.length > 0 ? trimmedSeed : current.seedLabel,
    sections: current.sections,
    published: preset.published ?? true,
    steps,
  };
}

export function updateWizardTemplateFieldOverlay(
  steps: readonly WizardTemplateStepRef[],
  canonicalPath: string,
  patch: { readonly required?: boolean; readonly defaultValue?: string }
): WizardTemplateStepRef[] {
  const location = findWizardTemplateFieldRef(steps, canonicalPath);
  if (location === null) {
    return [...steps];
  }
  return steps.map((step, stepIndex) => {
    if (stepIndex !== location.stepIndex) {
      return step;
    }
    return {
      ...step,
      fields: step.fields.map((field, fieldIndex) => {
        if (fieldIndex !== location.fieldIndex) {
          return field;
        }
        return {
          ...field,
          ...(patch.required !== undefined ? { required: patch.required } : {}),
          ...(patch.defaultValue !== undefined ? { defaultValue: patch.defaultValue } : {}),
        };
      }),
    };
  });
}
