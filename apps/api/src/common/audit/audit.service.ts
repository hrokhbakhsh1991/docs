import { Inject, Injectable } from "@nestjs/common";
import { BOOKING_CREATED_EVENT_TYPE, type BookingCreatedPayload } from "../events/booking-created.event";
import type { OutboxDeliveryEnvelope } from "./outbox-delivery.types";
import { LoggerService } from "../logger/logger.service";
import { RequestContextService } from "../request-context/request-context.service";
import { TenantAuditEventsService } from "./tenant-audit-events.service";
import type { RecordAuditEventInput } from "./audit-record.types";

/**
 * Cross-cutting audit pipeline (structured tenant rows + operational logs).
 *
 * **Append-only & integrity (design):** rows are recorded via {@link TenantAuditEventsService.appendOrWarn}
 * — **no** delete / rewrite APIs on this service. Retention windows, export manifests, and integrity
 * envelopes live in `audit-retention-policy.ts`, `audit-integrity-metadata.ts`, `build-audit-export-manifest.ts`.
 *
 * TODO: Audit explorer (search, drill-down, actor/resource facets) — partially covered by web Audit Trail.
 * TODO: Immutable retention jobs + cold archival (policy-driven; **not** destructive of legal holds).
 */
@Injectable()
export class AuditService {
  constructor(
    @Inject(LoggerService) private readonly loggerService: LoggerService,
    @Inject(RequestContextService) private readonly requestContext: RequestContextService,
    @Inject(TenantAuditEventsService) private readonly tenantAudit: TenantAuditEventsService
  ) {}

  /**
   * Delivery path for transactional outbox. Uses `event_id` (outbox row PK) for trace correlation;
   * consumers must treat redelivery as normal and dedupe on `event_id` and/or domain `eventId` in payload.
   */
  deliverFromOutbox(envelope: OutboxDeliveryEnvelope): void {
    if (envelope.event_type === BOOKING_CREATED_EVENT_TYPE) {
      const enc = envelope.payload?.envelope as
        | {
            eventId?: string;
            eventType?: string;
            schemaVersion?: number;
            tenantId?: string;
            correlationId?: string | null;
            payload?: BookingCreatedPayload;
          }
        | undefined;
      const inner = enc?.payload;
      if (enc?.eventId && inner?.registrationId && inner.tourId) {
        this.loggerService.info("domain_event_booking_created_audit", {
          outbox_event_id: envelope.event_id,
          event_id: enc.eventId,
          event_type: enc.eventType ?? envelope.event_type,
          schema_version: enc.schemaVersion,
          tenant_id: enc.tenantId ?? envelope.tenant_id,
          correlation_id: enc.correlationId,
          registration_id: inner.registrationId,
          tour_id: inner.tourId
        });
        return;
      }
    }

    this.loggerService.info("audit.event.delivered", {
      tenant_id: envelope.tenant_id,
      event_id: envelope.event_id,
      event_type: envelope.event_type,
      created_at: envelope.created_at,
      payload: envelope.payload
    });
  }

  /**
   * Records one tenant-scoped audit row with automatic metadata merge.
   * Never throws on persistence failure (delegates to {@link TenantAuditEventsService.appendOrWarn}).
   */
  async recordAuditEvent(input: RecordAuditEventInput): Promise<void> {
    const tenantId = (input.tenantId ?? this.requestContext.tryGetTenantId())?.trim().toLowerCase();
    if (!tenantId) {
      this.loggerService.warn("audit.record.skipped_no_tenant", {
        audit_category: input.category,
        action: input.action
      });
      return;
    }

    const correlationId = this.requestContext.tryGetCorrelationId() ?? this.requestContext.tryGetRequestId() ?? null;
    const actorUserId = input.actorUserId ?? this.requestContext.tryGetUserId() ?? null;
    const clientIp = input.clientIp ?? this.requestContext.tryGetClientIp() ?? "unknown";

    const metadata: Record<string, unknown> = {
      audit_category: input.category,
      correlation_id: correlationId,
      tenant_id: tenantId,
      actor_user_id: actorUserId,
      ...(input.metadata ?? {})
    };

    this.loggerService.info("audit.pipeline.record", {
      audit_category: input.category,
      action: input.action,
      tenant_id: tenantId,
      correlation_id: correlationId,
      actor_user_id: actorUserId
    });

    await this.tenantAudit.appendOrWarn(
      {
        tenantId,
        actorUserId,
        actor: input.actorDisplay,
        userId: null,
        action: input.action,
        resourceType: input.resource?.type ?? "",
        resourceId: input.resource?.id ?? null,
        metadata,
        requestId: correlationId,
        clientIp
      },
      input.manager,
    );
  }
}
