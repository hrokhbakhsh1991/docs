import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseModule } from "../../database/database.module";
import { InternalApiKeyGuard } from "../ops/internal-api-key.guard";
import { InMemoryIdempotencyKeyStore } from "./gateway/payment-idempotency-key.store";
import { MockPaymentGateway } from "./gateway/mock-payment-gateway";
import { PaymentGatewayFactory } from "./gateway/payment-gateway.factory";
import { StripeLikePaymentGatewayPlaceholder } from "./gateway/stripe-like-payment-gateway.placeholder";
import { StripePaymentGateway } from "./gateway/stripe-payment-gateway";
import { ZibalPaymentGateway } from "./gateway/zibal-payment-gateway";
import { PaymentWebhookSignatureGuard } from "./payments-webhook-signature.guard";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { FinanceLedgerModule } from "../finance/finance-ledger.module";
import { OutboxModule } from "../outbox/outbox.module";
import { TenantEntity } from "../identity/entities/tenant.entity";
import { UserEntity } from "../identity/entities/user.entity";
import { PaymentEntity } from "./entities/payment.entity";
import { PaymentsController, PaymentsWebhookController } from "./payments.controller";
import { PaymentsProcessor } from "./payments.processor";
import { PaymentIntentRegistrationResolverApplicationService } from "./application/payment-intent-registration-resolver.application.service";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity, UserEntity]),
    TypeOrmModule.forFeature([TenantEntity]),
    DatabaseModule,
    OutboxModule,
    IdempotencyModule,
    FinanceLedgerModule
  ],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [
    InMemoryIdempotencyKeyStore,
    MockPaymentGateway,
    StripeLikePaymentGatewayPlaceholder,
    StripePaymentGateway,
    ZibalPaymentGateway,
    PaymentGatewayFactory,
    PaymentIntentRegistrationResolverApplicationService,
    PaymentsService,
    PaymentsProcessor,
    InternalApiKeyGuard,
    PaymentWebhookSignatureGuard
  ],
  exports: [
    PaymentsService,
    PaymentGatewayFactory,
    InMemoryIdempotencyKeyStore,
    MockPaymentGateway,
    StripeLikePaymentGatewayPlaceholder,
    StripePaymentGateway,
    ZibalPaymentGateway
  ]
})
export class PaymentsModule {}
