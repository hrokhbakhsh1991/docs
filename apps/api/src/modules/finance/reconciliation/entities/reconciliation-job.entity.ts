import { Column, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

import { ReconciliationJobKind } from "../reconciliation-job-kind";
import { ReconciliationStatus } from "../reconciliation-status";

/**
 * Durable record for one tenant-scoped reconciliation run (PSP / ledger / bank ops).
 *
 * Rows are created **before** work runs so failures still leave an auditable row.
 */
@Entity("reconciliation_jobs")
@Index("idx_reconciliation_jobs_tenant_started", ["tenantId", "startedAt"])
@Index("idx_reconciliation_jobs_tenant_status", ["tenantId", "status"])
export class ReconciliationJobEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId!: string;

  @Column({
    type: "enum",
    enum: ReconciliationJobKind,
    enumName: "reconciliation_job_kind_enum",
    name: "job_kind"
  })
  jobKind!: ReconciliationJobKind;

  @Column({
    type: "enum",
    enum: ReconciliationStatus,
    enumName: "reconciliation_job_status_enum",
    name: "status"
  })
  status!: ReconciliationStatus;

  @Column({ type: "timestamptz", name: "started_at" })
  startedAt!: Date;

  @Column({ type: "timestamptz", name: "completed_at", nullable: true })
  completedAt?: Date | null;

  @Column({ type: "uuid", name: "booking_id", nullable: true })
  bookingId?: string | null;

  @Column({ type: "int", name: "mismatch_count", default: 0 })
  mismatchCount!: number;

  @Column({ type: "int", name: "critical_count", default: 0 })
  criticalCount!: number;

  /** Free-form JSON: lookback window, cycle correlation, report summary keys, etc. */
  @Column({ type: "jsonb", name: "metadata", nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ type: "text", name: "error_message", nullable: true })
  errorMessage?: string | null;
}
