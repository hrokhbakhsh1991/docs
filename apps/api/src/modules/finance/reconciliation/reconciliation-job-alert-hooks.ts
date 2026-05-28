import { Injectable, InternalServerErrorException, Logger } from "@nestjs/common";
import type { UpdateResult } from "typeorm";

import { normalizeFinanceTenantId } from "../ledger/ledger-tenant-scope";

export const RECONCILIATION_JOB_ALERT_HOOKS = Symbol("RECONCILIATION_JOB_ALERT_HOOKS");

export type ReconciliationJobAlertBase = {
  tenant_id: string;
  job_id: string;
  job_kind: string;
  cycle_batch_id?: string;
  at: string;
};

export type ReconciliationJobFinishedAlert = ReconciliationJobAlertBase & {
  status: string;
  mismatch_count: number;
  critical_count: number;
  finding_count: number;
  booking_ids_examined: number;
};

export type ReconciliationJobFailedAlert = ReconciliationJobAlertBase & {
  error_code: string;
  error_message: string;
};

export type ReconciliationJobScopeAlert = ReconciliationJobAlertBase & {
  context: string;
};

/**
 * Alerting / automation seam for reconciliation jobs (PagerDuty, Slack, metrics, etc.).
 * Default implementation emits structured JSON on Nest `Logger` for log-based alerts.
 */
export interface ReconciliationJobAlertHooks {
  onJobStarted(_payload: ReconciliationJobAlertBase): void | Promise<void>;
  onJobFinished(_payload: ReconciliationJobFinishedAlert): void | Promise<void>;
  onJobFailed(_payload: ReconciliationJobFailedAlert): void | Promise<void>;
  onScopeOrConcurrencyFailure(_payload: ReconciliationJobScopeAlert): void | Promise<void>;
}

@Injectable()
export class LoggingReconciliationJobAlertHooks implements ReconciliationJobAlertHooks {
  private readonly logger = new Logger(LoggingReconciliationJobAlertHooks.name);

  onJobStarted(payload: ReconciliationJobAlertBase): void {
    this.logger.log(JSON.stringify({ event: "RECONCILIATION_JOB_STARTED", ...payload }));
  }

  onJobFinished(payload: ReconciliationJobFinishedAlert): void {
    const line = JSON.stringify({ event: "RECONCILIATION_JOB_FINISHED", ...payload });
    if (payload.critical_count > 0) {
      this.logger.warn(line);
    } else {
      this.logger.log(line);
    }
  }

  onJobFailed(payload: ReconciliationJobFailedAlert): void {
    this.logger.warn(JSON.stringify({ event: "RECONCILIATION_JOB_FAILED", ...payload }));
  }

  onScopeOrConcurrencyFailure(payload: ReconciliationJobScopeAlert): void {
    this.logger.error(JSON.stringify({ event: "RECONCILIATION_JOB_SCOPE_FAILURE", ...payload }));
  }
}

/** Ensures `UPDATE … WHERE id AND tenant_id` touched exactly one row (tenant scope + existence). */
export function assertReconciliationJobTenantUpdate(
  result: UpdateResult,
  context: string,
  envelopeTenantId: string,
  jobId: string
): void {
  if (result.affected === 1) {
    return;
  }
  throw new InternalServerErrorException({
    error: {
      code: "RECONCILIATION_JOB_UPDATE_SCOPE",
      message: `${context}: expected 1 reconciliation_jobs row for tenant=${normalizeFinanceTenantId(envelopeTenantId)} job=${jobId}, affected=${String(result.affected)}`
    }
  });
}
