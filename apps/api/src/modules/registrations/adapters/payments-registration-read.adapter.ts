import { Inject, Injectable } from "@nestjs/common";
import type { EntityManager } from "typeorm";

import { PaymentsService } from "../../payments/payments.service";
import type {
  CreateRegistrationPaymentIntentInput,
  RegistrationReadPort,
} from "../domain/ports/registration-read.port";
import type { RegistrationPaymentIntentSnapshot } from "../domain/registration-payment-intent.types";

@Injectable()
export class PaymentsRegistrationReadAdapter implements RegistrationReadPort {
  constructor(@Inject(PaymentsService) private readonly paymentsService: PaymentsService) {}

  async createPaymentIntentWithManager(
    manager: EntityManager,
    input: CreateRegistrationPaymentIntentInput
  ): Promise<RegistrationPaymentIntentSnapshot> {
    const { registration, paymentProvider, providerPaymentId } = input;
    const totalMinorNum =
      registration.quotedTotalMinor != null
        ? Number(String(registration.quotedTotalMinor).trim())
        : NaN;

    const payment = await this.paymentsService.createPaymentIntentWithManager(manager, {
      registrationId: registration.id,
      amount: totalMinorNum,
      currency: String(registration.quotedCurrencyCode ?? "").trim().toUpperCase(),
      paymentProvider,
      providerPaymentId,
    });

    return {
      id: payment.id,
      tenantId: payment.tenantId,
      registrationId: payment.registrationId,
      amount: payment.amount,
      currency: payment.currency,
      provider: payment.provider,
      providerPaymentId: payment.providerPaymentId,
      status: payment.status,
      paidAt: payment.paidAt,
      failedAt: payment.failedAt,
      refundedAt: payment.refundedAt,
      clientSecret: payment.clientSecret ?? null,
      checkoutUrl: payment.checkoutUrl ?? null,
    };
  }
}
