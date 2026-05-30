import { Injectable, Logger } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { LedgerCommandBus } from "../ledger/ledger-command-bus";

@Injectable()
export class RegistrationCreatedLedgerListener {
  private readonly logger = new Logger(RegistrationCreatedLedgerListener.name);

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

    const quotedTotalMinor =
      typeof payload.quotedTotalMinor === "string" ? payload.quotedTotalMinor : null;
    const currency =
      typeof payload.currency === "string" && payload.currency.trim().length > 0
        ? payload.currency
        : "UNK";

    await this.ledgerCommandBus.recordRegistrationCreated(manager, {
      tenantId,
      registrationId,
      quotedTotalMinor,
      currency,
    });

    this.logger.log(`Registration created ledger handled for ${registrationId}`);
  }
}
