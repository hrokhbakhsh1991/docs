import { Injectable, Logger, NotFoundException, Optional } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  CURRENT_DRAFT_SCHEMA_VERSION,
  type DraftScope,
  type DraftSnapshot,
  type DraftStoragePort,
} from "@repo/shared-contracts";
import { Repository } from "typeorm";

import { tryGetActiveTraceLogFields } from "../../../common/observability/active-trace-log-fields";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { DraftConflictException } from "../draft-conflict.exception";
import { DraftSnapshotEntity } from "../entities/draft-snapshot.entity";

@Injectable()
export class PostgresDraftSnapshotStore implements DraftStoragePort {
  private readonly logger = new Logger(PostgresDraftSnapshotStore.name);

  constructor(
    @InjectRepository(DraftSnapshotEntity)
    private readonly draftsRepository: Repository<DraftSnapshotEntity>,
    @Optional()
    private readonly requestContext?: RequestContextService,
  ) {}

  private resolveTraceId(): string | null {
    const otelTraceId = tryGetActiveTraceLogFields()?.trace_id?.trim();
    if (otelTraceId) {
      return otelTraceId;
    }
    const traceId =
      this.requestContext?.tryGetCorrelationId() ?? this.requestContext?.tryGetRequestId();
    if (!traceId || traceId.trim() === "") {
      return null;
    }
    return traceId.trim();
  }

  private toSnapshot(row: DraftSnapshotEntity): DraftSnapshot {
    return {
      data: row.data,
      version: Number(row.version),
      schemaVersion: Number(row.schemaVersion ?? CURRENT_DRAFT_SCHEMA_VERSION),
      lastModified: Number(row.lastModified),
    };
  }

  async find(scope: DraftScope): Promise<DraftSnapshot | null> {
    const where = {
      workspaceId: scope.workspaceId,
      userId: scope.userId,
      draftKey: scope.draftKey,
    };

    const queryTrace = this.draftsRepository
      .createQueryBuilder("draft_snapshots")
      .where("draft_snapshots.workspace_id = :workspaceId", { workspaceId: scope.workspaceId })
      .andWhere("draft_snapshots.user_id = :userId", { userId: scope.userId })
      .andWhere("draft_snapshots.draft_key = :draftKey", { draftKey: scope.draftKey });

    this.logger.log(
      `DEBUG-TRACE [B] DB: DraftSnapshotEntity.findOne | ` +
        `filters=${JSON.stringify(where)} | ` +
        `sql=${queryTrace.getSql()} | ` +
        `params=${JSON.stringify(queryTrace.getParameters())}`,
    );

    const row = await this.draftsRepository.findOne({ where });

    if (!row) {
      this.logger.warn(
        `DEBUG-TRACE: No record found matching [${scope.workspaceId}, ${scope.userId}, ${scope.draftKey}]`,
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
        schemaVersion: row.schemaVersion,
        lastModified: row.lastModified,
      })}`,
    );

    return this.toSnapshot(row);
  }

  async upsert(scope: DraftScope, snapshot: DraftSnapshot): Promise<DraftSnapshot> {
    const clientVersion = Number(snapshot.version);
    const schemaVersion = Number(snapshot.schemaVersion) || CURRENT_DRAFT_SCHEMA_VERSION;

    if (!Number.isFinite(clientVersion) || clientVersion < 0) {
      throw new DraftConflictException({
        data: snapshot.data,
        version: 0,
        schemaVersion,
        lastModified: Number(snapshot.lastModified) || Date.now(),
      });
    }

    return this.draftsRepository.manager.transaction(async (manager) => {
      const existing = await manager.findOne(DraftSnapshotEntity, {
        where: {
          workspaceId: scope.workspaceId,
          userId: scope.userId,
          draftKey: scope.draftKey,
        },
      });

      if (!existing) {
        if (clientVersion !== 0) {
          throw new DraftConflictException({
            data: snapshot.data,
            version: 0,
            schemaVersion,
            lastModified: Number(snapshot.lastModified) || Date.now(),
          });
        }

        const saved = await manager.save(
          manager.create(DraftSnapshotEntity, {
            workspaceId: scope.workspaceId,
            userId: scope.userId,
            draftKey: scope.draftKey,
            data: snapshot.data,
            version: 1,
            schemaVersion,
            lastModified: String(snapshot.lastModified),
            traceId: this.resolveTraceId(),
          }),
        );
        return this.toSnapshot(saved);
      }

      const storedVersion = Number(existing.version);
      if (!Number.isFinite(storedVersion) || storedVersion !== clientVersion) {
        throw new DraftConflictException(this.toSnapshot(existing));
      }

      const nextVersion = storedVersion + 1;
      const lastModified = Date.now();
      const updateResult = await manager.update(
        DraftSnapshotEntity,
        { id: existing.id, version: storedVersion },
        {
          data: snapshot.data,
          version: nextVersion,
          schemaVersion,
          lastModified: String(lastModified),
          traceId: this.resolveTraceId(),
        } as Parameters<Repository<DraftSnapshotEntity>["update"]>[1],
      );

      if (updateResult.affected !== 1) {
        const fresh = await manager.findOne(DraftSnapshotEntity, {
          where: {
            workspaceId: scope.workspaceId,
            userId: scope.userId,
            draftKey: scope.draftKey,
          },
        });
        throw new DraftConflictException(this.toSnapshot(fresh ?? existing));
      }

      return {
        data: snapshot.data,
        version: nextVersion,
        schemaVersion,
        lastModified,
      };
    });
  }

  async upgradeSchemaInPlace(
    scope: DraftScope,
    input: Pick<DraftSnapshot, "data" | "schemaVersion" | "version">,
  ): Promise<DraftSnapshot | null> {
    const updateResult = await this.draftsRepository.update(
      {
        workspaceId: scope.workspaceId,
        userId: scope.userId,
        draftKey: scope.draftKey,
        version: input.version,
      },
      {
        data: input.data,
        schemaVersion: input.schemaVersion,
        traceId: this.resolveTraceId(),
      } as Parameters<Repository<DraftSnapshotEntity>["update"]>[1],
    );

    if ((updateResult.affected ?? 0) !== 1) {
      return null;
    }

    return this.find(scope);
  }

  async delete(scope: DraftScope): Promise<void> {
    const result = await this.draftsRepository.delete({
      workspaceId: scope.workspaceId,
      userId: scope.userId,
      draftKey: scope.draftKey,
    });
    if ((result.affected ?? 0) === 0) {
      throw new NotFoundException({
        error: {
          code: "DRAFT_NOT_FOUND",
          message: "Draft not found",
        },
      });
    }
  }
}
