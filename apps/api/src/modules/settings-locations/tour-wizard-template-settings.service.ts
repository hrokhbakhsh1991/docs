import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { normalizeTourFormProfileInput } from "@repo/types";
import type { DenaliCanonicalTemplateData } from "@repo/types/denali";
import { isDenaliCanonicalTemplateDataEmpty } from "@repo/types/denali";

import { DataCorruptionError } from "../../common/errors/data-corruption.exception";
import { authRequiredError, tenantContextMissingError } from "../../common/errors/error-response-builders";
import { LoggerService } from "../../common/logger/logger.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { throwValidationFailed } from "../../common/errors/throw-validation-failed";
import { DraftEngineFacade } from "../draft-engine/draft-engine.facade";
import { TemplateOrchestratorService } from "../draft-engine/services/template-orchestrator.service";
import type { OrchestrationOutput } from "@repo/denali-domain";
import {
  WORKSPACE_SETTINGS_REPOSITORY_PORT,
  type WorkspaceSettingsRepositoryPort,
} from "./domain/ports/workspace-settings-repository.port";
import type { UpdateWorkspaceTourWizardTemplateDto } from "./dto/update-workspace-tour-wizard-template.dto";
import type { TourWizardTemplateInstantiateResponseDto } from "./dto/tour-wizard-template-instantiate-response.dto";
import type { WorkspaceTourWizardTemplateResponseDto } from "./dto/workspace-tour-wizard-template-response.dto";
import type { WorkspaceTourWizardTemplateRecord } from "./domain/workspace-catalog.records";
import { resolveStoredTemplateCanonical } from "./resolve-stored-template-canonical";
import {
  collectWorkspaceWizardTemplatePublishErrors,
  validateWorkspaceWizardTemplatePayload,
} from "./validate-workspace-wizard-template";

const DENALI_CREATE_DRAFT_KEY = "denali-create";

const TEMPLATE_EMPTY_USER_MESSAGE =
  "The selected template contains no data. Please select a valid template with itinerary or program details.";

/** First-run workspace seed applied when canonical_data was never configured via Settings. */
const MINIMAL_TEMPLATE_CANONICAL_SEED: DenaliCanonicalTemplateData = {
  category: "mountain",
  duration: "single",
  title: "New Tour",
  program: { shortDescription: "", themeIds: [] },
};

@Injectable()
export class TourWizardTemplateSettingsService {
  constructor(
    @Inject(WORKSPACE_SETTINGS_REPOSITORY_PORT)
    private readonly settingsRepository: WorkspaceSettingsRepositoryPort,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
    private readonly templateOrchestrator: TemplateOrchestratorService,
    private readonly draftEngineFacade: DraftEngineFacade,
    @Inject(LoggerService)
    private readonly logger: LoggerService,
  ) {}

  private resolveWorkspaceOrThrow(): string {
    const workspaceId = this.requestContext.resolveEffectiveTenantId();
    if (!workspaceId) {
      throw new ForbiddenException(tenantContextMissingError());
    }
    const userId = this.requestContext.getUserId();
    if (!userId) {
      throw new ForbiddenException(authRequiredError());
    }
    return workspaceId;
  }

  private resolveFieldRulesOverlay(
    row: WorkspaceTourWizardTemplateRecord,
  ): Record<string, unknown> {
    return row.fieldRulesOverlay &&
      typeof row.fieldRulesOverlay === "object" &&
      !Array.isArray(row.fieldRulesOverlay)
      ? row.fieldRulesOverlay
      : {};
  }

  private resolveCorrelationId(): string {
    return (
      this.requestContext.tryGetCorrelationId() ??
      this.requestContext.tryGetRequestId() ??
      "unknown"
    );
  }

  /** True when the row was provisioned but Settings never persisted canonical seed (updatedAt unchanged). */
  private isTemplateCanonicalNeverUserConfigured(
    row: WorkspaceTourWizardTemplateRecord,
  ): boolean {
    return row.updatedAt.getTime() === row.createdAt.getTime();
  }

