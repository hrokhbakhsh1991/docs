import { Module, forwardRef } from "@nestjs/common";
import Redis from "ioredis";
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
import { PaymentGatewayIdempotencyEntity } from "./entities/payment-gateway-idempotency.entity";
import { PaymentsController, PaymentsWebhookController } from "./payments.controller";
import { PaymentsProcessor } from "./payments.processor";
import { PaymentIntentRegistrationResolverApplicationService } from "./application/payment-intent-registration-resolver.application.service";
import { PaymentsService } from "./payments.service";
import { RegistrationsModule } from "../registrations/registrations.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity, UserEntity, PaymentGatewayIdempotencyEntity]),
    TypeOrmModule.forFeature([TenantEntity]),
    DatabaseModule,
    OutboxModule,
    IdempotencyModule,
    FinanceLedgerModule,
    forwardRef(() => RegistrationsModule)
  ],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [
    InMemoryIdempotencyKeyStore,
    RedisPaymentIdempotencyKeyStore,
    PostgresPaymentIdempotencyKeyStore,
    {
      provide: PAYMENTS_GATEWAY_IDEMPOTENCY_REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const { host, port } = config.getRedisConfig();
        return new Redis({
          host,
          port,
          maxRetriesPerRequest: 2,
          lazyConnect: true
        });
      }
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
