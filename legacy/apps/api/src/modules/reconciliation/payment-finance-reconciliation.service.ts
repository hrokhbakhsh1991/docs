import { randomUUID } from "node:crypto";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, Repository } from "typeorm";
import type { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import { TenantUsageMeteringService } from "../../common/billing/tenant-usage-metering.service";
import { TenantRateLimitService } from "../../common/tenant-abuse/tenant-rate-limit.service";
import { enforceBackgroundTenantRuntimePolicies } from "../../common/tenant/tenant-runtime-policy";
import { ConfigService } from "../../config/config.service";
import { TenantDbContextService } from "../../database/tenant-db-context.service";
import {
  RECONCILIATION_REGISTRATION_READ_PORT,
  type ReconciliationRegistrationReadPort,
} from "../../common/ports/reconciliation-registration-read.port";
import { ReconciliationJobEntity } from "../finance/reconciliation/entities/reconciliation-job.entity";
import { loadPaymentReconciliationReportInputForTenant } from "../finance/reconciliation/repositories/payment-finance-reconciliation.loader.repository";
import {
  formatPaymentReconciliationReportJsonLines,
  generatePaymentReconciliationReport
} from "../finance/reconciliation/payment-reconciliation-report";
import { logPaymentReconciliationMismatch } from "../finance/reconciliation/payment-reconciliation-mismatch-log";
import {
  assertReconciliationJobTenantUpdate,
  RECONCILIATION_JOB_ALERT_HOOKS,
  type ReconciliationJobAlertHooks
} from "../finance/reconciliation/reconciliation-job-alert-hooks";
import { ReconciliationJobKind } from "../finance/reconciliation/reconciliation-job-kind";
import { ReconciliationStatus } from "../finance/reconciliation/reconciliation-status";
import { TenantEntity } from "../identity/entities/tenant.entity";
import { ReconciliationFindingsService } from "./reconciliation-findings.service";

export type PaymentFinanceReconciliationSnapshot = {
  lastRunAt: string | null;
  lastCriticalFindings: number;
};

function safeErrorMessage(error: unknown, max = 4000): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw.length > max ? `${raw.slice(0, max)}…` : raw;
}

function errorCode(error: unknown): string {
  if (error && typeof error === "object" && "name" in error && typeof (error as Error).name === "string") {
    return (error as Error).name;
  }
  return "UNKNOWN";
}

/**
 * Periodic job: compares **PSP capture path** (`payment.captured` outbox + `payments`),
 * **ledger** (`finance.ledger.double_entry_applied` outbox lines), and **booking price snapshots**
 * via {@link generatePaymentReconciliationReport}.
 *
 * Each tenant run is persisted in `reconciliation_jobs` with tenant-scoped updates and alerting hooks.
 */
@Injectable()
export class PaymentFinanceReconciliationService {
  private readonly logger = new Logger(PaymentFinanceReconciliationService.name);
  private lastRunAt: string | null = null;
  private lastCriticalFindings = 0;

  constructor(
    @InjectRepository(TenantEntity)
    private readonly tenantRepository: Repository<TenantEntity>,
    @Inject(TenantDbContextService) private readonly tenantDbContext: TenantDbContextService,
    @Inject(TenantUsageMeteringService)
    private readonly tenantUsageMeteringService: TenantUsageMeteringService,
    @Inject(TenantRateLimitService) private readonly tenantRateLimitService: TenantRateLimitService,
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(ReconciliationFindingsService)
    private readonly reconciliationFindings: ReconciliationFindingsService,
    @Inject(RECONCILIATION_REGISTRATION_READ_PORT)
    private readonly reconciliationRegistrationRead: ReconciliationRegistrationReadPort,
    @Inject(RECONCILIATION_JOB_ALERT_HOOKS)
    private readonly alertHooks: ReconciliationJobAlertHooks
  ) {}

  getSnapshot(): PaymentFinanceReconciliationSnapshot {
    return {
      lastRunAt: this.lastRunAt,
      lastCriticalFindings: this.lastCriticalFindings
    };
  }

