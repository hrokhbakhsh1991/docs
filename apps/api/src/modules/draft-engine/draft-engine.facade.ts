import { Injectable, Logger } from "@nestjs/common";
import {
  CURRENT_DRAFT_SCHEMA_VERSION,
  draftSnapshotEnvelopeSchema,
  type DraftSnapshot,
} from "@repo/shared-contracts";

import type { DraftSyncPayloadDto } from "./dto/draft-sync-payload.dto";
import {
  isDraftEngineV2Enabled,
  shouldPersistDraftSchemaMigrationOnRead,
} from "./draft-engine-feature-flags";
import { AUDIT_CATEGORY } from "../../common/audit/audit-category";
import { AuditLogService } from "../../common/audit/audit-log.service";
import { DraftScopeResolver } from "./storage/draft-scope.resolver";
import { PostgresDraftSnapshotStore } from "./storage/postgres-draft-snapshot.store";
import { DraftMigratorRegistry } from "@repo/shared-contracts";
import { DraftConflictException } from "./draft-conflict.exception";

export type DraftSyncPayloadResponse = DraftSnapshot;

@Injectable()
export class DraftEngineFacade {
  private readonly logger = new Logger(DraftEngineFacade.name);

  constructor(
    private readonly store: PostgresDraftSnapshotStore,
    private readonly scopeResolver: DraftScopeResolver,
    private readonly migratorRegistry: DraftMigratorRegistry,
    private readonly auditLog: AuditLogService,
  ) {}

  private dtoToSnapshot(body: DraftSyncPayloadDto): DraftSnapshot {
    const schemaVersion = Number(body.schemaVersion);
    return {
      data: body.data,
      version: Number(body.version),
      schemaVersion:
        Number.isFinite(schemaVersion) && schemaVersion >= 1
          ? Math.floor(schemaVersion)
          : CURRENT_DRAFT_SCHEMA_VERSION,
      lastModified: Number(body.lastModified),
    };
  }

  private validateEnvelope(snapshot: DraftSnapshot): DraftSnapshot {
    const parsed = draftSnapshotEnvelopeSchema.safeParse(snapshot);
    if (!parsed.success) {
      this.logger.warn(`draft envelope validation failed: ${parsed.error.message}`);
    }
    return snapshot;
  }

  /** MAP alias: load draft for current member (with optional schema migration). */
  async loadDraft(
    tenantId: string,
    draftKey: string,
  ): Promise<DraftSyncPayloadResponse | null> {
    return this.findForMember(tenantId, draftKey);
  }

  async findForMember(
    tenantId: string,
    draftKey: string,
  ): Promise<DraftSyncPayloadResponse | null> {
    const scope = this.scopeResolver.resolveOrThrow(tenantId, draftKey);
    const raw = await this.store.find(scope);
    if (raw == null) {
      return null;
    }

    if (!isDraftEngineV2Enabled()) {
      return raw;
    }

    const { snapshot, upgraded } = this.migratorRegistry.migrateEnvelope(draftKey, raw);
    if (!upgraded) {
      return snapshot;
    }

    if (shouldPersistDraftSchemaMigrationOnRead()) {
      const persisted = await this.store.upgradeSchemaInPlace(scope, {
        data: snapshot.data,
        schemaVersion: snapshot.schemaVersion,
        version: snapshot.version,
      });
      return persisted ?? snapshot;
    }

    return snapshot;
  }

  /** MAP alias: upsert draft for current member. */
  async saveDraft(
    tenantId: string,
    draftKey: string,
    body: DraftSyncPayloadDto,
  ): Promise<DraftSyncPayloadResponse> {
    return this.upsertForMember(tenantId, draftKey, body);
  }

  async upsertForMember(
    tenantId: string,
    draftKey: string,
    body: DraftSyncPayloadDto,
  ): Promise<DraftSyncPayloadResponse> {
    const scope = this.scopeResolver.resolveOrThrow(tenantId, draftKey);
    const snapshot = this.validateEnvelope(this.dtoToSnapshot(body));
    const payload = isDraftEngineV2Enabled()
      ? this.migratorRegistry.migrateEnvelope(draftKey, snapshot).snapshot
      : snapshot;
    let saved: DraftSyncPayloadResponse;
    try {
      saved = await this.store.upsert(scope, payload);
    } catch (error: unknown) {
      if (error instanceof DraftConflictException) {
        const details = (error.getResponse() as { error?: { details?: { server?: DraftSnapshot } } }).error
          ?.details;
        await this.auditLog.logEvent({
          action: "draft_engine.conflict",
          entity: "draft_snapshot",
          entityId: `${scope.workspaceId}:${scope.userId}:${scope.draftKey}`,
          category: AUDIT_CATEGORY.DRAFT_ENGINE_EVENT,
          before: {
            incomingVersion: payload.version,
            incomingSchemaVersion: payload.schemaVersion,
            draftKey: scope.draftKey,
          },
          after: {
            serverVersion: details?.server?.version ?? null,
            serverSchemaVersion: details?.server?.schemaVersion ?? null,
          },
        });
      }
      throw error;
    }
    await this.auditLog.logEvent({
      action: "draft_engine.upsert",
      entity: "draft_snapshot",
      entityId: `${scope.workspaceId}:${scope.userId}:${scope.draftKey}`,
      category: AUDIT_CATEGORY.DRAFT_ENGINE_EVENT,
      before: {
        incomingVersion: payload.version,
        incomingSchemaVersion: payload.schemaVersion,
      },
      after: {
        savedVersion: saved.version,
        savedSchemaVersion: saved.schemaVersion,
      },
    });
    return saved;
  }

  /** MAP alias: delete draft for current member. */
  async deleteDraft(tenantId: string, draftKey: string): Promise<void> {
    return this.deleteForMember(tenantId, draftKey);
  }

  async deleteForMember(tenantId: string, draftKey: string): Promise<void> {
    const scope = this.scopeResolver.resolveOrThrow(tenantId, draftKey);
    await this.store.delete(scope);
    await this.auditLog.logEvent({
      action: "draft_engine.delete",
      entity: "draft_snapshot",
      entityId: `${scope.workspaceId}:${scope.userId}:${scope.draftKey}`,
      category: AUDIT_CATEGORY.DRAFT_ENGINE_EVENT,
      after: { deleted: true },
    });
  }
}
