import assert from "node:assert/strict";
import test from "node:test";
import { OutboxMetricsService } from "../../src/modules/outbox/outbox-metrics.service";
import { OpsController } from "../../src/modules/ops/ops.controller";
import { RegistrationsService } from "../../src/modules/registrations/registrations.service";
import {
  ReconciliationService,
  type ReconciliationRuntimeSnapshot
} from "../../src/modules/reconciliation/reconciliation.service";
import { PaymentsService } from "../../src/modules/payments/payments.service";

/**
 * Thin integration check: OpsController maps cached metrics to the external JSON contract
 * without hitting the database (heavy HTTP bootstrap is covered separately via api.e2e-spec).
 */
test("integration: ops controller maps cached outbox and reconciliation snapshots", () => {
  const metrics = new OutboxMetricsService();
  metrics.setPendingTotal(7);
  metrics.incrementFailed();
  metrics.setProcessingLatencyMs(42);
  metrics.setLastBatchProcessedAt("2026-04-30T12:00:00.000Z");

  const reconciliationStub = {
    getSnapshot: (): ReconciliationRuntimeSnapshot => ({
      lastRunAt: "2026-04-30T12:01:00.000Z",
      lastReconciliationAt: "2026-04-30T12:01:00.000Z",
      lastRunHadDrift: true,
      promotedInLastRun: 2,
      totalDriftsDetected: 3,
      totalCorrectionsApplied: 3,
      totalPromotionsTriggered: 5
    })
  } as unknown as ReconciliationService;

  const paymentsStub = {
    getMetricsSnapshot: () => ({
      paymentIntentsCreatedTotal: 4,
      timedOutPayments: 1,
      failedPayments: 2,
      autoRecoveredCapacityCount: 3,
      lastTimeoutRunAt: "2026-04-30T12:02:00.000Z"
    })
  } as unknown as PaymentsService;
  const registrationsStub = {
    getPublicFlowMetrics: () => ({
      registrationCreatedTotal: 10,
      registrationWaitlistedTotal: 3,
      registrationPaidTotal: 6
    })
  } as unknown as RegistrationsService;

  const controller = new OpsController(
    metrics,
    reconciliationStub,
    paymentsStub,
    registrationsStub
  );

  assert.deepStrictEqual(controller.outboxSnapshot(), {
    pending: 7,
    failed: 1,
    processingLatencyMs: 42,
    lastBatchProcessedAt: "2026-04-30T12:00:00.000Z"
  });

  assert.deepStrictEqual(controller.healthSnapshot(), {
    outbox: { pending: 7, failed: 1 },
    capacity: {
      driftDetected: true,
      lastReconciliationAt: "2026-04-30T12:01:00.000Z"
    },
    waitlist: { promotedInLastRun: 2 },
    payments: {
      timedOut: 1,
      failed: 2,
      autoRecoveredCapacityCount: 3
    },
    registrations: {
      registrationCreatedTotal: 10,
      registrationWaitlistedTotal: 3,
      paymentIntentsCreatedTotal: 4,
      registrationPaidTotal: 6
    }
  });
});
