import { Injectable, Inject, Logger } from "@nestjs/common";
import type { EntityManager } from "typeorm";
import { REGISTRATION_PAYMENT_PORT, IRegistrationPaymentPort } from "../ports/registration-payment.port";
import { RegistrationStatus } from "../domain/registration-status";
import { PaymentStatus } from "../../payments/domain/payment.types";

@Injectable()
export class PaymentCapturedListener {
  private readonly logger = new Logger(PaymentCapturedListener.name);

  constructor(
    @Inject(REGISTRATION_PAYMENT_PORT)
    private readonly registrationPaymentPort: IRegistrationPaymentPort
  ) {}

  async handle(_manager: EntityManager, tenantId: string, payload: Record<string, unknown>): Promise<void> {
    const registrationId = payload.registrationId as string;
    const actorId = (payload.actorId as string) || "system";
    const newStatus = payload.newStatus as string;

    if (!registrationId || newStatus !== PaymentStatus.PAID) {
      return;
    }

    try {
      // Transition registration status based on payment captured
      await this.registrationPaymentPort.transitionRegistrationForPayment(
        { id: registrationId, tenantId, paymentStatus: PaymentStatus.PAID } as any,
        RegistrationStatus.ACCEPTED_PAID as any,
        actorId
      );
      this.logger.log(`Registration ${registrationId} payment marked as paid and transitioned`);
    } catch (error) {
      this.logger.error(`Failed to transition registration ${registrationId} on payment.captured`, error);
      throw error;
    }
  }
}
