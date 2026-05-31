import { Injectable, Logger } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { PaymentCaptureLedgerAuthorityService } from "../ledger/payment-capture-ledger-authority.service";
import { PaymentRefundLedgerAuthorityService } from "../ledger/repositories/payment-refund-ledger-authority.service";
import { PaymentStatus } from "../../payments/domain/payment.types";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveValidatedEventTenantId(
  payload: Record<string, unknown>,
  scopedTenantId: string,
): string {
  const fromPayloadRaw =
    (typeof payload.tenantId === "string" && payload.tenantId.trim()) ||
    (typeof payload.tenant_id === "string" && payload.tenant_id.trim()) ||
    "";
  const scoped = scopedTenantId.trim().toLowerCase();
  const fromPayload = fromPayloadRaw.trim().toLowerCase();

  if (!fromPayload || !UUID_V4_REGEX.test(fromPayload)) {
    throw new Error("PAYMENT_LEDGER_SYNC_TENANT_ID_INVALID");
  }
  if (scoped && fromPayload !== scoped) {
    throw new Error("PAYMENT_LEDGER_SYNC_TENANT_SCOPE_MISMATCH");
  }
  return fromPayload;
}

@Injectable()
export class PaymentLedgerSyncListener {
  private readonly logger = new Logger(PaymentLedgerSyncListener.name);

  constructor(
    private readonly paymentCaptureLedgerAuthority: PaymentCaptureLedgerAuthorityService,
    private readonly paymentRefundLedgerAuthority: PaymentRefundLedgerAuthorityService
  ) {}

  async handle(manager: EntityManager, scopedTenantId: string, payload: Record<string, unknown>): Promise<void> {
    const paymentId = payload.entityId as string;
    const newStatus = payload.newStatus as string;

    if (!paymentId) return;

    if (newStatus !== PaymentStatus.PAID && newStatus !== PaymentStatus.REFUNDED) {
      return;
    }

    const tenantId = resolveValidatedEventTenantId(payload, scopedTenantId);

    try {
      const [paymentRow] = await manager.query(
        `SELECT id, tenant_id AS "tenantId", registration_id AS "registrationId", amount, currency, paid_at AS "paidAt", refunded_at AS "refundedAt"
         FROM payments
         WHERE id = $1 AND tenant_id = $2`,
        [paymentId, tenantId],
      );

      if (!paymentRow) {
        this.logger.warn(
          `Payment ${paymentId} not found for ledger sync in tenant ${tenantId}`,
        );
        return;
      }

      if (paymentRow.tenantId?.trim().toLowerCase() !== tenantId) {
        throw new Error("PAYMENT_LEDGER_SYNC_TENANT_ROW_MISMATCH");
      }

      if (newStatus === PaymentStatus.PAID) {
        await this.paymentCaptureLedgerAuthority.emitPaymentCaptureAtPaid(
          manager,
          {
            id: paymentRow.id,
            tenantId: paymentRow.tenantId,
            registrationId: paymentRow.registrationId,
            amount: paymentRow.amount,
            currency: paymentRow.currency,
            paidAt: paymentRow.paidAt ? new Date(paymentRow.paidAt) : new Date(),
          },
          "online_webhook_paid"
        );
        this.logger.log(`Payment capture ledger synced for ${paymentId}`);
      } else if (newStatus === PaymentStatus.REFUNDED) {
        const key = `payment-refund:${paymentRow.id}:${paymentRow.tenantId}`;
        await this.paymentRefundLedgerAuthority.emitPaymentRefundLedgerReversal(
          manager,
          {
            id: paymentRow.id,
            tenantId: paymentRow.tenantId,
            registrationId: paymentRow.registrationId,
            amount: paymentRow.amount,
            currency: paymentRow.currency,
            refundedAt: paymentRow.refundedAt ? new Date(paymentRow.refundedAt) : new Date(),
          } as any,
          key
        );
        this.logger.log(`Payment refund ledger synced for ${paymentId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to sync ledger for payment ${paymentId}`, error);
      throw error;
    }
  }
}