  async runPaymentFinanceReconciliationCycle(options?: { cycleBatchId?: string }): Promise<void> {
    const lookbackDays = this.configService.getPaymentFinanceReconciliationLookbackDays();
    const tenants = await this.tenantRepository.find({
      select: { id: true },
      where: { deletedAt: IsNull() }
    });

    let maxCritical = 0;
    const cycleBatchId = (options?.cycleBatchId?.trim() || randomUUID()).trim();

    for (const { id: tenantId } of tenants) {
      const runtimeAllowed = await enforceBackgroundTenantRuntimePolicies(tenantId, {
        tryConsumeBackgroundJob: async (currentTenantId) =>
          this.tenantUsageMeteringService.tryConsumeBackgroundJob(currentTenantId),
        tryConsumeTenantJobRateLimit: async (currentTenantId) =>
          this.tenantRateLimitService.tryConsumeJobForTenant(currentTenantId)
      });
      if (!runtimeAllowed) {
        continue;
      }

      const envelopeTenant = tenantId.trim().toLowerCase();

      let jobId: string;
      try {
        jobId = await this.tenantDbContext.runInTenantScope(envelopeTenant, async (manager) => {
          const row = manager.create(ReconciliationJobEntity, {
            tenantId: envelopeTenant,
            jobKind: ReconciliationJobKind.PAYMENT_FINANCE,
            status: ReconciliationStatus.IN_PROGRESS,
            startedAt: new Date(),
            metadata: {
              lookbackDays,
              cycleBatchId
            },
            mismatchCount: 0,
            criticalCount: 0
          });
          const saved = await manager.save(ReconciliationJobEntity, row);
          return saved.id;
        });
      } catch (error: unknown) {
        this.logger.warn(
          `payment_finance_reconciliation job_create_failed tenant=${envelopeTenant} err=${String(error)}`
        );
        continue;
      }

      const startedAt = new Date().toISOString();
      await Promise.resolve(
        this.alertHooks.onJobStarted({
          tenant_id: envelopeTenant,
          job_id: jobId,
          job_kind: ReconciliationJobKind.PAYMENT_FINANCE,
          cycle_batch_id: cycleBatchId,
          at: startedAt
        })
      );

      try {
        const finish = await this.tenantDbContext.runInTenantScope(envelopeTenant, async (manager) => {
          const input = await loadPaymentReconciliationReportInputForTenant(
            manager,
            envelopeTenant,
            { lookbackDays },
            this.reconciliationRegistrationRead
          );
          const report = generatePaymentReconciliationReport({
            ...input,
            reportId: jobId
          });
          maxCritical = Math.max(maxCritical, report.summary.criticalCount);

          await this.reconciliationFindings.persistForJob(manager, envelopeTenant, jobId, report.findings);

          for (const f of report.findings) {
            if (f.triadMismatch) {
              logPaymentReconciliationMismatch(this.logger, f.triadMismatch, jobId);
            }
          }

          if (report.summary.findingCount === 0) {
            this.logger.debug(
              `payment_finance_reconciliation ok tenant=${envelopeTenant} bookings=${report.summary.bookingIdsExamined} job=${jobId}`
            );
          } else {
            const payload = formatPaymentReconciliationReportJsonLines(report);
            if (report.summary.criticalCount > 0) {
              this.logger.warn(payload);
            } else {
              this.logger.log(payload);
            }
          }

          const terminalStatus =
            report.summary.findingCount > 0
              ? ReconciliationStatus.COMPLETED_WITH_MISMATCHES
              : ReconciliationStatus.COMPLETED;

          const completedAt = new Date();
          const mergedMetadata: Record<string, unknown> = {
            lookbackDays,
            cycleBatchId,
            reportId: report.id,
            bookingIdsExamined: report.summary.bookingIdsExamined,
            findingCount: report.summary.findingCount,
            byKind: report.summary.byKind,
            triadMismatchLogLines: report.findings.filter((f) => f.triadMismatch).length
          };

          const update = await manager.update(
            ReconciliationJobEntity,
            { id: jobId, tenantId: envelopeTenant },
            {
              status: terminalStatus,
              completedAt,
              mismatchCount: report.summary.findingCount,
              criticalCount: report.summary.criticalCount,
              metadata: mergedMetadata
            } as QueryDeepPartialEntity<ReconciliationJobEntity>
          );
          try {
            assertReconciliationJobTenantUpdate(update, "finalize_payment_finance_job", envelopeTenant, jobId);
          } catch (scopeError: unknown) {
            await Promise.resolve(
              this.alertHooks.onScopeOrConcurrencyFailure({
                tenant_id: envelopeTenant,
                job_id: jobId,
                job_kind: ReconciliationJobKind.PAYMENT_FINANCE,
                cycle_batch_id: cycleBatchId,
                at: new Date().toISOString(),
                context: "finalize_payment_finance_job"
              })
            );
            throw scopeError;
          }

          return {
            terminalStatus,
            findingCount: report.summary.findingCount,
            criticalCount: report.summary.criticalCount,
            bookingIdsExamined: report.summary.bookingIdsExamined
          };
        });

        await Promise.resolve(
          this.alertHooks.onJobFinished({
            tenant_id: envelopeTenant,
            job_id: jobId,
            job_kind: ReconciliationJobKind.PAYMENT_FINANCE,
            cycle_batch_id: cycleBatchId,
            at: new Date().toISOString(),
            status: finish.terminalStatus,
            mismatch_count: finish.findingCount,
            critical_count: finish.criticalCount,
            finding_count: finish.findingCount,
            booking_ids_examined: finish.bookingIdsExamined
          })
        );
      } catch (error: unknown) {
        await this.finalizeFailedJob(envelopeTenant, jobId, cycleBatchId, error);
        this.logger.warn(
          `payment_finance_reconciliation tenant_failed tenant=${envelopeTenant} job=${jobId} err=${String(error)}`
        );
      }
    }

    this.lastRunAt = new Date().toISOString();
    this.lastCriticalFindings = maxCritical;
  }

