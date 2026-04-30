import { forwardRef, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { InternalApiKeyGuard } from "../ops/internal-api-key.guard";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { OutboxModule } from "../outbox/outbox.module";
import { RegistrationsModule } from "../registrations/registrations.module";
import { PaymentEntity } from "./entities/payment.entity";
import { PaymentsController, PaymentsWebhookController } from "./payments.controller";
import { PaymentsProcessor } from "./payments.processor";
import { PaymentsService } from "./payments.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([PaymentEntity]),
    forwardRef(() => RegistrationsModule),
    OutboxModule,
    IdempotencyModule
  ],
  controllers: [PaymentsController, PaymentsWebhookController],
  providers: [PaymentsService, PaymentsProcessor, InternalApiKeyGuard],
  exports: [PaymentsService]
})
export class PaymentsModule {}
