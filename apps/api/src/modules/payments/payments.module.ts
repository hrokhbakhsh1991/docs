import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DatabaseModule } from "../../database/database.module";
import { InternalApiKeyGuard } from "../ops/internal-api-key.guard";
import { PaymentWebhookSignatureGuard } from "./payments-webhook-signature.guard";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { OutboxModule } from "../outbox/outbox.module";
import { TenantEntity } from "../identity/entities/tenant.entity";
import { UserEntity } from "../identity/entities/user.entity";
import { PaymentEntity } from "./entities/payment.entity";
import { PaymentsController, PaymentsWebhookController } from "./payments.controller";
import { PaymentsProcessor } from "./payments.processor";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity, UserEntity]),
    TypeOrmModule.forFeature([TenantEntity]),
    DatabaseModule,
    OutboxModule,
    IdempotencyModule
  ],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [
    PaymentsService,
    PaymentsProcessor,
    InternalApiKeyGuard,
    PaymentWebhookSignatureGuard
  ],
  exports: [PaymentsService]
})
export class PaymentsModule {}
