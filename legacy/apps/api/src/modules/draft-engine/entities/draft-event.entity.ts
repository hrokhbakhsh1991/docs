import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "draft_events" })
@Index("idx_draft_events_workspace_id", ["workspaceId"])
@Index("idx_draft_events_scope", ["workspaceId", "userId", "draftKey"])
@Index("idx_draft_events_created_at", ["createdAt"])
export class DraftEventEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ name: "workspace_id", type: "uuid" })
  workspaceId!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "draft_key", type: "varchar", length: 128 })
  draftKey!: string;

  @Column({ name: "event_type", type: "varchar", length: 64 })
  eventType!: "draft_saved" | "draft_deleted" | "draft_conflict";

  @Column({ name: "trace_id", type: "varchar", length: 128, nullable: true })
  traceId!: string | null;

  @Column({ name: "base_version", type: "int", nullable: true })
  baseVersion!: number | null;

  @Column({ name: "next_version", type: "int", nullable: true })
  nextVersion!: number | null;

  @Column({ name: "payload_snapshot", type: "jsonb", default: () => "'{}'::jsonb" })
  payloadSnapshot!: Record<string, unknown>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;
}
