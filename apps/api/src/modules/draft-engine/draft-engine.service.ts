import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { authRequiredError } from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { DraftConflictException } from "./draft-conflict.exception";
import { DraftSnapshotEntity } from "./entities/draft-snapshot.entity";
import type { DraftSyncPayloadDto } from "./dto/draft-sync-payload.dto";

export type DraftSyncPayloadResponse = {
  data: Record<string, unknown>;
  version: number;
  lastModified: number;
};

@Injectable()
export class DraftEngineService {
  private readonly logger = new Logger(DraftEngineService.name);

  constructor(
    @InjectRepository(DraftSnapshotEntity)
    private readonly draftsRepository: Repository<DraftSnapshotEntity>,
    private readonly requestContext: RequestContextService,
  ) {}

  private resolveScopeOrThrow(paramTenantId: string): { workspaceId: string; userId: string } {
    const jwtTenantId = this.requestContext.resolveEffectiveTenantId()?.trim().toLowerCase();
    const normalized = paramTenantId.trim().toLowerCase();
    if (!jwtTenantId || jwtTenantId !== normalized) {
      throw new ForbiddenException({
        error: {
          code: "TENANT_SCOPE_FORBIDDEN",
          message: "Draft access requires a token scoped to this workspace",
        },
      });
    }

    const userId = this.requestContext.getUserId();
    if (!userId) {
      throw new ForbiddenException(authRequiredError());
    }

    return { workspaceId: normalized, userId };
  }

  private toPayload(row: DraftSnapshotEntity): DraftSyncPayloadResponse {
    return {
      data: row.data,
      version: Number(row.version),
      lastModified: Number(row.lastModified),
    };
  }

  async findForMember(tenantId: string, draftKey: string): Promise<DraftSyncPayloadResponse | null> {
    const { workspaceId, userId } = this.resolveScopeOrThrow(tenantId);

    const where = { workspaceId, userId, draftKey };
    const queryTrace = this.draftsRepository
      .createQueryBuilder("draft_snapshots")
      .where("draft_snapshots.workspace_id = :workspaceId", { workspaceId })
      .andWhere("draft_snapshots.user_id = :userId", { userId })
      .andWhere("draft_snapshots.draft_key = :draftKey", { draftKey });

    this.logger.log(
      `DEBUG-TRACE [B] DB: DraftSnapshotEntity.findOne | ` +
        `filters=${JSON.stringify(where)} | ` +
        `sql=${queryTrace.getSql()} | ` +
        `params=${JSON.stringify(queryTrace.getParameters())}`,
    );

    const row = await this.draftsRepository.findOne({ where });

    if (!row) {
      this.logger.warn(
        `DEBUG-TRACE: No record found matching [${workspaceId}, ${userId}, ${draftKey}]`,
      );
      return null;
    }

    this.logger.log(
      `DEBUG-TRACE [C] raw DB row (pre-serialize): ${JSON.stringify({
        id: row.id,
        workspaceId: row.workspaceId,
        userId: row.userId,
        draftKey: row.draftKey,
        version: row.version,
        lastModified: row.lastModified,
        data: row.data,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })}`,
    );

    return this.toPayload(row);
  }

  async upsertForMember(
    tenantId: string,
    draftKey: string,
    body: DraftSyncPayloadDto,
  ): Promise<DraftSyncPayloadResponse> {
    const { workspaceId, userId } = this.resolveScopeOrThrow(tenantId);

    return this.draftsRepository.manager.transaction(async (manager) => {
      const existing = await manager.findOne(DraftSnapshotEntity, {
        where: { workspaceId, userId, draftKey },
      });

      if (!existing) {
        const saved = await manager.save(
          manager.create(DraftSnapshotEntity, {
            workspaceId,
            userId,
            draftKey,
            data: body.data,
            version: 1,
            lastModified: String(body.lastModified),
          }),
        );
        return this.toPayload(saved);
      }

      const storedVersion = Number(existing.version);
      const clientVersion = Number(body.version);
      if (
        !Number.isFinite(storedVersion) ||
        !Number.isFinite(clientVersion) ||
        storedVersion !== clientVersion
      ) {
        throw new DraftConflictException(this.toPayload(existing));
      }

      const nextVersion = storedVersion + 1;
      const lastModified = Date.now();
      const updateResult = await manager.update(
        DraftSnapshotEntity,
        { id: existing.id, version: storedVersion },
        {
          data: body.data,
          version: nextVersion,
          lastModified: String(lastModified),
        } as Parameters<Repository<DraftSnapshotEntity>["update"]>[1],
      );

      if (updateResult.affected !== 1) {
        const fresh = await manager.findOne(DraftSnapshotEntity, {
          where: { workspaceId, userId, draftKey },
        });
        throw new DraftConflictException(this.toPayload(fresh ?? existing));
      }

      return {
        data: body.data,
        version: nextVersion,
        lastModified,
      };
    });
  }

  async deleteForMember(tenantId: string, draftKey: string): Promise<void> {
    const { workspaceId, userId } = this.resolveScopeOrThrow(tenantId);
    const result = await this.draftsRepository.delete({ workspaceId, userId, draftKey });
    if (result.affected === 0) {
      throw new NotFoundException({
        error: {
          code: "DRAFT_NOT_FOUND",
          message: "Draft not found",
        },
      });
    }
  }
}
