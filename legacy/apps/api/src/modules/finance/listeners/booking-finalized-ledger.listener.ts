import { Injectable, Logger } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { LedgerCommandBus } from "../ledger/ledger-command-bus";

const BOOKING_FINALIZED_EVENT_TYPES = new Set([
  "booking.finalized",
  "booking.finalization.booking_confirmed",
]);

export function isBookingFinalizedOutboxEventType(eventType: string): boolean {
  return BOOKING_FINALIZED_EVENT_TYPES.has(eventType);
}

@Injectable()
export class BookingFinalizedLedgerListener {
  private readonly logger = new Logger(BookingFinalizedLedgerListener.name);

  constructor(private readonly ledgerCommandBus: LedgerCommandBus) {}

  async handle(
    manager: EntityManager,
    tenantId: string,
    _outboxEventId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const registrationId =
      typeof payload.entityId === "string"
        ? payload.entityId
        : typeof payload.registrationId === "string"
          ? payload.registrationId
          : null;
    if (!registrationId) {
      return;
    }

    const metadata =
      payload.metadata != null && typeof payload.metadata === "object"
        ? (payload.metadata as Record<string, unknown>)
        : {};

    const quotedTotalMinor =
      typeof payload.quotedTotalMinor === "string"
        ? payload.quotedTotalMinor
        : typeof metadata.quotedTotalMinor === "string"
          ? metadata.quotedTotalMinor
          : null;
    const currency =
      typeof payload.currency === "string" && payload.currency.trim().length > 0
        ? payload.currency
        : typeof metadata.currency === "string" && metadata.currency.trim().length > 0
          ? metadata.currency
          : "UNK";

    await this.ledgerCommandBus.recordBookingFinalized(manager, {
      tenantId,
      registrationId,
      quotedTotalMinor,
      currency,
    });

    this.logger.log(`Booking finalized ledger handled for ${registrationId}`);
  }
}
