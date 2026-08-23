import type { CanonicalDocument } from "../canonical/canonical-document";
import type { WorkspacePlugin } from "./workspace-plugin";
import type { WorkspaceViolation } from "./workspace-validation";

export type ValidationMode = "draft" | "publish";

/** Persist-path context — passed to all three pipeline stages. */
export type WorkspaceValidationPipelineContext = {
  /** Resolved plugin for validation (may differ from request workspaceType during starter bridge). */
  readonly plugin: WorkspacePlugin;
  readonly document: CanonicalDocument;
  /** Request workspace type (tenant binding), not necessarily plugin.id. */
  readonly workspaceType: string;
  readonly tenantId: string;
  readonly validationMode: ValidationMode;
  readonly validationVariant: "default" | "basic";
  /** Sync rules module for publish matrix — from generated bindings. */
  readonly rulesModule?: unknown;
  /** Publish-mode catalog allowlists — optional. */
  readonly catalogRefAllowlists?: WorkspaceValidationCatalogRefAllowlists;
  /** RuleContext dimensions passed to validateCanonical. */
  readonly dimensions: Readonly<Record<string, string>>;
};

/** Publish-mode catalog ref allowlists — host injects from tenant catalog resolvers. */
export type WorkspaceValidationCatalogRefAllowlists = {
  readonly activeThemeIds: readonly string[];
  readonly selectableLeaderIds: readonly string[];
};

export type WorkspaceValidationPipelineStage = (
  ctx: WorkspaceValidationPipelineContext,
) => WorkspaceViolation | null;

export type WorkspaceValidationPipeline = {
  readonly sharedValidation: WorkspaceValidationPipelineStage;
  readonly capabilityValidation: WorkspaceValidationPipelineStage;
  readonly workspacePolicyValidation: WorkspaceValidationPipelineStage;
};

/** CW8-03 preview — additive policy rules only; cannot skip shared/capability stages. */
export type WorkspacePolicyValidator = {
  readonly validate?: (ctx: WorkspaceValidationPipelineContext) => WorkspaceViolation | null;
  /**
   * CW8-04/CW8-05 — when true and workspace policy flag is set, host runner
   * skips flat hooks + publish gate for this workspace (strangler migration).
   */
  readonly supersedesFlatHooks?: boolean;
};

export type WorkspaceValidationPipelineStageId =
  | "shared"
  | "capability"
  | "workspacePolicy";

/** Pipeline violation with stage metadata for legacy-compatible throw formatting. */
export type WorkspaceValidationPipelineViolation = WorkspaceViolation & {
  readonly stage: WorkspaceValidationPipelineStageId;
};
