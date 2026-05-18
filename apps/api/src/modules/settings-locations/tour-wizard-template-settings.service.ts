import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { normalizeTourFormProfileInput } from "@repo/types";

import { authRequiredError, tenantContextMissingError } from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import type { WorkspaceTourWizardTemplateResponseDto } from "./dto/workspace-tour-wizard-template-response.dto";
import { WorkspaceTourWizardTemplateEntity } from "./entities/workspace-tour-wizard-template.entity";

@Injectable()
export class TourWizardTemplateSettingsService {
  constructor(
    @InjectRepository(WorkspaceTourWizardTemplateEntity)
    private readonly templatesRepository: Repository<WorkspaceTourWizardTemplateEntity>,
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
      wizardContractVersion: row.wizardContractVersion,
      formProfileVersion: row.formProfileVersion,
    };
  }

  async findForWorkspace(): Promise<WorkspaceTourWizardTemplateResponseDto | null> {
    const workspaceId = this.resolveWorkspaceOrThrow();
    const row = await this.templatesRepository.findOne({ where: { workspaceId } });
    return row ? this.toResponse(row) : null;
  }
}
