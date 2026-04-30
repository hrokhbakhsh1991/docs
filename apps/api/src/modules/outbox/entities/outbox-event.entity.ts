import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn
} from "typeorm";

export enum OutboxEventStatus {
  PENDING = "PENDING",
  DELIVERED = "DELIVERED",
  FAILED = "FAILED"
}

@Entity("outbox_events")
@Index("idx_outbox_events_status_created_at", ["status", "createdAt"])
@Index("idx_outbox_events_aggregate", ["aggregateType", "aggregateId"])
export class OutboxEventEntity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

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

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @Column({ type: "timestamptz", name: "processed_at", nullable: true })
  processedAt!: Date | null;
}
