import { Injectable } from "@nestjs/common";
import { LoggerService } from "../logger/logger.service";

type AuditEntityType = "registration";

type AuditEventPayload = {
  entityType: AuditEntityType;
  entityId: string;
  actorId: string;
  metadata: {
    previousStatus: string;
    newStatus: string;
    tourId: string;
    scheduleId: string | null;
  };
};

@Injectable()
export class AuditService {
  constructor(private readonly loggerService: LoggerService) {}

  emit(eventName: string, payload: AuditEventPayload): void {
    this.loggerService.info("audit.event.emitted", {
      eventName,
      ...payload
    });
  }

  /** Delivery path for transactional outbox (same log shape; consumers must be idempotent). */
  deliverFromOutbox(eventType: string, payload: Record<string, unknown>): void {
    this.loggerService.info("audit.event.delivered", {
      eventType,
      ...payload
    });
  }
}
