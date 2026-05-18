import { createHash, randomUUID } from "node:crypto";

import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { EntityManager, Repository } from "typeorm";

import { authRequiredError, tenantContextMissingError } from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { IdempotencyService } from "../idempotency/idempotency.service";
import type { WorkspaceTourWizardDraftResponseDto } from "./dto/workspace-tour-wizard-draft-response.dto";
import type { UpsertWorkspaceTourWizardDraftDto } from "./dto/upsert-workspace-tour-wizard-draft.dto";
import { WorkspaceTourWizardDraftEntity } from "./entities/workspace-tour-wizard-draft.entity";

@Injectable()
export class TourWizardDraftSettingsService {
  constructor(
    @InjectRepository(WorkspaceTourWizardDraftEntity)
    private readonly draftsRepository: Repository<WorkspaceTourWizardDraftEntity>,
    private readonly requestContext: RequestContextService,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  private draftsRepo(manager: EntityManager): Repository<WorkspaceTourWizardDraftEntity> {
    return manager.getRepository(WorkspaceTourWizardDraftEntity);
  }

  private resolveScopeOrThrow(): { workspaceId: string; userId: string } {
    const workspaceId = this.requestContext.resolveEffectiveTenantId();
    if (!workspaceId) {
      throw new ForbiddenException(tenantContextMissingError());
    }
    const userId = this.requestContext.getUserId();
    if (!userId) {
      throw new ForbiddenException(authRequiredError());
    }
    return { workspaceId, userId };
  }

  private toResponse(row: WorkspaceTourWizardDraftEntity): WorkspaceTourWizardDraftResponseDto {
    const envelope =
      row.envelope && typeof row.envelope === "object" && !Array.isArray(row.envelope)
        ? row.envelope
        : {};
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      userId: row.userId,
      envelope,
      wizardContractVersion: row.wizardContractVersion,
      rowVersion: row.rowVersion,
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  /**
   * Tenant session binding rolls back implicit query-runner transactions on release;
   * route draft mutations through idempotency's committed transaction (same as tour create).
   */
  private runCommittedDraftMutation<TResponse>(
    workspaceId: string,
    userId: string,
    operation: string,
    payload: unknown,
    fn: (manager: EntityManager) => Promise<TResponse>,
  ): Promise<TResponse> {
    const requestHash = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    return this.idempotencyService
      .executeWithIdempotency(
        {
          tenantId: workspaceId,
          key: `tour-wizard-draft:${userId}:${operation}:${randomUUID()}`,
          endpoint: `/api/v2/settings/tour-wizard-draft#${operation}`,
          requestHash,
          statusCode: 200,
        },
        async (manager) => fn(manager),
      )
      .then((result) => result.responseBody);
  }

  async findForMember(): Promise<WorkspaceTourWizardDraftResponseDto | null> {
    const { workspaceId, userId } = this.resolveScopeOrThrow();
    const row = await this.draftsRepository.findOne({ where: { workspaceId, userId } });
    return row ? this.toResponse(row) : null;
  }

  async upsertForMember(
    dto: UpsertWorkspaceTourWizardDraftDto,
  ): Promise<WorkspaceTourWizardDraftResponseDto> {
    const { workspaceId, userId } = this.resolveScopeOrThrow();
    return this.runCommittedDraftMutation(workspaceId, userId, "upsert", dto, async (manager) => {
      const repo = this.draftsRepo(manager);
      const existing = await repo.findOne({ where: { workspaceId, userId } });
      const expectedVersion = dto.rowVersion;
      if (existing && expectedVersion != null && existing.rowVersion !== expectedVersion) {
        throw new ConflictException({
          error: {
            code: "WIZARD_DRAFT_VERSION_MISMATCH",
            message: "Wizard draft was updated on another device. Refresh and merge.",
          },
        });
      }
      const wizardContractVersion =
        dto.wizardContractVersion ?? existing?.wizardContractVersion ?? 1;
      const rowVersion = existing ? existing.rowVersion + 1 : 1;
      await repo.upsert(
        {
          workspaceId,
          userId,
          envelope: dto.envelope as never,
          wizardContractVersion,
          rowVersion,
        },
        { conflictPaths: ["workspaceId", "userId"] },
      );
      const row = await repo.findOneOrFail({ where: { workspaceId, userId } });
      return this.toResponse(row);
    });
  }

  async deleteForMember(): Promise<void> {
    const { workspaceId, userId } = this.resolveScopeOrThrow();
    await this.runCommittedDraftMutation(workspaceId, userId, "delete", { userId }, async (manager) => {
      await this.draftsRepo(manager).delete({ workspaceId, userId });
      return { ok: true };
    });
  }
}
