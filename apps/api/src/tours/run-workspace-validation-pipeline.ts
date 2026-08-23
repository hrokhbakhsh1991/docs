import { PlatformWizardEngine } from "@app-tour/platform-core";
import type {
  CanonicalDocument,
  WorkspacePlugin,
  WorkspaceValidationPipelineContext,
  WorkspaceValidationPipelineStageId,
  WorkspaceValidationPipelineViolation,
  WorkspaceViolation,
} from "@app-tour/workspace-sdk";

import { assertCatalogRefIntegrity } from "../canonical/assert-catalog-ref-integrity.ts";
import { isWorkspaceValidationPipelinePolicySupersedeEnabled } from "./is-workspace-validation-pipeline-policy-supersede-enabled.ts";
import { runValidationModePublishGate } from "./resolve-validation-mode.ts";
import { runWorkspaceValidationHooks } from "./run-workspace-validation-hooks.ts";
import { WORKSPACE_CAPABILITY_VALIDATORS } from "./workspace-capability-validation-bindings.generated.ts";
import { resolveWorkspacePolicyValidator } from "./workspace-policy-validation-bindings.generated.ts";

export type RunWorkspaceValidationPipelineInput = WorkspaceValidationPipelineContext & {
  readonly engine: PlatformWizardEngine;
};

function withStage(
  stage: WorkspaceValidationPipelineStageId,
  violation: WorkspaceViolation
): WorkspaceValidationPipelineViolation {
  return { ...violation, stage };
}

/** sharedValidation — validateCanonical + optional filterEngineValidationResult. */
export function runSharedValidationStage(
  input: RunWorkspaceValidationPipelineInput
): WorkspaceValidationPipelineViolation | null {
  const { engine, plugin, document, tenantId, dimensions } = input;

  let result = engine.validateCanonical(document, {
    tenantId,
    dimensions: { ...dimensions },
  });
  const filterResult = plugin.wizardHost?.filterEngineValidationResult;
  if (filterResult != null) {
    result = filterResult(
      result,
      document.data as Record<string, unknown>
    ) as typeof result;
  }

  if (!result.ok) {
    const message = result.violations.map((violation) => violation.message).join("; ");
    return withStage("shared", {
      code: result.violations[0]?.code ?? "CANONICAL_VALIDATION_FAILED",
      message,
    });
  }

  return null;
}

/** capabilityValidation — manifest capability bindings + publish catalog refs. */
export function runCapabilityValidationStage(
  ctx: WorkspaceValidationPipelineContext
): WorkspaceValidationPipelineViolation | null {
  for (const binding of WORKSPACE_CAPABILITY_VALIDATORS) {
    const violation = binding.run(ctx);
    if (violation != null) {
      return withStage("capability", violation);
    }
  }

  if (ctx.validationMode === "publish" && ctx.catalogRefAllowlists != null) {
    const catalogViolation = assertCatalogRefIntegrity(ctx.document, ctx.catalogRefAllowlists);
    if (catalogViolation != null) {
      return withStage("capability", catalogViolation);
    }
  }

  return null;
}

/** workspacePolicyValidation — flat hooks + publish readiness matrix. */
export function runWorkspacePolicyValidationStage(
  ctx: WorkspaceValidationPipelineContext
): WorkspaceValidationPipelineViolation | null {
  const policyValidator = resolveWorkspacePolicyValidator(ctx.workspaceType);
  const supersedesFlatHooks =
    policyValidator?.supersedesFlatHooks === true &&
    isWorkspaceValidationPipelinePolicySupersedeEnabled(ctx.workspaceType);

  if (!supersedesFlatHooks) {
    const hookViolation = runWorkspaceValidationHooks(ctx.plugin, ctx.document);
    if (hookViolation != null) {
      return withStage("workspacePolicy", hookViolation);
    }

    const publishViolation = runValidationModePublishGate(
      ctx.plugin,
      ctx.document,
      ctx.validationMode,
      ctx.workspaceType
    );
    if (publishViolation != null) {
      return withStage("workspacePolicy", publishViolation);
    }
  }

  if (policyValidator?.validate != null) {
    const shouldRunPolicy =
      policyValidator.supersedesFlatHooks === true
        ? isWorkspaceValidationPipelinePolicySupersedeEnabled(ctx.workspaceType)
        : true;
    if (shouldRunPolicy) {
      const policyViolation = policyValidator.validate(ctx);
      if (policyViolation != null) {
        return withStage("workspacePolicy", policyViolation);
      }
    }
  }

  return null;
}

const PIPELINE_STAGES: readonly ((
  input: RunWorkspaceValidationPipelineInput
) => WorkspaceValidationPipelineViolation | null)[] = [
  runSharedValidationStage,
  (ctx) => runCapabilityValidationStage(ctx),
  (ctx) => runWorkspacePolicyValidationStage(ctx),
];

/**
 * CW8-02 — ordered validation pipeline: shared → capability → policy.
 * Short-circuits on first violation; sync-only stages.
 */
export function runWorkspaceValidationPipeline(
  input: RunWorkspaceValidationPipelineInput
): WorkspaceValidationPipelineViolation | null {
  for (const stage of PIPELINE_STAGES) {
    const violation = stage(input);
    if (violation != null) {
      return violation;
    }
  }
  return null;
}

/** Legacy-compatible throw formatting — shared stage omits code prefix. */
export function formatPipelineViolationMessage(
  violation: WorkspaceValidationPipelineViolation
): string {
  if (violation.stage === "shared") {
    return `CANONICAL_VALIDATION_FAILED: ${violation.message}`;
  }
  return `CANONICAL_VALIDATION_FAILED: ${violation.code}: ${violation.message}`;
}

/** Test helper — run legacy flat path segments without sharedValidation (engine already ran). */
export function runLegacyPostEngineValidation(
  plugin: WorkspacePlugin,
  document: CanonicalDocument,
  validationMode: WorkspaceValidationPipelineContext["validationMode"],
  workspaceType: string,
  catalogRefAllowlists?: WorkspaceValidationPipelineContext["catalogRefAllowlists"]
): WorkspaceViolation | null {
  const hookViolation = runWorkspaceValidationHooks(plugin, document);
  if (hookViolation != null) {
    return hookViolation;
  }

  const publishViolation = runValidationModePublishGate(
    plugin,
    document,
    validationMode,
    workspaceType
  );
  if (publishViolation != null) {
    return publishViolation;
  }

  if (validationMode === "publish" && catalogRefAllowlists != null) {
    return assertCatalogRefIntegrity(document, catalogRefAllowlists);
  }

  return null;
}
