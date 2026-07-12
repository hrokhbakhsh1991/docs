import { DENALI_COMPOSITE_DEPENDENT_PATHS } from "../composites/denali-composite-anchors";

export type DenaliWizardTemplateFieldOverlayRef = {
  readonly canonicalPath: string;
  readonly hidden?: boolean;
  readonly defaultValue?: string;
};

/** Include hidden composite dependents that carry template defaults (WEB-WIZ-013). */
export function augmentDenaliWizardTemplateFieldOverlays<
  T extends DenaliWizardTemplateFieldOverlayRef,
>(
  templateSteps: readonly { readonly enabled?: boolean; readonly fields: readonly T[] }[],
  baseOverlays: ReadonlyMap<string, T>
): ReadonlyMap<string, T> {
  const overlays = new Map(baseOverlays);
  for (const step of templateSteps) {
    if (step.enabled === false) {
      continue;
    }
    for (const field of step.fields) {
      if (field.hidden !== true) {
        continue;
      }
      const path = field.canonicalPath.trim();
      if (path.length === 0 || !DENALI_COMPOSITE_DEPENDENT_PATHS.has(path)) {
        continue;
      }
      const defaultValue = field.defaultValue?.trim() ?? "";
      if (defaultValue.length === 0) {
        continue;
      }
      overlays.set(path, field);
    }
  }
  return overlays;
}