  /**
   * Persists a minimal hydratable canonical seed when the workspace template row was never
   * configured. Skips rows the user has already saved (updatedAt advanced) to avoid overwriting.
   */
  async ensureMinimalTemplateSeed(
    row: WorkspaceTourWizardTemplateRecord,
  ): Promise<WorkspaceTourWizardTemplateRecord> {
    if (!isDenaliCanonicalTemplateDataEmpty(row.canonicalData)) {
      return row;
    }
    if (!this.isTemplateCanonicalNeverUserConfigured(row)) {
      return row;
    }

    const correlationId = this.resolveCorrelationId();
    row.canonicalData = { ...MINIMAL_TEMPLATE_CANONICAL_SEED };
    const saved = await this.settingsRepository.saveTourWizardTemplate(row);
    this.logger.info("tour_wizard_template_minimal_seed_applied", {
      correlationId,
      templateId: saved.id,
      workspaceId: saved.workspaceId,
    });
    return saved;
  }

  private throwEmptyTemplateError(row: WorkspaceTourWizardTemplateRecord): never {
    const correlationId = this.resolveCorrelationId();
    this.logger.warn("tour_wizard_template_empty", {
      correlationId,
      errorCode: "TEMPLATE_CANONICAL_EMPTY",
      templateId: row.id,
      workspaceId: row.workspaceId,
    });
    throw new BadRequestException({
      error: {
        code: "TEMPLATE_CANONICAL_EMPTY",
        message: TEMPLATE_EMPTY_USER_MESSAGE,
        retryability: "NO_RETRY",
        details: {
          correlationId,
          failureKind: "hydration_empty",
        },
      },
    });
  }

  private throwInstantiateOrchestratorFailure(
    row: WorkspaceTourWizardTemplateRecord,
    result: OrchestrationOutput,
  ): never {
    const correlationId = this.resolveCorrelationId();

    if (result.failureKind === "hydration_empty") {
      this.throwEmptyTemplateError(row);
    }

    if (
      result.failureKind === "canonical_validation" &&
      result.validationIssues &&
      result.validationIssues.length > 0
    ) {
      this.logger.error("tour_wizard_template_canonical_corrupt", {
        correlationId,
        errorCode: "TEMPLATE_CANONICAL_DATA_CORRUPT",
        templateId: row.id,
        workspaceId: row.workspaceId,
        issues: result.validationIssues,
        failureKind: result.failureKind,
      });
      throw new DataCorruptionError({
        templateId: row.id,
        workspaceId: row.workspaceId,
        issues: result.validationIssues,
      });
    }

    this.logger.error("tour_wizard_template_instantiate_failed", {
      correlationId,
      errorCode: "TEMPLATE_INSTANTIATE_SILENT_FAILURE",
      templateId: row.id,
      workspaceId: row.workspaceId,
      failureKind: result.failureKind ?? "unknown",
      errors: result.errors ?? [],
    });
    throw new BadRequestException({
      error: {
        code: "TEMPLATE_INSTANTIATE_SILENT_FAILURE",
        message: "Template orchestration failed",
        retryability: "NO_RETRY",
        details: {
          correlationId,
          failureKind: result.failureKind ?? "unknown",
          errors: result.errors ?? [],
        },
      },
    });
  }

  private resolveValidatedCanonicalDataOrThrow(
    row: WorkspaceTourWizardTemplateRecord,
  ): DenaliCanonicalTemplateData {
    const resolved = resolveStoredTemplateCanonical(
      {
        canonicalData: row.canonicalData,
        fieldRulesOverlay: row.fieldRulesOverlay,
        stepOverrides: row.stepOverrides,
      },
      {
        onDiscardedKey: (discardedKey) => {
          this.logger.warn("template_canonical_top_level_fossil_discarded", {
            templateId: row.id,
            workspaceId: row.workspaceId,
            discardedKey,
          });
        },
      },
    );

    if (!resolved.ok) {
      this.logger.error("tour_wizard_template_canonical_corrupt", {
        correlationId: this.resolveCorrelationId(),
        errorCode: "TEMPLATE_CANONICAL_DATA_CORRUPT",
        templateId: row.id,
        workspaceId: row.workspaceId,
        issues: resolved.issues,
      });
      throw new DataCorruptionError({
        templateId: row.id,
        workspaceId: row.workspaceId,
        issues: resolved.issues,
      });
    }

    return resolved.canonicalData;
  }

