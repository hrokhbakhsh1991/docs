import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { DatabaseModule } from "./database/database.module";
import { LoggerModule } from "./common/logger/logger.module";
import { RequestContextModule } from "./common/request-context/request-context.module";
import { TenantModule } from "./common/tenant/tenant.module";
import { ConfigModule } from "./config/config.module";
import { AuthMiddleware } from "./common/middleware/auth.middleware";
import { AuditModule } from "./common/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { RegistrationsModule } from "./modules/registrations/registrations.module";
import { ToursModule } from "./modules/tours/tours.module";
import { OutboxModule } from "./modules/outbox/outbox.module";
import { OpsModule } from "./modules/ops/ops.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ReconciliationModule } from "./modules/reconciliation/reconciliation.module";
import { JobSchedulerModule } from "./jobs/job-scheduler.module";

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    RequestContextModule,
    LoggerModule,
    AuditModule,
    TenantModule,
    AuthModule,
    IdentityModule,
    ToursModule,
    OutboxModule,
    JobSchedulerModule,
    RegistrationsModule,
    PaymentsModule,
    ReconciliationModule,
    OpsModule
  ],
  controllers: [AppController],
  providers: [AuthMiddleware]
})
export class AppModule {}
