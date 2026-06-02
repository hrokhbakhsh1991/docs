import { Inject, Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { AUDIT_CATEGORY } from "./audit-category";
import { RequestContextService } from "../request-context/request-context.service";
import { TenantAuditEventsService } from "./tenant-audit-events.service";

export type FinancialOutboxAuditInput = {
  tenantId: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  /** Outbox payload (already includes `correlation_id` after enqueue enrichment). */
  payload: Record<string, unknown>;
  /** Explicit correlation id when known (otherwise ALS / payload). */
  correlationId?: string | null;
  /**
   * Optional domain snapshots for traceability (e.g. payment row before/after `save`).
   * When omitted, audit still records `state_after` from payload for outbox-only transitions.
   */
  financialAudit?: {
    stateBefore: Record<string, unknown> | null;
    stateAfter: Record<string, unknown> | null;
  } | null;
};

/**
 * **Transactional financial audit** — append-only `tenant_audit_events` rows that mirror financial outbox
 * writes with actor, tenant, correlation id, and before/after state snapshots.
 *
 * Uses {@link TenantAuditEventsService.append} (not `appendOrWarn`) so audit failure **rolls back** the
 * same DB transaction as the outbox insert when wired through the caller’s `EntityManager`.
 */
@Injectable()
export class FinancialMutationAuditService {
  constructor(
    @Inject(TenantAuditEventsService) private readonly tenantAudit: TenantAuditEventsService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService
  ) {}

  async recordOutboxFinancialMutation(
    manager: EntityManager,
    input: FinancialOutboxAuditInput
  ): Promise<void> {
    const tenantId = input.tenantId.trim().toLowerCase();
    const actorUserId = this.requestContext.tryGetUserId() ?? null;
    const correlationFromPayload =
      typeof input.payload.correlation_id === "string" ? input.payload.correlation_id.trim() : "";
    const correlation =
      (input.correlationId?.trim() || "") !== ""
        ? input.correlationId!.trim()
        : correlationFromPayload !== ""
          ? correlationFromPayload
          : this.requestContext.tryGetCorrelationId() ??
            this.requestContext.tryGetRequestId() ??
            "unknown";

    const explicit = input.financialAudit;
    const stateBefore = explicit?.stateBefore ?? null;
    const stateAfter = explicit?.stateAfter ?? input.payload;

    const action = `financial.outbox:${input.eventType}`.slice(0, 96);

    await this.tenantAudit.append(
      {
        tenantId,
        actorUserId,
        actor: actorUserId ?? "system",
        userId: null,
        action,
        resourceType: input.aggregateType.trim().slice(0, 96),
        resourceId: input.aggregateId.trim().slice(0, 128),
        metadata: {
          audit_category: AUDIT_CATEGORY.FINANCE,
          correlation_id: correlation,
          event_type: input.eventType,
          aggregate_type: input.aggregateType,
          aggregate_id: input.aggregateId,
          state_before: stateBefore,
          state_after: stateAfter
        },
        clientIp: this.requestContext.tryGetClientIp() ?? "unknown",
        requestId: correlation.slice(0, 128)
      },
      manager
    );
  }
}
