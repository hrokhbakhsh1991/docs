import { Injectable, Logger, HttpException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  CURRENT_DRAFT_SCHEMA_VERSION,
  draftSnapshotEnvelopeSchema,
  type DraftSnapshot,
} from "@repo/shared-contracts";
import { Repository } from "typeorm";
import { randomUUID } from "node:crypto";

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
import { DraftForensicException } from "./draft-forensic.exception";
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

  private getDebugContextFields(draftKey?: string) {
    let context: any = {};
    try {
      if (this.requestContext && typeof this.requestContext.getContext === "function") {
        context = this.requestContext.getContext() || {};
      }
    } catch {}

    const correlationId = context.correlationId ?? 
      (this.requestContext && typeof this.requestContext.tryGetCorrelationId === "function" ? this.requestContext.tryGetCorrelationId() : undefined) ?? 
      "N/A";
    const tenantId = context.tenantId ?? 
      (this.requestContext && typeof this.requestContext.tryGetTenantId === "function" ? this.requestContext.tryGetTenantId() : undefined) ?? 
      "N/A";
    const hostTenantId = context.hostTenantId ?? 
      (this.requestContext && typeof this.requestContext.tryGetHostTenantId === "function" ? this.requestContext.tryGetHostTenantId() : undefined) ?? 
      "N/A";
    const userId = context.userId ?? 
      (this.requestContext && typeof this.requestContext.tryGetUserId === "function" ? this.requestContext.tryGetUserId() : undefined) ?? 
      "N/A";
    const role = context.role ?? 
      (this.requestContext && typeof this.requestContext.tryGetRole === "function" ? this.requestContext.tryGetRole() : undefined) ?? 
      "N/A";

    return {
      correlationId,
      requestId: context.requestId ?? 
        (this.requestContext && typeof this.requestContext.tryGetRequestId === "function" ? this.requestContext.tryGetRequestId() : undefined) ?? 
        "N/A",
      tenantId,
      hostTenantId,
      userId,
      role,
      tenantContextFrozen: context.tenantContextFrozen,
      tenantBindingMode: context.tenantBindingMode,
      draftKey,
    };
  }

  private ensureCorrelationId(): string {
    let context: any = null;
    try {
      if (this.requestContext && typeof this.requestContext.getContext === "function") {
        context = this.requestContext.getContext();
      }
    } catch {}
    
    if (context) {
      if (!context.correlationId) {
        context.correlationId = randomUUID();
      }
      return context.correlationId;
    }
    
    return (this.requestContext && typeof this.requestContext.tryGetCorrelationId === "function" ? this.requestContext.tryGetCorrelationId() : undefined) ?? randomUUID();
  }

  private resolveTraceId(): string | null {
    const otelTraceId = tryGetActiveTraceLogFields()?.trace_id?.trim();
    if (otelTraceId) {
      return otelTraceId;
    }
    const traceId = (this.requestContext && typeof this.requestContext.tryGetCorrelationId === "function" ? this.requestContext.tryGetCorrelationId() : undefined) ?? 
      (this.requestContext && typeof this.requestContext.tryGetRequestId === "function" ? this.requestContext.tryGetRequestId() : undefined);
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
    const correlationId = this.ensureCorrelationId();
    const ctx = this.getDebugContextFields(input.draftKey);
    this.logger.log(
      `[DRAFT-FORENSIC] [correlationId: ${correlationId}] logDraftEvent: entering method. Context: ${JSON.stringify(ctx)}`,
    );

    // Tenant Isolation Check: Verify if active tenantId matches parameter workspaceId
    if (ctx.tenantId !== "N/A" && ctx.tenantId.toLowerCase() !== input.workspaceId.trim().toLowerCase()) {
      const errorMsg = `Tenant isolation mismatch in event logging! Active context tenantId (${ctx.tenantId}) does not match workspaceId (${input.workspaceId})`;
      this.logger.error(`[DRAFT-FORENSIC] [correlationId: ${correlationId}] [CRITICAL] ${errorMsg}`);
      throw new DraftForensicException(errorMsg, null, ctx);
    }

    try {
      this.logger.log(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] logDraftEvent: pre-await draftEventsRepository.insert. Context: ${JSON.stringify(this.getDebugContextFields(input.draftKey))}`,
      );
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
      this.logger.log(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] logDraftEvent: post-await draftEventsRepository.insert success.`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] logDraftEvent: failed. Context: ${JSON.stringify(this.getDebugContextFields(input.draftKey))}`,
        err instanceof Error ? err.stack : String(err),
      );
      if (err instanceof HttpException) {
        throw err;
      }
      throw new DraftForensicException("Failed to log draft event", err, this.getDebugContextFields(input.draftKey));
    }
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
    const correlationId = this.ensureCorrelationId();
    const ctx = this.getDebugContextFields(draftKey);
    this.logger.log(
      `[DRAFT-FORENSIC] [correlationId: ${correlationId}] loadDraft: entering method. Context: ${JSON.stringify(ctx)}`,
    );
    try {
      this.logger.log(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] loadDraft: pre-await findForMember. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
      );
      const res = await this.findForMember(tenantId, draftKey);
      this.logger.log(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] loadDraft: post-await findForMember success.`,
      );
      return res;
    } catch (err: unknown) {
      this.logger.error(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] loadDraft: failed. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
        err instanceof Error ? err.stack : String(err),
      );
      if (err instanceof HttpException) {
        throw err;
      }
      throw new DraftForensicException("Failed to load draft", err, this.getDebugContextFields(draftKey));
    }
  }

  async findForMember(
    tenantId: string,
    draftKey: string,
  ): Promise<DraftSyncPayloadResponse | null> {
    const correlationId = this.ensureCorrelationId();
    const ctx = this.getDebugContextFields(draftKey);
    this.logger.log(
      `[DRAFT-FORENSIC] [correlationId: ${correlationId}] findForMember: entering method with tenantId=${tenantId}, draftKey=${draftKey}. Context: ${JSON.stringify(ctx)}`,
    );

    // Tenant Isolation Check: Verify if active tenantId matches parameter tenantId
    if (ctx.tenantId !== "N/A" && ctx.tenantId.toLowerCase() !== tenantId.trim().toLowerCase()) {
      const errorMsg = `Tenant isolation mismatch! Active context tenantId (${ctx.tenantId}) does not match param tenantId (${tenantId})`;
      this.logger.error(`[DRAFT-FORENSIC] [correlationId: ${correlationId}] [CRITICAL] ${errorMsg}`);
      throw new DraftForensicException(errorMsg, null, ctx);
    }

    try {
      this.logger.log(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] findForMember: pre-await scopeResolver.resolveOrThrow. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
      );
      const scope = this.scopeResolver.resolveOrThrow(tenantId, draftKey);

      this.logger.log(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] findForMember: pre-await store.find. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
      );
      const raw = await this.store.find(scope);
      if (raw == null) {
        this.logger.log(
          `[DRAFT-FORENSIC] [correlationId: ${correlationId}] findForMember: no draft found.`,
        );
        return null;
      }

      if (!isDraftEngineV2Enabled()) {
        const isEmpty = this.isEffectivelyEmptyDraft(draftKey, raw);
        this.logger.log(
          `[DRAFT-FORENSIC] [correlationId: ${correlationId}] findForMember: V2 disabled. isEmpty=${isEmpty}`,
        );
        return isEmpty ? null : raw;
      }

      const { snapshot, upgraded } = this.migratorRegistry.migrateEnvelope(draftKey, raw);
      if (!upgraded) {
        const isEmpty = this.isEffectivelyEmptyDraft(draftKey, snapshot);
        this.logger.log(
          `[DRAFT-FORENSIC] [correlationId: ${correlationId}] findForMember: migrated, not upgraded. isEmpty=${isEmpty}`,
        );
        return isEmpty ? null : snapshot;
      }

      if (shouldPersistDraftSchemaMigrationOnRead()) {
        this.logger.log(
          `[DRAFT-FORENSIC] [correlationId: ${correlationId}] findForMember: pre-await store.upgradeSchemaInPlace. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
        );
        const persisted = await this.store.upgradeSchemaInPlace(scope, {
          data: snapshot.data,
          schemaVersion: snapshot.schemaVersion,
          version: snapshot.version,
        });
        const effective = persisted ?? snapshot;
        const isEmpty = this.isEffectivelyEmptyDraft(draftKey, effective);
        this.logger.log(
          `[DRAFT-FORENSIC] [correlationId: ${correlationId}] findForMember: persisted schema upgrade. isEmpty=${isEmpty}`,
        );
        return isEmpty ? null : effective;
      }

      const isEmpty = this.isEffectivelyEmptyDraft(draftKey, snapshot);
      this.logger.log(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] findForMember: return migrated snapshot. isEmpty=${isEmpty}`,
      );
      return isEmpty ? null : snapshot;
    } catch (err: unknown) {
      this.logger.error(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] findForMember: failed. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
        err instanceof Error ? err.stack : String(err),
      );
      if (err instanceof HttpException) {
        throw err;
      }
      throw new DraftForensicException("Failed to find draft", err, this.getDebugContextFields(draftKey));
    }
  }

  /** MAP alias: upsert draft for current member. */
  async saveDraft(
    tenantId: string,
    draftKey: string,
    body: DraftSyncPayloadDto,
  ): Promise<DraftSyncPayloadResponse> {
    const correlationId = this.ensureCorrelationId();
    const ctx = this.getDebugContextFields(draftKey);
    this.logger.log(
      `[DRAFT-FORENSIC] [correlationId: ${correlationId}] saveDraft: entering method. Context: ${JSON.stringify(ctx)}`,
    );
    try {
      this.logger.log(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] saveDraft: pre-await upsertForMember. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
      );
      const res = await this.upsertForMember(tenantId, draftKey, body);
      this.logger.log(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] saveDraft: post-await upsertForMember success.`,
      );
      return res;
    } catch (err: unknown) {
      this.logger.error(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] saveDraft: failed. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
        err instanceof Error ? err.stack : String(err),
      );
      if (err instanceof HttpException) {
        throw err;
      }
      throw new DraftForensicException("Failed to save draft", err, this.getDebugContextFields(draftKey));
    }
  }

  async upsertForMember(
    tenantId: string,
    draftKey: string,
    body: DraftSyncPayloadDto,
  ): Promise<DraftSyncPayloadResponse> {
    const correlationId = this.ensureCorrelationId();
    const ctx = this.getDebugContextFields(draftKey);
    this.logger.log(
      `[DRAFT-FORENSIC] [correlationId: ${correlationId}] upsertForMember: entering method. Context: ${JSON.stringify(ctx)}`,
    );

    // Tenant Isolation Check: Verify if active tenantId matches parameter tenantId
    if (ctx.tenantId !== "N/A" && ctx.tenantId.toLowerCase() !== tenantId.trim().toLowerCase()) {
      const errorMsg = `Tenant isolation mismatch! Active context tenantId (${ctx.tenantId}) does not match param tenantId (${tenantId})`;
      this.logger.error(`[DRAFT-FORENSIC] [correlationId: ${correlationId}] [CRITICAL] ${errorMsg}`);
      throw new DraftForensicException(errorMsg, null, ctx);
    }

    try {
      this.logger.log(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] upsertForMember: pre-await scopeResolver.resolveOrThrow. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
      );
      const scope = this.scopeResolver.resolveOrThrow(tenantId, draftKey);
      const snapshot = this.validateEnvelope(this.dtoToSnapshot(body));
      const payload = isDraftEngineV2Enabled()
        ? this.migratorRegistry.migrateEnvelope(draftKey, snapshot).snapshot
        : snapshot;
      let saved: DraftSyncPayloadResponse;
      try {
        this.logger.log(
          `[DRAFT-FORENSIC] [correlationId: ${correlationId}] upsertForMember: pre-await store.upsert. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
        );
        saved = await this.store.upsert(scope, payload);
      } catch (error: unknown) {
        if (error instanceof DraftConflictException) {
          const details = (error.getResponse() as { error?: { details?: { server?: DraftSnapshot } } }).error
            ?.details;
          try {
            this.logger.log(
              `[DRAFT-FORENSIC] [correlationId: ${correlationId}] upsertForMember: conflict detected. pre-await logDraftEvent. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
            );
            await this.logDraftEvent({
              workspaceId: scope.workspaceId,
              userId: scope.userId,
              draftKey: scope.draftKey,
              eventType: "draft_conflict",
              baseVersion: payload.version,
              nextVersion: details?.server?.version ?? null,
              payloadSnapshot: payload.data,
            });
          } catch (logErr) {
            this.logger.warn(
              `[DRAFT-FORENSIC] [correlationId: ${correlationId}] draft event log failed for conflict: ${
                logErr instanceof Error ? logErr.message : String(logErr)
              }`,
            );
          }

          this.logger.log(
            `[DRAFT-FORENSIC] [correlationId: ${correlationId}] upsertForMember: pre-await auditLog.logEvent for conflict. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
          );
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

      this.logger.log(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] upsertForMember: pre-await auditLog.logEvent for success. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
      );
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

      try {
        this.logger.log(
          `[DRAFT-FORENSIC] [correlationId: ${correlationId}] upsertForMember: pre-await logDraftEvent for success. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
        );
        await this.logDraftEvent({
          workspaceId: scope.workspaceId,
          userId: scope.userId,
          draftKey: scope.draftKey,
          eventType: "draft_saved",
          baseVersion: payload.version,
          nextVersion: saved.version,
          payloadSnapshot: saved.data,
        });
      } catch (logErr) {
        this.logger.warn(
          `[DRAFT-FORENSIC] [correlationId: ${correlationId}] draft event log failed for save: ${
            logErr instanceof Error ? logErr.message : String(logErr)
          }`,
        );
      }
      return saved;
    } catch (err: unknown) {
      this.logger.error(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] upsertForMember: failed. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
        err instanceof Error ? err.stack : String(err),
      );
      if (err instanceof HttpException) {
        throw err;
      }
      throw new DraftForensicException("Failed to upsert draft", err, this.getDebugContextFields(draftKey));
    }
  }

  /** MAP alias: delete draft for current member. */
  async deleteDraft(tenantId: string, draftKey: string): Promise<void> {
    const correlationId = this.ensureCorrelationId();
    const ctx = this.getDebugContextFields(draftKey);
    this.logger.log(
      `[DRAFT-FORENSIC] [correlationId: ${correlationId}] deleteDraft: entering method. Context: ${JSON.stringify(ctx)}`,
    );
    try {
      this.logger.log(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] deleteDraft: pre-await deleteForMember. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
      );
      await this.deleteForMember(tenantId, draftKey);
      this.logger.log(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] deleteDraft: post-await deleteForMember success.`,
      );
    } catch (err: unknown) {
      this.logger.error(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] deleteDraft: failed. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
        err instanceof Error ? err.stack : String(err),
      );
      if (err instanceof HttpException) {
        throw err;
      }
      throw new DraftForensicException("Failed to delete draft", err, this.getDebugContextFields(draftKey));
    }
  }

  async deleteForMember(tenantId: string, draftKey: string): Promise<void> {
    const correlationId = this.ensureCorrelationId();
    const ctx = this.getDebugContextFields(draftKey);
    this.logger.log(
      `[DRAFT-FORENSIC] [correlationId: ${correlationId}] deleteForMember: entering method. Context: ${JSON.stringify(ctx)}`,
    );

    // Tenant Isolation Check: Verify if active tenantId matches parameter tenantId
    if (ctx.tenantId !== "N/A" && ctx.tenantId.toLowerCase() !== tenantId.trim().toLowerCase()) {
      const errorMsg = `Tenant isolation mismatch! Active context tenantId (${ctx.tenantId}) does not match param tenantId (${tenantId})`;
      this.logger.error(`[DRAFT-FORENSIC] [correlationId: ${correlationId}] [CRITICAL] ${errorMsg}`);
      throw new DraftForensicException(errorMsg, null, ctx);
    }

    try {
      this.logger.log(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] deleteForMember: pre-await scopeResolver.resolveOrThrow. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
      );
      const scope = this.scopeResolver.resolveOrThrow(tenantId, draftKey);

      this.logger.log(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] deleteForMember: pre-await store.delete. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
      );
      await this.store.delete(scope);

      this.logger.log(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] deleteForMember: pre-await auditLog.logEvent. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
      );
      await this.auditLog.logEvent({
        action: "draft_engine.delete",
        entity: "draft_snapshot",
        entityId: `${scope.workspaceId}:${scope.userId}:${scope.draftKey}`,
        category: AUDIT_CATEGORY.DRAFT_ENGINE_EVENT,
        after: { deleted: true },
      });

      try {
        this.logger.log(
          `[DRAFT-FORENSIC] [correlationId: ${correlationId}] deleteForMember: pre-await logDraftEvent. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
        );
        await this.logDraftEvent({
          workspaceId: scope.workspaceId,
          userId: scope.userId,
          draftKey: scope.draftKey,
          eventType: "draft_deleted",
          baseVersion: null,
          nextVersion: null,
          payloadSnapshot: {},
        });
      } catch (logErr) {
        this.logger.warn(
          `[DRAFT-FORENSIC] [correlationId: ${correlationId}] draft event log failed for delete: ${
            logErr instanceof Error ? logErr.message : String(logErr)
          }`,
        );
      }
    } catch (err: unknown) {
      this.logger.error(
        `[DRAFT-FORENSIC] [correlationId: ${correlationId}] deleteForMember: failed. Context: ${JSON.stringify(this.getDebugContextFields(draftKey))}`,
        err instanceof Error ? err.stack : String(err),
      );
      if (err instanceof HttpException) {
        throw err;
      }
      throw new DraftForensicException("Failed to delete draft", err, this.getDebugContextFields(draftKey));
    }
  }
}
