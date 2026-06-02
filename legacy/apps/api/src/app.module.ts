import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
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
import { EventsModule } from "./common/events/events.module";
import { ObservabilityModule } from "./common/observability/observability.module";
import { RequestContextModule } from "./common/request-context/request-context.module";
import { CaslModule } from "./common/casl/casl.module";
import { TenantModule } from "./common/tenant/tenant.module";
import { ConfigModule } from "./config/config.module";
import { AuthMiddleware } from "./common/middleware/auth.middleware";
import { TenantGuardMiddleware } from "./common/middleware/tenant-guard.middleware";
import { AuditModule } from "./common/audit/audit.module";
import { AuthModule } from "./modules/auth/auth.module";
import { IdentityModule } from "./modules/identity/identity.module";
import { RegistrationsModule } from "./modules/registrations/registrations.module";
import { ToursModule } from "./modules/tours/tours.module";
import { OutboxModule } from "./modules/outbox/outbox.module";
import { OpsModule } from "./modules/ops/ops.module";
import { SettingsLocationsModule } from "./modules/settings-locations/settings-locations.module";
import { SafetyProfileModule } from "./modules/safety-profile/safety-profile.module";
import { DraftEngineModule } from "./modules/draft-engine/draft-engine.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ReconciliationModule } from "./modules/reconciliation/reconciliation.module";
import { FinanceInvoicingModule } from "./modules/finance/finance-invoicing.module";
import { JobSchedulerModule } from "./jobs/job-scheduler.module";
import { TenantAbuseModule } from "./common/tenant-abuse/tenant-abuse.module";
import { TenantUsageModule } from "./common/billing/tenant-usage.module";
import { EmailModule } from "./common/email/email.module";
import { OtpModule } from "./modules/auth/otp.module";
import { RedisInfraModule } from "./infra/redis/redis.module";
import { REDIS_CLIENT } from "./infra/redis/redis.constants";
import { StorageModule } from "./infra/storage/storage.module";
import Redis from "ioredis";

@Module({
  imports: [
    ConfigModule,
    RedisInfraModule,
    StorageModule,
    EmailModule,
    OtpModule,
    TenantAbuseModule,
    TenantUsageModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule, RedisInfraModule],
      inject: [ConfigService, REDIS_CLIENT],
      useFactory: (config: ConfigService, redisClient: Redis) => {
        const isTest = config.getNodeEnv() === "test";
        return {
          throttlers: [
            {
              name: "public-registration",
              ttl: 60_000,
              // E2E + api suites share one IP and Redis; production stays tight.
              limit: isTest ? 8000 : 10,
              // Default Throttler uses `ttl` as block duration; keep blocking negligible like the old guard.
              blockDuration: 1
            },
            {
              name: "payments-webhook",
              ttl: 60_000,
              limit: 200,
              blockDuration: 1
            },
            {
              name: "tour-create",
              ttl: 60_000,
              limit: isTest ? 5000 : 30,
              blockDuration: 1
            }
          ],
          storage: new ThrottlerStorageRedisService(redisClient),
          getTracker: (req: Record<string, unknown>) =>
            resolveThrottleClientIp(req, {
              trustedProxyCidrs: config.getTrustedProxyCidrs()
            }),
          generateKey: publicRegistrationThrottleKey
        };
      }
    }),
    DatabaseModule,
    RequestContextModule,
    CaslModule,
    LoggerModule,
    EventsModule,
    ObservabilityModule,
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
    FinanceInvoicingModule,
    OpsModule,
    SettingsLocationsModule,
    SafetyProfileModule,
    DraftEngineModule
  ],
  controllers: [AppController],
  providers: [AuthMiddleware, TenantGuardMiddleware]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TenantGuardMiddleware).forRoutes({ path: "*", method: RequestMethod.ALL });
  }
}
