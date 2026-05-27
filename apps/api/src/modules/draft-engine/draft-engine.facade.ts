import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  CURRENT_DRAFT_SCHEMA_VERSION,
  draftSnapshotEnvelopeSchema,
  type DraftSnapshot,
} from "@repo/shared-contracts";
import { Repository } from "typeorm";

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
import { DraftEventEntity } from "./entities/draft-event.entity";
import { tryGetActiveTraceLogFields } from "../../common/observability/active-trace-log-fields";
import { RequestContextService } from "../../common/request-context/request-context.service";

export type DraftSyncPayloadResponse = DraftSnapshot;

@Injectable()
export class DraftEngineFacade {
  private readonly logger = new Logger(DraftEngineFacade.name);
  private static readonly DENALI_CREATE_DRAFT_KEY = "denali-create";

  constructor(
    private readonly store: PostgresDraftSnapshotStore,
    private readonly scopeResolver: DraftScopeResolver,
    private readonly migratorRegistry: DraftMigratorRegistry,
    private readonly auditLog: AuditLogService,
    @InjectRepository(DraftEventEntity)
    private readonly draftEventsRepository: Repository<DraftEventEntity>,
    private readonly requestContext: RequestContextService,
  ) {}

  private resolveTraceId(): string | null {
    const otelTraceId = tryGetActiveTraceLogFields()?.trace_id?.trim();
    if (otelTraceId) {
      return otelTraceId;
    }
    const traceId = this.requestContext.tryGetCorrelationId() ?? this.requestContext.tryGetRequestId();
    if (!traceId || traceId.trim() === "") {
      return null;
    }
    return traceId.trim();
  }

  private async logDraftEvent(input: {
    workspaceId: string;
    userId: string;
    draftKey: string;
    eventType: DraftEventEntity["eventType"];
    baseVersion: number | null;
    nextVersion: number | null;
    payloadSnapshot: Record<string, unknown>;
  }): Promise<void> {
    await this.draftEventsRepository.insert({
      workspaceId: input.workspaceId,
      userId: input.userId,
      draftKey: input.draftKey,
      eventType: input.eventType,
      traceId: this.resolveTraceId(),
      baseVersion: input.baseVersion,
      nextVersion: input.nextVersion,
      payloadSnapshot: input.payloadSnapshot as never,
    });
  }

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

  private readStringPath(record: Record<string, unknown>, path: readonly string[]): string {
    let node: unknown = record;
    for (const segment of path) {
      if (!node || typeof node !== "object" || Array.isArray(node)) {
        return "";
      }
      node = (node as Record<string, unknown>)[segment];
    }
    return typeof node === "string" ? node.trim() : "";
  }

  private hasMeaningfulDenaliFormData(value: unknown): boolean {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const record = value as Record<string, unknown>;
    const keyPaths: ReadonlyArray<readonly string[]> = [
      ["basicInfo", "title"],
      ["basicInfo", "tourType"],
      ["basicInfo", "destinationId"],
      ["timing", "startDate"],
      ["timing", "endDate"],
    ];
    return keyPaths.some((path) => this.readStringPath(record, path).length > 0);
  }

  private isEffectivelyEmptyDraft(draftKey: string, snapshot: DraftSnapshot): boolean {
    if (draftKey !== DraftEngineFacade.DENALI_CREATE_DRAFT_KEY) {
      return false;
    }
    const data = snapshot.data as { form?: unknown; currentStepIndex?: unknown };
    const stepIndex = typeof data.currentStepIndex === "number" ? data.currentStepIndex : 0;
    const hasMeaningfulForm = this.hasMeaningfulDenaliFormData(data.form);
    return stepIndex <= 0 && !hasMeaningfulForm;
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
      return this.isEffectivelyEmptyDraft(draftKey, raw) ? null : raw;
    }

    const { snapshot, upgraded } = this.migratorRegistry.migrateEnvelope(draftKey, raw);
    if (!upgraded) {
      return this.isEffectivelyEmptyDraft(draftKey, snapshot) ? null : snapshot;
    }

    if (shouldPersistDraftSchemaMigrationOnRead()) {
      const persisted = await this.store.upgradeSchemaInPlace(scope, {
        data: snapshot.data,
        schemaVersion: snapshot.schemaVersion,
        version: snapshot.version,
      });
      const effective = persisted ?? snapshot;
      return this.isEffectivelyEmptyDraft(draftKey, effective) ? null : effective;
    }

    return this.isEffectivelyEmptyDraft(draftKey, snapshot) ? null : snapshot;
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
        await this.logDraftEvent({
          workspaceId: scope.workspaceId,
          userId: scope.userId,
          draftKey: scope.draftKey,
          eventType: "draft_conflict",
          baseVersion: payload.version,
          nextVersion: details?.server?.version ?? null,
          payloadSnapshot: payload.data,
        });
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
    await this.logDraftEvent({
      workspaceId: scope.workspaceId,
      userId: scope.userId,
      draftKey: scope.draftKey,
      eventType: "draft_saved",
      baseVersion: payload.version,
      nextVersion: saved.version,
      payloadSnapshot: saved.data,
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
    await this.logDraftEvent({
      workspaceId: scope.workspaceId,
      userId: scope.userId,
      draftKey: scope.draftKey,
      eventType: "draft_deleted",
      baseVersion: null,
      nextVersion: null,
      payloadSnapshot: {},
    });
  }
}
