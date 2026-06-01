import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from "typeorm";

export enum PendingStorageDeletionStatus {
  PENDING = "pending",
  COMMITTED = "committed",
}

/**
 * Tracks MinIO object keys written during tour clone until the saga completes.
 * Rows in {@link PendingStorageDeletionStatus.PENDING} older than the cleanup TTL
 * are deleted by {@link PendingStorageDeletionCleanupService}.
 */
@Entity("pending_storage_deletions")
@Index("idx_pending_storage_deletions_status_created_at", ["status", "createdAt"])
@Index("idx_pending_storage_deletions_clone_operation_id", ["cloneOperationId"])
export class PendingStorageDeletionEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId!: string;

  @Column({ type: "varchar", name: "object_key", length: 1024 })
  objectKey!: string;

  @Column({ type: "uuid", name: "clone_operation_id" })
  cloneOperationId!: string;

  /** Set when clone persist succeeds; cleanup only touches rows where this is NULL. */
  @Column({ type: "uuid", name: "destination_tour_id", nullable: true, default: null })
  destinationTourId: string | null = null;

  @Column({
    type: "enum",
    enum: PendingStorageDeletionStatus,
    enumName: "pending_storage_deletion_status_enum",
    default: PendingStorageDeletionStatus.PENDING,
  })
  status!: PendingStorageDeletionStatus;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
