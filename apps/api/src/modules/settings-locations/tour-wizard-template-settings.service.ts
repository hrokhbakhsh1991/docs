import { ForbiddenException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { normalizeTourFormProfileInput } from "@repo/types";
import { templateToCanonical } from "@repo/types/denali";

import { authRequiredError, tenantContextMissingError } from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { throwValidationFailed } from "../../common/errors/throw-validation-failed";
import { parseDenaliCanonicalTemplateDataOrThrow } from "./denali-canonical-template-data.schema";
import {
  WORKSPACE_SETTINGS_REPOSITORY_PORT,
  type WorkspaceSettingsRepositoryPort,
} from "./domain/ports/workspace-settings-repository.port";
import type { UpdateWorkspaceTourWizardTemplateDto } from "./dto/update-workspace-tour-wizard-template.dto";
import type { WorkspaceTourWizardTemplateResponseDto } from "./dto/workspace-tour-wizard-template-response.dto";
import { WorkspaceTourWizardTemplateEntity } from "./entities/workspace-tour-wizard-template.entity";
import { collectWorkspaceWizardTemplateValidationErrors } from "./validate-workspace-wizard-template";

@Injectable()
export class TourWizardTemplateSettingsService {
  constructor(
    @Inject(WORKSPACE_SETTINGS_REPOSITORY_PORT)
    private readonly settingsRepository: WorkspaceSettingsRepositoryPort,
    @Inject(RequestContextService)
    private readonly requestContext: RequestContextService,
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

  private toResponse(row: WorkspaceTourWizardTemplateEntity): WorkspaceTourWizardTemplateResponseDto {
    const skip = Array.isArray(row.stepOverrides?.skip)
      ? row.stepOverrides.skip.filter((s): s is string => typeof s === "string")
      : [];
    const insert = Array.isArray(row.stepOverrides?.insert)
      ? row.stepOverrides.insert.filter((s): s is string => typeof s === "string")
      : [];
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      baseProfile: normalizeTourFormProfileInput(row.baseProfile),
      stepOverrides: { skip, insert },
      fieldRulesOverlay:
        row.fieldRulesOverlay && typeof row.fieldRulesOverlay === "object" && !Array.isArray(row.fieldRulesOverlay)
          ? row.fieldRulesOverlay
          : {},
      presetId: row.presetId ?? null,
      canonicalData: templateToCanonical({
        canonicalData: row.canonicalData,
        fieldRulesOverlay: row.fieldRulesOverlay,
        stepOverrides: row.stepOverrides,
      }) as Record<string, unknown>,
      wizardContractVersion: row.wizardContractVersion,
      formProfileVersion: row.formProfileVersion,
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

    const validationErrors = collectWorkspaceWizardTemplateValidationErrors({
      fieldRulesOverlay: nextOverlay,
      canonicalData: nextCanonical,
    });
    if (validationErrors.length > 0) {
      throwValidationFailed(validationErrors);
    }

    if (body.fieldRulesOverlay !== undefined) {
      row.fieldRulesOverlay = body.fieldRulesOverlay;
    }
    if (body.canonicalData !== undefined) {
      row.canonicalData = parseDenaliCanonicalTemplateDataOrThrow(body.canonicalData);
    }

    const saved = await this.settingsRepository.saveTourWizardTemplate(row);
    return this.toResponse(saved);
  }
}