  private toResponse(row: WorkspaceTourWizardTemplateRecord): WorkspaceTourWizardTemplateResponseDto {
    const skip = Array.isArray(row.stepOverrides?.skip)
      ? row.stepOverrides.skip.filter((s): s is string => typeof s === "string")
      : [];
    const insert = Array.isArray(row.stepOverrides?.insert)
      ? row.stepOverrides.insert.filter((s): s is string => typeof s === "string")
      : [];
    const canonicalData = this.resolveValidatedCanonicalDataOrThrow(row);
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      baseProfile: normalizeTourFormProfileInput(row.baseProfile),
      stepOverrides: { skip, insert },
      fieldRulesOverlay: this.resolveFieldRulesOverlay(row),
      presetId: row.presetId ?? null,
      canonicalData: canonicalData as Record<string, unknown>,
      wizardContractVersion: row.wizardContractVersion,
      formProfileVersion: row.formProfileVersion,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async findForWorkspace(): Promise<WorkspaceTourWizardTemplateResponseDto | null> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const row = await this.settingsRepository.findTourWizardTemplateByWorkspace(workspaceId);
    return row ? this.toResponse(row) : null;
  }

  async updateForWorkspace(
    body: UpdateWorkspaceTourWizardTemplateDto,
  ): Promise<WorkspaceTourWizardTemplateResponseDto> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const row = await this.settingsRepository.findTourWizardTemplateByWorkspace(workspaceId);
    if (!row) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Workspace tour wizard template is not configured",
        },
      });
    }

    const nextOverlay =
      body.fieldRulesOverlay !== undefined ? body.fieldRulesOverlay : row.fieldRulesOverlay;
    const nextCanonical =
      body.canonicalData !== undefined ? body.canonicalData : row.canonicalData;

    const { errors: validationErrors, sanitizedCanonical } = validateWorkspaceWizardTemplatePayload({
      fieldRulesOverlay: nextOverlay,
      canonicalData: nextCanonical,
    });
    if (validationErrors.length > 0) {
      throwValidationFailed(validationErrors);
    }

    if (body.publish === true && sanitizedCanonical != null) {
      const publishErrors = collectWorkspaceWizardTemplatePublishErrors(
        nextOverlay,
        sanitizedCanonical,
        normalizeTourFormProfileInput(row.baseProfile),
      );
      if (publishErrors.length > 0) {
        this.logger.warn("tour_wizard_template_publish_rejected", {
          templateId: row.id,
          workspaceId: row.workspaceId,
          errors: publishErrors,
        });
        throwValidationFailed(publishErrors);
      }
    }

    if (body.fieldRulesOverlay !== undefined) {
      row.fieldRulesOverlay = body.fieldRulesOverlay;
    }
    if (body.canonicalData !== undefined && sanitizedCanonical != null) {
      row.canonicalData = sanitizedCanonical;
    }

    const saved = await this.settingsRepository.saveTourWizardTemplate(row);
    return this.toResponse(saved);
  }

  async instantiateForWorkspace(input?: {
    seedDraft?: boolean;
  }): Promise<TourWizardTemplateInstantiateResponseDto> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const row = await this.settingsRepository.findTourWizardTemplateByWorkspace(workspaceId);
    if (!row) {
      throw new NotFoundException({
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Workspace tour wizard template is not configured",
        },
      });
    }

    const seededRow = await this.ensureMinimalTemplateSeed(row);
    const canonicalData = this.resolveValidatedCanonicalDataOrThrow(seededRow);
    const fieldRulesOverlay = this.resolveFieldRulesOverlay(seededRow);

    if (isDenaliCanonicalTemplateDataEmpty(canonicalData)) {
      this.throwEmptyTemplateError(seededRow);
    }

    const result = await this.templateOrchestrator.createDraftFromTemplate({
      workspaceId: seededRow.workspaceId,
      templateId: seededRow.id,
      canonicalData: canonicalData as Record<string, unknown>,
      fieldRulesOverlay,
    });

    if (!result.success) {
      this.throwInstantiateOrchestratorFailure(seededRow, result);
    }

    let draftState = result.draftState;
    let seededDraft = false;

    if (input?.seedDraft) {
      draftState = await this.draftEngineFacade.upsertForMember(workspaceId, DENALI_CREATE_DRAFT_KEY, {
        data: result.draftState.data,
        version: result.draftState.version,
        schemaVersion: result.draftState.schemaVersion,
        lastModified: result.draftState.lastModified,
      });
      seededDraft = true;
    }

    return {
      success: true,
      draftState,
      payload: result.payload as Record<string, unknown>,
      seededDraft,
    };
  }
}
