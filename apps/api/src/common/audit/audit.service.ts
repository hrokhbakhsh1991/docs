import { Injectable } from "@nestjs/common";
import type { OutboxDeliveryEnvelope } from "./outbox-delivery.types";
import { LoggerService } from "../logger/logger.service";

@Injectable()
export class AuditService {
  constructor(private readonly loggerService: LoggerService) {}

  /** Delivery path for transactional outbox (structured envelope; consumers must be idempotent). */
  deliverFromOutbox(envelope: OutboxDeliveryEnvelope): void {
    this.loggerService.info("audit.event.delivered", {
      tenant_id: envelope.tenant_id,
      event_id: envelope.event_id,
      event_type: envelope.event_type,
      created_at: envelope.created_at,
      payload: envelope.payload
    });
  }
}
