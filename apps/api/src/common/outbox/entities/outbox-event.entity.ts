import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn
} from "typeorm";

/** Persisted lifecycle for `outbox_events` rows (DB enum `outbox_event_status_enum`). */
export enum OutboxEventStatus {
  PENDING = "PENDING",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED"
}

/** @alias OutboxEventStatus — foundation naming for ports / docs. */
export type OutboxStatus = OutboxEventStatus;

/**
 * Transactional outbox row. **Inserts must use the same `EntityManager` as domain mutations**
 * so the event commits or rolls back atomically with business data.
 *
 * Field mapping (conceptual schema):
 * - `created_at` ≈ **occurred_at** (when the domain event was recorded)
 * - `processed_at` ≈ **published_at** (when relay marked delivered)
 * - `correlation_id` — distributed trace / request correlation
 *
 * **Consumers** (relay, downstream handlers) **must be idempotent** — redelivery is expected.
 */
@Entity("outbox_events")
@Index("idx_outbox_events_status_created_at", ["status", "createdAt"])
@Index("idx_outbox_events_aggregate", ["aggregateType", "aggregateId"])
@Index("idx_outbox_events_tenant_created_at", ["tenantId", "createdAt"])
export class OutboxEventEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId!: string;

  @Column({ type: "varchar", name: "aggregate_type", length: 64 })
  aggregateType!: string;

  @Column({ type: "uuid", name: "aggregate_id" })
  aggregateId!: string;

  @Column({ type: "varchar", name: "event_type", length: 128 })
  eventType!: string;

  @Column({ type: "jsonb" })
  payload!: Record<string, unknown>;

  @Column({
    type: "enum",
    enum: OutboxEventStatus,
    enumName: "outbox_event_status_enum",
    default: OutboxEventStatus.PENDING
  })
  status!: OutboxEventStatus;

  @Column({ type: "int", name: "retry_count", default: 0 })
  retryCount!: number;

  @Column({ type: "timestamptz", name: "next_retry_at", nullable: true })
  nextRetryAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @Column({ type: "timestamptz", name: "processed_at", nullable: true })
  processedAt!: Date | null;

  @Column({ type: "varchar", name: "correlation_id", length: 128, nullable: true })
  correlationId!: string | null;

  /**
   * Stable id from the domain envelope (e.g. `booking.created:{registrationId}`) for enqueue dedupe.
   * Partial unique index `(tenant_id, domain_event_id)` WHERE NOT NULL — duplicate insert is ignored.
   */
  @Column({ type: "varchar", name: "domain_event_id", length: 128, nullable: true })
  domainEventId!: string | null;
}
