import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

import { ReconciliationJobEntity } from "./reconciliation-job.entity";
import { ReconciliationFindingStatus } from "../reconciliation-finding-status";

@Entity("reconciliation_findings")
@Index("idx_reconciliation_findings_tenant_status_created", ["tenantId", "status", "createdAt"])
@Index("idx_reconciliation_findings_tenant_booking", ["tenantId", "bookingId"])
export class ReconciliationFindingEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId!: string;

  @Column({ type: "uuid", name: "reconciliation_job_id" })
  reconciliationJobId!: string;

  @ManyToOne(() => ReconciliationJobEntity, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "reconciliation_job_id" })
  reconciliationJob!: ReconciliationJobEntity;

  /** Stable id from {@link PaymentReconciliationFinding.id} within the parent job report. */
  @Column({ type: "uuid", name: "finding_uuid" })
  findingUuid!: string;

  @Column({ type: "uuid", name: "booking_id" })
  bookingId!: string;

  @Column({ type: "varchar", length: 96, name: "kind" })
  kind!: string;

  @Column({ type: "varchar", length: 16, name: "severity" })
  severity!: string;

  @Column({ type: "text", name: "message" })
  message!: string;

  @Column({ type: "jsonb", name: "data" })
  data!: Record<string, unknown>;

  @Column({ type: "jsonb", name: "triad_mismatch", nullable: true })
  triadMismatch?: Record<string, unknown> | null;

  @Column({
    type: "enum",
    enum: ReconciliationFindingStatus,
    enumName: "reconciliation_finding_status_enum",
    name: "status",
    default: ReconciliationFindingStatus.OPEN
  })
  status!: ReconciliationFindingStatus;

  @Column({ type: "text", name: "resolution_note", nullable: true })
  resolutionNote?: string | null;

  @Column({ type: "uuid", name: "resolved_by_user_id", nullable: true })
  resolvedByUserId?: string | null;

  @Column({ type: "timestamptz", name: "resolved_at", nullable: true })
  resolvedAt?: Date | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
