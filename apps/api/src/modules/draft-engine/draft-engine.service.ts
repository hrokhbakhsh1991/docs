import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";

import { authRequiredError } from "../../common/errors/error-response-builders";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { DraftSnapshotEntity } from "./entities/draft-snapshot.entity";
import type { DraftSyncPayloadDto } from "./dto/draft-sync-payload.dto";

export type DraftSyncPayloadResponse = {
  data: Record<string, unknown>;
  version: number;
  lastModified: number;
};

@Injectable()
export class DraftEngineService {
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
      version: row.version,
      lastModified: Number(row.lastModified),
    };
  }

  async findForMember(tenantId: string, draftKey: string): Promise<DraftSyncPayloadResponse | null> {
    const { workspaceId, userId } = this.resolveScopeOrThrow(tenantId);
    const row = await this.draftsRepository.findOne({
      where: { workspaceId, userId, draftKey },
    });
    if (!row) {
      return null;
    }
    return this.toPayload(row);
  }

  async upsertForMember(
    tenantId: string,
    draftKey: string,
    body: DraftSyncPayloadDto,
  ): Promise<DraftSyncPayloadResponse> {
    const { workspaceId, userId } = this.resolveScopeOrThrow(tenantId);
    const existing = await this.draftsRepository.findOne({
      where: { workspaceId, userId, draftKey },
    });

    if (!existing) {
      const created = this.draftsRepository.create({
        workspaceId,
        userId,
        draftKey,
        data: body.data,
        version: 1,
        lastModified: String(body.lastModified),
      });
      const saved = await this.draftsRepository.save(created);
      return this.toPayload(saved);
    }

    if (existing.version !== body.version) {
      throw new ConflictException({
        error: {
          code: "DRAFT_CONFLICT",
          message: "Stale draft version",
        },
        server: this.toPayload(existing),
      });
    }

    existing.data = body.data;
    existing.version = existing.version + 1;
    existing.lastModified = String(body.lastModified);
    const saved = await this.draftsRepository.save(existing);
    return this.toPayload(saved);
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
