import { Module } from "@nestjs/common";
import { getDataSourceToken } from "@nestjs/typeorm";
import { AppController } from "../app.controller";
import { LoggerService } from "../common/logger/logger.service";
import { RequestContextService } from "../common/request-context/request-context.service";
import { ConfigService } from "../config/config.service";
import { SchedulerRuntimeMetricsService } from "../jobs/scheduler-runtime-metrics.service";
import { IdempotencyService } from "../modules/idempotency/idempotency.service";
import { AuthController } from "../modules/auth/auth.controller";
import { AuthService } from "../modules/auth/auth.service";
import { OpsController } from "../modules/ops/ops.controller";
import { OutboxMetricsService } from "../modules/outbox/outbox-metrics.service";
import { PaymentsController, PaymentsWebhookController } from "../modules/payments/payments.controller";
import { PaymentsService } from "../modules/payments/payments.service";
import { ReconciliationService } from "../modules/reconciliation/reconciliation.service";
import { RegistrationsController } from "../modules/registrations/registrations.controller";
import { RegistrationsService } from "../modules/registrations/registrations.service";
import { ToursController } from "../modules/tours/tours.controller";
import { ToursService } from "../modules/tours/tours.service";

@Module({
  controllers: [
    AppController,
    AuthController,
    ToursController,
    RegistrationsController,
    PaymentsController,
    PaymentsWebhookController,
    OpsController
  ],
  providers: [
    {
      provide: getDataSourceToken(),
      useValue: {
        query: async () => [{ ok: 1 }]
      }
    },
    {
      provide: LoggerService,
      useValue: {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined
      }
    },
    {
      provide: RequestContextService,
      useValue: {
        getRequestId: () => "openapi-build",
        getTenantId: () => "00000000-0000-4000-8000-000000000000",
        getUserId: () => "openapi-build-user",
        getRole: () => "SYSTEM",
        getContext: () => ({
          requestId: "openapi-build",
          tenantId: "00000000-0000-4000-8000-000000000000",
          userId: "openapi-build-user",
          role: "SYSTEM"
        }),
        setTenantId: () => undefined
      }
    },
    { provide: AuthService, useValue: {} },
    {
      provide: ConfigService,
      useValue: {
        getInternalApiKey: () => "openapi-build-key",
        getEnableSchedulers: () => false,
        getRuntimeRole: () => "api"
      }
    },
    { provide: ToursService, useValue: {} },
    { provide: RegistrationsService, useValue: {} },
    { provide: PaymentsService, useValue: {} },
    { provide: IdempotencyService, useValue: {} },
    {
      provide: OutboxMetricsService,
      useValue: {
        getSnapshot: () => ({
          outbox_pending_total: 0,
          outbox_failed_total: 0,
          outbox_processing_latency_ms: 0,
          last_batch_processed_at: null
        })
      }
    },
    {
      provide: ReconciliationService,
      useValue: {
        getSnapshot: () => ({
          lastRunAt: null,
          lastReconciliationAt: null,
          lastRunHadDrift: false,
          promotedInLastRun: 0,
          totalDriftsDetected: 0,
          totalCorrectionsApplied: 0,
          totalPromotionsTriggered: 0
        })
      }
    },
    {
      provide: SchedulerRuntimeMetricsService,
      useValue: {
        getSnapshot: () => ({})
      }
    }
  ]
})
export class DocumentationModule {}
