import type { RenderStepPlan } from "@app-tour/platform-core";

export function buildFieldStepResolverFromTemplate(
  templateSteps: readonly {
    readonly stepId: string;
    readonly enabled?: boolean;
    readonly fields: readonly { readonly canonicalPath: string; readonly hidden?: boolean }[];
  }[]
): (fieldId: string) => string | undefined {
  const byCanonicalPath = new Map<string, string>();
  for (const step of templateSteps) {
    if (step.enabled === false) {
      continue;
    }
    for (const field of step.fields) {
      if (field.hidden === true) {
        continue;
      }
      byCanonicalPath.set(field.canonicalPath, step.stepId);
    }
  }
  return (fieldId: string) => byCanonicalPath.get(fieldId);
}

export function buildFieldStepResolver(
  visibleSteps: readonly RenderStepPlan[]
): (fieldId: string) => string | undefined {
  const byFieldId = new Map<string, string>();
  const byCanonicalPath = new Map<string, string>();
  for (const step of visibleSteps) {
    for (const field of step.fields) {
      byFieldId.set(field.fieldId, step.stepId);
      byCanonicalPath.set(field.canonicalPath, step.stepId);
    }
  }
  return (fieldId: string) => byFieldId.get(fieldId) ?? byCanonicalPath.get(fieldId);
}