  private async finalizeFailedJob(
    envelopeTenant: string,
    jobId: string,
    cycleBatchId: string,
    error: unknown
  ): Promise<void> {
    try {
      await this.tenantDbContext.runInTenantScope(envelopeTenant, async (manager) => {
        const update = await manager.update(
          ReconciliationJobEntity,
          { id: jobId, tenantId: envelopeTenant },
          {
            status: ReconciliationStatus.FAILED,
            completedAt: new Date(),
            errorMessage: safeErrorMessage(error),
            metadata: {
              cycleBatchId,
              failedAt: new Date().toISOString(),
              errorCode: errorCode(error)
            }
          } as QueryDeepPartialEntity<ReconciliationJobEntity>
        );
        if (update.affected !== 1) {
          await Promise.resolve(
            this.alertHooks.onScopeOrConcurrencyFailure({
              tenant_id: envelopeTenant,
              job_id: jobId,
              job_kind: ReconciliationJobKind.PAYMENT_FINANCE,
              cycle_batch_id: cycleBatchId,
              at: new Date().toISOString(),
              context: "mark_payment_finance_job_failed"
            })
          );
        }
      });
    } catch (persistError: unknown) {
      this.logger.warn(
        `payment_finance_reconciliation failed_job_persist_error tenant=${envelopeTenant} job=${jobId} err=${String(persistError)}`
      );
    }

    await Promise.resolve(
      this.alertHooks.onJobFailed({
        tenant_id: envelopeTenant,
        job_id: jobId,
        job_kind: ReconciliationJobKind.PAYMENT_FINANCE,
        cycle_batch_id: cycleBatchId,
        at: new Date().toISOString(),
        error_code: errorCode(error),
        error_message: safeErrorMessage(error, 2000)
      })
    );
  }
}
