import { Logger } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import {
  RegistrationEntity,
  RegistrationPaymentStatus,
  RegistrationStatus
} from "../registrations/registration.entity";
import { TourEntity } from "../tours/entities/tour.entity";
import type { OutboxMetricsService } from "./outbox-metrics.service";

export const REGISTRATION_ACCEPTED_OUTBOX_EVENT_TYPE = "registration.accepted";

const SMS_GATE_LOG_MESSAGE =
  "[SMS GATEWAY OUTBOX UNIFIED DISPATCH] -> Texting user via participantContactPhone to proceed with payment.";

function tourRequiresPayment(costContext: TourEntity["costContext"]): boolean {
  if (costContext == null || typeof costContext !== "object") {
    return false;
  }
  const ctx = costContext as { requiresPayment?: boolean; requires_payment?: boolean };
  return Boolean(ctx.requiresPayment ?? ctx.requires_payment);
}

/**
 * Phase 16.3 placeholder: logs and metrics for post-approval payment SMS (provider not wired).
 */
export async function dispatchRegistrationAcceptedSmsGateIfEligible(input: {
  manager: EntityManager;
  metrics: OutboxMetricsService;
  logger: Logger;
  tenantId: string;
  outboxEventId: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const metadata = input.payload.metadata;
  if (metadata == null || typeof metadata !== "object") {
    return;
  }
  const meta = metadata as { previousStatus?: unknown; newStatus?: unknown };
  if (meta.previousStatus !== RegistrationStatus.PENDING) {
    return;
  }
  if (meta.newStatus !== RegistrationStatus.ACCEPTED) {
    return;
  }

  const entityId = input.payload.entityId;
  if (typeof entityId !== "string" || entityId.trim() === "") {
    return;
  }

  const registration = await input.manager.findOne(RegistrationEntity, {
    where: { id: entityId, tenantId: input.tenantId }
  });
  if (!registration) {
    return;
  }
  if (registration.paymentStatus !== RegistrationPaymentStatus.NOT_PAID) {
    return;
  }

  const tour = await input.manager.findOne(TourEntity, {
    where: { id: registration.tourId, tenantId: input.tenantId },
    select: { id: true, tenantId: true, costContext: true }
  });
  if (!tour || !tourRequiresPayment(tour.costContext)) {
    return;
  }

  input.metrics.incrementRegistrationAcceptedSmsGateDispatched();
  input.logger.log(SMS_GATE_LOG_MESSAGE, {
    tenant_id: input.tenantId,
    outbox_event_id: input.outboxEventId,
    registration_id: registration.id,
    participant_contact_phone: registration.participantContactPhone
  });
}
