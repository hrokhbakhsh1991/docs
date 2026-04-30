import { Module } from "@nestjs/common";
import { ConfigModule } from "../../config/config.module";
import { OutboxModule } from "../outbox/outbox.module";
import { PaymentsModule } from "../payments/payments.module";
import { ReconciliationModule } from "../reconciliation/reconciliation.module";
import { RegistrationsModule } from "../registrations/registrations.module";
import { InternalApiKeyGuard } from "./internal-api-key.guard";
import { OpsController } from "./ops.controller";

@Module({
  imports: [
    ConfigModule,
    OutboxModule,
    ReconciliationModule,
    PaymentsModule,
    RegistrationsModule
  ],
  controllers: [OpsController],
  providers: [InternalApiKeyGuard]
})
export class OpsModule {}
