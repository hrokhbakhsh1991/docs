import type { CanonicalDocument, WorkspacePlugin, WorkspaceViolation } from "@app-tour/workspace-sdk";

import { readTourPublishStatusLabel } from "../canonical/workspace-canonical-tour-dispatch.ts";
import { mapTourPublishStatusLabelToBucket } from "../canonical/workspace-publish-label-mapping-dispatch.ts";
import type { ValidateBeforePersistInput, ValidationMode } from "./canonical-validation-sync.types";
import { getWizardRulesModuleSyncForWorkspace } from "./workspace-wizard-rules-bindings.generated.ts";

export type { ValidationMode } from "./canonical-validation-sync.types";

function isPublishedPublishStatusLabel(workspaceType: string, label: string | undefined): boolean {
  const bucket = mapTourPublishStatusLabelToBucket(workspaceType, label);
  if (bucket !== undefined) {
    return bucket === "published";
  }
  if (label === undefined) {
    return false;
  }
  return label === "published" || label === "active";
}

/** P5-B-N-005 — infer RuleContext validation mode from explicit input or publishStatus. */
export function resolveValidationMode(
  input: ValidateBeforePersistInput,
  document: CanonicalDocument
): ValidationMode {
  if (input.validationMode != null) {
    return input.validationMode;
  }
  const label = readTourPublishStatusLabel(input.workspaceType, document);
  return isPublishedPublishStatusLabel(input.workspaceType, label) ? "publish" : "draft";
}

function draftEnvelope(document: CanonicalDocument): Readonly<Record<string, unknown>> {
  return { data: document.data as Record<string, unknown> };
}

/** Run workspace publish-readiness matrix when mode is `publish` (Phase 12.6 parity). */
export function runValidationModePublishGate(
  plugin: WorkspacePlugin,
  document: CanonicalDocument,
  mode: ValidationMode,
  workspaceType?: string
): WorkspaceViolation | null {
  if (mode !== "publish") {
    return null;
  }

  const hostValidate = plugin.wizardHost?.validatePublishReadiness;
  if (hostValidate == null) {
    return null;
  }

  const resolvedWorkspaceType = workspaceType ?? plugin.supportedWorkspaceTypes[0] ?? plugin.id;
  let rulesModule;
  try {
    rulesModule = getWizardRulesModuleSyncForWorkspace(resolvedWorkspaceType);
  } catch {
    return null;
  }

  const result = hostValidate({
    plugin: {
      wizard: plugin.wizard,
      fieldRegistry: plugin.fieldRegistry,
      ruleSet: plugin.ruleSet,
      validation: plugin.validation,
    },
    draft: draftEnvelope(document),
    rulesModule,
    evalContext: {},
    scope: { publishTransition: true },
  });
  if (result.ok) {
    return null;
  }
  const first = result.violations[0];
  return {
    code: first?.code ?? "PUBLISH_READINESS_FAILED",
    message: first?.message ?? "publish readiness failed",
  };
}
