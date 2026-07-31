import { createCanonicalDocument } from "@app-tour/workspace-sdk/canonical";
import type { WorkspacePlugin } from "@app-tour/workspace-sdk/plugin-types";
import type { WorkspaceWizardHostHooks } from "@app-tour/workspace-sdk/plugin";

import {
  PlatformWizardEngine,
  stripWorkspacePluginForWizardEngine,
} from "../engine/platform-wizard.engine";
import type { RenderStepPlan } from "../types/render-plan";
import type { ValidationResult } from "../types/validation-result";

export type PlatformWizardHostHooksOptions = {
  readonly dimensions: Readonly<Record<string, string>>;
};

function readDraftData(draft: Readonly<Record<string, unknown>>): Record<string, unknown> {
  if (draft.data != null && typeof draft.data === "object" && !Array.isArray(draft.data)) {
    return draft.data as Record<string, unknown>;
  }
  return draft as Record<string, unknown>;
}

function draftToCanonicalDocument(
  draft: Readonly<Record<string, unknown>>,
  plugin: WorkspacePlugin
) {
  const data = readDraftData(draft);
  const shell: Record<string, unknown> = {};
  for (const root of plugin.wizard.roots) {
    shell[root] = {};
  }
  const merged = structuredClone(shell);
  for (const [key, value] of Object.entries(data)) {
    if (!(key in merged)) {
      continue;
    }
    if (Array.isArray(value)) {
      merged[key] = structuredClone(value);
      continue;
    }
    merged[key] = structuredClone(value);
  }
  return createCanonicalDocument({
    schemaVersion: 1,
    roots: [...plugin.wizard.roots],
    data: merged,
  });
}

function filterValidationToStep(
  result: ValidationResult,
  step: RenderStepPlan
): ValidationResult {
  if (result.ok) {
    return result;
  }
  const fieldIds = new Set(step.fields.map((field) => field.fieldId));
  const canonicalPaths = new Set(step.fields.map((field) => field.canonicalPath));
  const violations = result.violations.filter(
    (violation) =>
      (violation.fieldId != null && fieldIds.has(violation.fieldId)) ||
      (violation.fieldId != null && canonicalPaths.has(violation.fieldId))
  );
  return {
    ok: violations.length === 0,
    violations,
  };
}

/** Platform-default wizard host hooks for workspaces without custom host hooks (Phase 12.8). */
export function createPlatformWizardHostHooks(
  options: PlatformWizardHostHooksOptions
): WorkspaceWizardHostHooks {
  const dimensions = Object.freeze({ ...options.dimensions });

  return Object.freeze({
    usesStepValidation: true,
    validationSurfaceId: "platform",
    wizardMessageNamespace: "wizard",
    resolveMatrixDimensionsFromDraft: () => dimensions,
    validateDraftSync: (input) => {
      const plugin = input.plugin as WorkspacePlugin;
      const engine = PlatformWizardEngine.create(stripWorkspacePluginForWizardEngine(plugin));
      engine.init();
      const document = draftToCanonicalDocument(input.draft, plugin);
      const result = engine.validateCanonical(document, {
        tenantId: input.tenantId,
        dimensions,
      });

      const scope = input.scope as
        | { readonly stepId?: string; readonly visibleSteps?: readonly RenderStepPlan[] }
        | undefined;
      if (scope?.stepId == null || scope.visibleSteps == null) {
        return result;
      }
      const step = scope.visibleSteps.find((entry) => entry.stepId === scope.stepId);
      if (step == null) {
        return result;
      }
      return filterValidationToStep(result, step);
    },
    prepareSubmitPayload: (input) =>
      draftToCanonicalDocument(input.draft, input.plugin as WorkspacePlugin),
  });
}
