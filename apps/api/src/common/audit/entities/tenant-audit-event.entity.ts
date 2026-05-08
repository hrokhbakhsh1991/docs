import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn
} from "typeorm";

@Entity({ name: "tenant_audit_events" })
@Index("idx_tenant_audit_events_tenant_occurred", ["tenantId", "occurredAt"])
@Index("idx_tenant_audit_events_tenant_action", ["tenantId", "action"])
export class TenantAuditEventEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId!: string;

  @CreateDateColumn({ type: "timestamptz", name: "occurred_at" })
  occurredAt!: Date;

  @Column({ type: "uuid", name: "actor_user_id", nullable: true })
  actorUserId!: string | null;

  /** Display identifier for the actor (e.g. email); complements actor_user_id. */
  @Column({ type: "varchar", name: "actor", length: 320 })
  actor!: string;

  /** Primary subject of the event (often equals actor on self-initiated actions). */
  @Column({ type: "uuid", name: "user_id", nullable: true })
  userId!: string | null;

  @Column({ type: "varchar", name: "action", length: 96 })
  action!: string;

  @Column({ type: "varchar", name: "resource_type", length: 96, default: "" })
  resourceType!: string;

  @Column({ type: "varchar", name: "resource_id", length: 128, nullable: true })
  resourceId!: string | null;

  @Column({ type: "jsonb", name: "metadata", nullable: true })
  metadata!: Record<string, unknown> | null;

  @Column({ type: "varchar", name: "client_ip", length: 128, default: "unknown" })
  clientIp!: string;

  @Column({ type: "varchar", name: "request_id", length: 128, nullable: true })
  requestId!: string | null;
}
