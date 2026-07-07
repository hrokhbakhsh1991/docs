import { PlatformWizardEngine } from "@app-tour/platform-core";
import {
  validateWorkspaceDefinitionPayload,
  type WorkspaceDefinitionPayload,
} from "@app-tour/workspace-sdk/metadata";

import { buildPreviewPluginFromDraft } from "./build-preview-plugin-from-draft.ts";

export type BuilderPreviewSummary = {
  readonly violationCount: number;
  readonly violations: readonly string[];
  readonly stepCount: number;
  readonly fieldCount: number;
};

function previewRuleContext(payload: WorkspaceDefinitionPayload) {
  const defaultCell =
    payload.ruleSet.cells.find((cell) => cell.cellId === payload.ruleSet.defaultCellId) ??
    payload.ruleSet.cells[0];
  return {
    tenantId: "platform-builder-preview",
    dimensions: defaultCell?.dimensions ?? { variant: "default" },
  };
}

export function summarizeBuilderPreview(payload: WorkspaceDefinitionPayload): BuilderPreviewSummary {
  const validation = validateWorkspaceDefinitionPayload(payload);
  if (!validation.ok) {
    return {
      violationCount: 1,
      violations: [validation.error.message],
      stepCount: 0,
      fieldCount: 0,
    };
  }

  const duplicateIds = new Set<string>();
  const seen = new Set<string>();
  for (const field of payload.fieldRegistry.fields) {
    if (seen.has(field.id)) {
      duplicateIds.add(field.id);
    }
    seen.add(field.id);
  }
  if (duplicateIds.size > 0) {
    return {
      violationCount: duplicateIds.size,
      violations: [...duplicateIds].map((id) => `Duplicate field id: ${id}`),
      stepCount: 0,
      fieldCount: payload.fieldRegistry.fields.length,
    };
  }

  const plugin = buildPreviewPluginFromDraft(validation.value);
  const engineResult = PlatformWizardEngine.tryFromPlugin(plugin);
  if (!engineResult.ok) {
    return {
      violationCount: 1,
      violations: [engineResult.error.message],
      stepCount: 0,
      fieldCount: payload.fieldRegistry.fields.length,
    };
  }

  const planResult = engineResult.value.tryBuildRenderPlan(previewRuleContext(validation.value));
  if (!planResult.ok) {
    return {
      violationCount: 1,
      violations: [planResult.error.message],
      stepCount: 0,
      fieldCount: payload.fieldRegistry.fields.length,
    };
  }

  const plan = planResult.value;
  const fieldCount = plan.reduce((total, step) => total + step.fields.length, 0);
  return {
    violationCount: 0,
    violations: [],
    stepCount: plan.length,
    fieldCount,
  };
}
