import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigService } from "../../config/config.service";
import { DatabaseModule } from "../../database/database.module";
import { InternalApiKeyGuard } from "../ops/internal-api-key.guard";
import {
  InMemoryIdempotencyKeyStore,
  PAYMENT_GATEWAY_IDEMPOTENCY_STORE,
  PAYMENTS_GATEWAY_IDEMPOTENCY_REDIS
} from "./gateway/payment-idempotency-key.store";
import { RedisPaymentIdempotencyKeyStore } from "./gateway/redis-payment-idempotency-key.store";
import { PostgresPaymentIdempotencyKeyStore } from "./gateway/postgres-payment-idempotency-key.store";
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
import { RegistrationEntity } from "../registrations/registration.entity";
import { PaymentReceiptEntity } from "./entities/payment-receipt.entity";
import { PaymentGatewayIdempotencyEntity } from "./entities/payment-gateway-idempotency.entity";
import { PaymentsController, PaymentsWebhookController } from "./payments.controller";
import { FinancePaymentsController, FinanceAdminReceiptsController } from "./finance-payments.controller";
import { FinanceReportsModule } from "../finance/reports/finance-reports.module";
import { PaymentsProcessor } from "./payments.processor";
import { PaymentIntentRegistrationResolverApplicationService } from "./application/payment-intent-registration-resolver.application.service";
import { PaymentsService } from "./payments.service";
import { ManualPaymentService } from "./manual-payment.service";

import { REDIS_CLIENT } from "../../infra/redis/redis.constants";
import { StorageModule } from "../../infra/storage/storage.module";
import { ReceiptsModule } from "../finance/receipts/receipts.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PaymentEntity,
      PaymentReceiptEntity,
      RegistrationEntity,
      UserEntity,
      PaymentGatewayIdempotencyEntity
    ]),
    TypeOrmModule.forFeature([TenantEntity]),
    DatabaseModule,
    OutboxModule,
    IdempotencyModule,
    FinanceLedgerModule,
    StorageModule,
    ReceiptsModule,
    FinanceReportsModule
  ],
  controllers: [
    PaymentsController,
    PaymentsWebhookController,
    FinancePaymentsController,
    FinanceAdminReceiptsController
  ],
  providers: [
    InMemoryIdempotencyKeyStore,
    RedisPaymentIdempotencyKeyStore,
    PostgresPaymentIdempotencyKeyStore,
    {
      provide: PAYMENTS_GATEWAY_IDEMPOTENCY_REDIS,
      useExisting: REDIS_CLIENT
    },
    {
      provide: PAYMENT_GATEWAY_IDEMPOTENCY_STORE,
      inject: [
        ConfigService,
        PostgresPaymentIdempotencyKeyStore,
        RedisPaymentIdempotencyKeyStore,
        InMemoryIdempotencyKeyStore
      ],
      useFactory: (
        config: ConfigService,
        postgresStore: PostgresPaymentIdempotencyKeyStore,
        redisStore: RedisPaymentIdempotencyKeyStore,
        memoryStore: InMemoryIdempotencyKeyStore
      ) => {
        const mode = config.getPaymentGatewayIdempotencyStore();
        if (mode === "redis") {
          return redisStore;
        }
        if (mode === "postgres") {
          return postgresStore;
        }
        return memoryStore;
      }
    },
    MockPaymentGateway,
    StripeLikePaymentGatewayPlaceholder,
    StripePaymentGateway,
    ZibalPaymentGateway,
    PaymentGatewayFactory,
    PaymentIntentRegistrationResolverApplicationService,
    PaymentsService,
    ManualPaymentService,
    PaymentsProcessor,
    InternalApiKeyGuard,
    PaymentWebhookSignatureGuard
  ],
  exports: [
    PaymentsService,
    PaymentGatewayFactory,
    PAYMENT_GATEWAY_IDEMPOTENCY_STORE,
    InMemoryIdempotencyKeyStore,
    RedisPaymentIdempotencyKeyStore,
    PostgresPaymentIdempotencyKeyStore,
    MockPaymentGateway,
    StripeLikePaymentGatewayPlaceholder,
    StripePaymentGateway,
    ZibalPaymentGateway
  ]
})
export class PaymentsModule {}
