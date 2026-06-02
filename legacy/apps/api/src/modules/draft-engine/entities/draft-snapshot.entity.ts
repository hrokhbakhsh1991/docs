import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
  VersionColumn,
} from "typeorm";

@Entity({ name: "draft_snapshots" })
@Unique("UQ_draft_snapshots_scope", ["workspaceId", "userId", "draftKey"])
@Index("idx_draft_snapshots_workspace_id", ["workspaceId"])
export class DraftSnapshotEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ name: "workspace_id", type: "uuid" })
  workspaceId!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ name: "draft_key", type: "varchar", length: 128 })
  draftKey!: string;

  @Column({ type: "jsonb", default: () => "'{}'::jsonb" })
  data!: Record<string, unknown>;

  @VersionColumn({ type: "int", default: 1 })
  version!: number;

  @Column({ name: "schema_version", type: "int", default: 1 })
  schemaVersion!: number;

  @Column({ name: "last_modified", type: "bigint", default: 0 })
  lastModified!: string;

  @Column({ name: "trace_id", type: "varchar", length: 128, nullable: true })
  traceId!: string | null;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
