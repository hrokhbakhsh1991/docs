import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";
import { AppController } from "./app.controller";
import { ConfigService } from "./config/config.service";
import {
  publicRegistrationThrottleKey,
  resolveThrottleClientIp
} from "./common/throttling/public-registration-throttle";
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
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redis = config.getRedisConfig();
        return {
          throttlers: [
            {
              name: "public-registration",
              ttl: 60_000,
              limit: 10,
              // Default Throttler uses `ttl` as block duration; keep blocking negligible like the old guard.
              blockDuration: 1
            }
          ],
          storage: new ThrottlerStorageRedisService({
            host: redis.host,
            port: redis.port
          }),
          getTracker: (req: Record<string, unknown>) => resolveThrottleClientIp(req),
          generateKey: publicRegistrationThrottleKey
        };
      }
    }),
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
    // DI-DIAGNOSTIC: RegistrationsModule and PaymentsModule are mutually dependent via forwardRef in submodules; bootstrap stability depends on complete DI metadata at runtime.
    // TODO(FREEZE-BLOCKER): Re-validate module initialization order for RegistrationsModule/PaymentsModule during E2E bootstrap to rule out transient undefined injections.
    RegistrationsModule,
    PaymentsModule,
    ReconciliationModule,
    OpsModule
  ],
  controllers: [AppController],
  providers: [AuthMiddleware]
})
export class AppModule {}
