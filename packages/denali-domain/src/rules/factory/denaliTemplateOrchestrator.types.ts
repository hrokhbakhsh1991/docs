import type { DraftSnapshot } from "@repo/shared-contracts";
import type { DenaliCanonicalTemplateValidationIssue } from "@repo/types/denali";

import type { DenaliCreateTourWizardForm } from "../../schemas/denaliCore.schema";
import type { DenaliCreateTourPayloadProjection } from "../../projection/wizardMapperHelpers";

export type OrchestrationFailureKind =
  | "canonical_validation"
  | "hydration_empty"
  | "projection";

export type WorkspaceTemplatePayload = {
  readonly workspaceId: string;
  readonly templateId: string;
  readonly canonicalData: Record<string, unknown>;
  readonly fieldRulesOverlay?: Record<string, unknown>;
};

export type OrchestrationOptions = {
  readonly tenantId?: string;
  readonly defaultValues?: DenaliCreateTourWizardForm;
  readonly bypassStepIndex?: number;
  /** When true, projection uses staging placeholders (default). Set false for submit-grade payload. */
  readonly submitGradeProjection?: boolean;
};

export type OrchestrationOutput = {
  readonly success: boolean;
  readonly payload: DenaliCreateTourPayloadProjection;
  readonly draftState: DraftSnapshot<Record<string, unknown>>;
  readonly errors?: readonly string[];
  readonly failureKind?: OrchestrationFailureKind;
  readonly validationIssues?: readonly DenaliCanonicalTemplateValidationIssue[];
};

export interface DenaliTemplateOrchestratorContract {
  /**
   * Drives headless tour instantiation and cloning across tenants.
   * Compiles templates, applies normalization rules, and returns a verified state DTO.
   */
  createDraftFromTemplate(
    template: WorkspaceTemplatePayload,
    options?: OrchestrationOptions,
  ): Promise<OrchestrationOutput>;

  /** Layer C storage paths for template builder + clone preset walker. */
  listModernOverlayStoragePaths(): readonly string[];
}
