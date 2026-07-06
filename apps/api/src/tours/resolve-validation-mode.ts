import type { CanonicalDocument, WorkspacePlugin, WorkspaceViolation } from "@app-tour/workspace-sdk";
import {
  DENALI_TOUR_PUBLISH_ACTIVE_STATUS,
  readDenaliTourPublishStatusFromCanonical,
} from "@app-tour/workspace-denali/tours";
import { validateDenaliPublishReadinessSync } from "@app-tour/workspace-denali/wizard/validation";

import { readTourPublishStatusLabel } from "../canonical/workspace-canonical-tour-dispatch.ts";
import type { ValidateBeforePersistInput, ValidationMode } from "./canonical-validation-sync.types";
import { getDenaliWizardRulesModuleSync } from "./denali-wizard-rules-module-sync.ts";

export type { ValidationMode } from "./canonical-validation-sync.types";

function readEffectivePublishStatusLabel(
  workspaceType: string,
  document: CanonicalDocument
): string | undefined {
  const bound = readTourPublishStatusLabel(workspaceType, document);
  if (bound !== undefined) {
    return bound;
  }
  if (workspaceType === "denali") {
    return readDenaliTourPublishStatusFromCanonical(document);
  }
  return undefined;
}

function isPublishedPublishStatusLabel(
  workspaceType: string,
  label: string | undefined
): boolean {
  if (label === undefined) {
    return false;
  }
  if (workspaceType === "denali") {
    return label === DENALI_TOUR_PUBLISH_ACTIVE_STATUS;
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
  const label = readEffectivePublishStatusLabel(input.workspaceType, document);
  return isPublishedPublishStatusLabel(input.workspaceType, label) ? "publish" : "draft";
}

function draftEnvelope(document: CanonicalDocument): Readonly<Record<string, unknown>> {
  return { data: document.data as Record<string, unknown> };
}

/** Run workspace publish-readiness matrix when mode is `publish` (Phase 12.6 parity). */
export function runValidationModePublishGate(
  plugin: WorkspacePlugin,
  document: CanonicalDocument,
  mode: ValidationMode
): WorkspaceViolation | null {
  if (mode !== "publish") {
    return null;
  }

  const hostValidate = plugin.wizardHost?.validatePublishReadiness;
  if (hostValidate != null) {
    const result = hostValidate({
      plugin: {
        wizard: plugin.wizard,
        fieldRegistry: plugin.fieldRegistry,
        ruleSet: plugin.ruleSet,
        validation: plugin.validation,
      },
      draft: draftEnvelope(document),
      rulesModule: getDenaliWizardRulesModuleSync(),
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

  if (plugin.id === "denali") {
    const result = validateDenaliPublishReadinessSync(
      draftEnvelope(document),
      getDenaliWizardRulesModuleSync(),
      undefined,
      { publishTransition: true }
    );
    if (result.ok) {
      return null;
    }
    const first = result.violations[0];
    return {
      code: first?.code ?? "PUBLISH_READINESS_FAILED",
      message: first?.message ?? "publish readiness failed",
    };
  }

  return null;
}
