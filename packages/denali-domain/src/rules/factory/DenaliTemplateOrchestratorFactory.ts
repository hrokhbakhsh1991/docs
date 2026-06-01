import { CURRENT_DRAFT_SCHEMA_VERSION, type DraftSnapshot } from "@repo/shared-contracts";
import { resolveStoredTemplateCanonical, type DenaliCanonicalTemplateValidationIssue } from "@repo/types/denali";

import { tryHydrateCanonicalTemplate } from "../../adapters/canonicalTemplateHydration";
import { finalizeDenaliWizardHydration } from "../../adapters/denaliFormHydration";
import { DenaliDraftOrchestrator } from "../../draft/DenaliDraftOrchestrator";
import { pruneDenaliWizardFormToRegistry } from "../../draft/pruneDenaliWizardFormToRegistry";
import { resetWizardToRegistryDefaults } from "../../draft/resetWizardToRegistryDefaults";
import { normalizeDenaliWizardForm } from "../../normalize/clearHiddenFormValues";
import { buildDenaliCreateTourPayloadProjection } from "../../projection/buildDenaliCreateTourPayloadProjection";
import { listDenaliSettingsOverlayStoragePaths } from "../listDenaliSettingsOverlayStoragePaths";
import { resolveDenaliRuleSetFromOverlay } from "../templateOverlay";

import type {
  DenaliTemplateOrchestratorContract,
  OrchestrationFailureKind,
  OrchestrationOptions,
  OrchestrationOutput,
  WorkspaceTemplatePayload,
} from "./denaliTemplateOrchestrator.types";

function emptyDraftSnapshot(): DraftSnapshot<Record<string, unknown>> {
  const orchestrator = new DenaliDraftOrchestrator();
  const baseline = orchestrator.resetWizardToRegistryDefaults();
  const syncPayload = orchestrator.prepareDraftForSync(baseline, { currentStepIndex: 0 });
  return {
    data: syncPayload as unknown as Record<string, unknown>,
    version: 0,
    schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
    lastModified: Date.now(),
  };
}

function failureOutput(
  errors: readonly string[],
  options?: {
    failureKind?: OrchestrationFailureKind;
    validationIssues?: readonly DenaliCanonicalTemplateValidationIssue[];
  },
): OrchestrationOutput {
  return {
    success: false,
    payload: {},
    draftState: emptyDraftSnapshot(),
    errors,
    failureKind: options?.failureKind,
    validationIssues: options?.validationIssues,
  };
}

/**
 * Headless template → draft orchestrator (Phase 1 factory).
 * Pure in-memory pipeline: Layer A validation, Layer C overlay rules, hydration,
 * {@link normalizeDenaliWizardForm} / {@link finalizeDenaliWizardHydration}, registry prune,
 * and Postgres-compatible {@link DraftSnapshot} envelope assembly.
 */
export class DenaliTemplateOrchestratorFactory implements DenaliTemplateOrchestratorContract {
  private readonly draftOrchestrator = new DenaliDraftOrchestrator();

  /** Re-export Layer C paths consumed by clone / template builder (single source of truth). */
  static readonly modernOverlayStoragePaths = listDenaliSettingsOverlayStoragePaths();

  listModernOverlayStoragePaths(): readonly string[] {
    return DenaliTemplateOrchestratorFactory.modernOverlayStoragePaths;
  }

  async createDraftFromTemplate(
    template: WorkspaceTemplatePayload,
    options: OrchestrationOptions = {},
  ): Promise<OrchestrationOutput> {
    const resolved = resolveStoredTemplateCanonical({
      canonicalData: template.canonicalData,
      fieldRulesOverlay: template.fieldRulesOverlay,
    });
    if (!resolved.ok) {
      return failureOutput(
        resolved.issues.map((issue) =>
          issue.path ? `${issue.path}: ${issue.message}` : issue.message,
        ),
        {
          failureKind: "canonical_validation",
          validationIssues: resolved.issues,
        },
      );
    }

    const ruleSet = resolveDenaliRuleSetFromOverlay(template.fieldRulesOverlay);
    const defaultValues = options.defaultValues ?? resetWizardToRegistryDefaults();

    const hydrated = tryHydrateCanonicalTemplate(
      resolved.canonicalData,
      defaultValues,
      undefined,
      ruleSet,
    );
    if (hydrated == null) {
      return failureOutput(
        ["Template canonicalData produced no hydratable wizard fields."],
        { failureKind: "hydration_empty" },
      );
    }

    let form = normalizeDenaliWizardForm(hydrated.formValues, undefined, ruleSet);
    form = finalizeDenaliWizardHydration(form, ruleSet);
    form = pruneDenaliWizardFormToRegistry(form);

    const syncPayload = this.draftOrchestrator.prepareDraftForSync(form, {
      currentStepIndex: options.bypassStepIndex ?? 0,
    });

    const draftState: DraftSnapshot<Record<string, unknown>> = {
      data: syncPayload as unknown as Record<string, unknown>,
      version: 0,
      schemaVersion: CURRENT_DRAFT_SCHEMA_VERSION,
      lastModified: Date.now(),
    };

    try {
      const payload = buildDenaliCreateTourPayloadProjection(form, {
        mode: options.submitGradeProjection ? "submit" : "staging",
      });
      return {
        success: true,
        payload,
        draftState,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return failureOutput([message], { failureKind: "projection" });
    }
  }
}

export const denaliTemplateOrchestratorFactory = new DenaliTemplateOrchestratorFactory();
