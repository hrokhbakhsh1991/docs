import { Inject, Injectable, Logger } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import {
  REGISTRATION_FINANCIAL_MUTATION_PORT,
  type RegistrationFinancialMutationPort,
} from "../../../common/ports/registration-financial-mutation.port";
import { LedgerCommandBus } from "../ledger/ledger-command-bus";
import type { BookingLedgerLeaderRegistrationRow } from "../ledger/contracts/leader-registration-payment-ledger.contracts";

@Injectable()
export class RegistrationPaymentUpdatedLedgerListener {
  private readonly logger = new Logger(RegistrationPaymentUpdatedLedgerListener.name);

  constructor(
    private readonly ledgerCommandBus: LedgerCommandBus,
    @Inject(REGISTRATION_FINANCIAL_MUTATION_PORT)
    private readonly registrationFinancialMutation: RegistrationFinancialMutationPort
  ) {}

  async handle(
    manager: EntityManager,
    tenantId: string,
    outboxEventId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const registrationId = typeof payload.entityId === "string" ? payload.entityId : null;
    if (!registrationId) {
      return;
    }

    const metadata =
      payload.metadata != null && typeof payload.metadata === "object"
        ? (payload.metadata as Record<string, unknown>)
        : {};

    const idempotencyKey =
      typeof metadata.idempotencyKey === "string" && metadata.idempotencyKey.trim().length > 0
        ? metadata.idempotencyKey
        : outboxEventId;

    const paymentStatus =
      typeof metadata.paymentStatus === "string" ? metadata.paymentStatus : null;
    if (!paymentStatus) {
      return;
    }

    const record = await this.registrationFinancialMutation.findRegistrationForReceipt(
      manager,
      tenantId,
      registrationId
    );
    if (!record) {
      this.logger.warn(`Registration ${registrationId} not found for payment ledger sync`);
      return;
    }

    const paidAmountRaw = metadata.paidAmount;
    const paidAmount =
      typeof paidAmountRaw === "string"
        ? paidAmountRaw
        : typeof paidAmountRaw === "number" && Number.isFinite(paidAmountRaw)
          ? String(Math.trunc(paidAmountRaw))
          : undefined;

    const row: BookingLedgerLeaderRegistrationRow = {
      id: record.id,
      tenantId: record.tenantId,
      paymentStatus: record.paymentStatus as BookingLedgerLeaderRegistrationRow["paymentStatus"],
      quotedCurrencyCode: record.quotedCurrencyCode ?? undefined,
      paidAmount: record.paidAmount ?? undefined,
    };

    await this.ledgerCommandBus.applyLeaderRegistrationPaymentMutation(
      manager,
      row,
      {
        paymentStatus: paymentStatus as BookingLedgerLeaderRegistrationRow["paymentStatus"],
        ...(paidAmount !== undefined ? { paidAmount } : {}),
      },
      idempotencyKey
    );

    await this.registrationFinancialMutation.saveRegistrationFinancialRecord(manager, {
      ...record,
      paymentStatus: row.paymentStatus as typeof record.paymentStatus,
      paidAmount: row.paidAmount ?? null,
    });

    this.logger.log(`Registration payment ledger synced for ${registrationId}`);
  }
}
