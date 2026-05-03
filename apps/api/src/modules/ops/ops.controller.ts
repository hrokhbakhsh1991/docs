import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiHeader, ApiOperation, ApiSecurity, ApiTags } from "@nestjs/swagger";
import { ConfigService } from "../../config/config.service";
import { SchedulerRuntimeMetricsService } from "../../jobs/scheduler-runtime-metrics.service";
import { OutboxMetricsService } from "../outbox/outbox-metrics.service";
import { PaymentsService } from "../payments/payments.service";
import { ReconciliationService } from "../reconciliation/reconciliation.service";
import { RegistrationsService } from "../registrations/registrations.service";
import { InternalApiKeyGuard } from "./internal-api-key.guard";

@ApiTags("Ops")
@Controller("internal/ops")
@UseGuards(InternalApiKeyGuard)
export class OpsController {
  constructor(
    private readonly configService: ConfigService,
    private readonly schedulerRuntimeMetrics: SchedulerRuntimeMetricsService,
    private readonly outboxMetrics: OutboxMetricsService,
    private readonly reconciliation: ReconciliationService,
    private readonly paymentsService: PaymentsService,
    private readonly registrationsService: RegistrationsService
  ) {}

  @Get("outbox")
  @ApiSecurity("internalApiKey")
  @ApiHeader({
    name: "X-Internal-Api-Key",
    required: true,
    description: "Internal API key required for ops endpoints."
  })
  @ApiOperation({ summary: "Internal outbox metrics snapshot" })
  outboxSnapshot(): {
    pending: number;
    failed: number;
    processingLatencyMs: number;
    lastBatchProcessedAt: string | null;
  } {
    const s = this.outboxMetrics.getSnapshot();
    return {
      pending: s.outbox_pending_total,
      failed: s.outbox_failed_total,
      processingLatencyMs: s.outbox_processing_latency_ms,
      lastBatchProcessedAt: s.last_batch_processed_at
    };
  }

  @Get("health")
  @ApiSecurity("internalApiKey")
  @ApiHeader({
    name: "X-Internal-Api-Key",
    required: true,
    description: "Internal API key required for ops endpoints."
  })
  @ApiOperation({ summary: "Internal runtime health snapshot" })
  healthSnapshot(): {
    outbox: { pending: number; failed: number };
    capacity: { driftDetected: boolean; lastReconciliationAt: string | null };
    waitlist: { promotedInLastRun: number };
    payments: {
      timedOut: number;
      failed: number;
      autoRecoveredCapacityCount: number;
      webhookReceivedTotal: number;
      webhookProcessedTotal: number;
      webhookFailedTotal: number;
      webhookUnknownPaymentTotal: number;
      webhookDedupedTotal: number;
    };
    registrations: {
      registrationCreatedTotal: number;
      registrationWaitlistedTotal: number;
      paymentIntentsCreatedTotal: number;
      registrationPaidTotal: number;
    };
    schedulers: {
      enabled: boolean;
      role: "api" | "worker" | "all";
      jobs: Record<
        string,
        {
          lastStartedAt: string | null;
          lastFinishedAt: string | null;
          lastDurationMs: number;
          lastErrorAt: string | null;
          startedTotal: number;
          finishedTotal: number;
          failedTotal: number;
          skippedDueLockTotal: number;
        }
      >;
    };
  } {
    const o = this.outboxMetrics.getSnapshot();
    const r = this.reconciliation.getSnapshot();
    const p = this.paymentsService.getMetricsSnapshot();
    const m = this.registrationsService.getPublicFlowMetrics();
    return {
      outbox: {
        pending: o.outbox_pending_total,
        failed: o.outbox_failed_total
      },
      capacity: {
        driftDetected: r.lastRunHadDrift,
        lastReconciliationAt: r.lastReconciliationAt
      },
      waitlist: {
        promotedInLastRun: r.promotedInLastRun
      },
      payments: {
        timedOut: p.timedOutPayments,
        failed: p.failedPayments,
        autoRecoveredCapacityCount: p.autoRecoveredCapacityCount,
        webhookReceivedTotal: p.webhookReceivedTotal,
        webhookProcessedTotal: p.webhookProcessedTotal,
        webhookFailedTotal: p.webhookFailedTotal,
        webhookUnknownPaymentTotal: p.webhookUnknownPaymentTotal,
        webhookDedupedTotal: p.webhookDedupedTotal
      },
      registrations: {
        registrationCreatedTotal: m.registrationCreatedTotal,
        registrationWaitlistedTotal: m.registrationWaitlistedTotal,
        paymentIntentsCreatedTotal: p.paymentIntentsCreatedTotal ?? 0,
        registrationPaidTotal: m.registrationPaidTotal
      },
      schedulers: {
        enabled: this.configService.getEnableSchedulers(),
        role: this.configService.getRuntimeRole(),
        jobs: this.schedulerRuntimeMetrics.getSnapshot()
      }
    };
  }
}
