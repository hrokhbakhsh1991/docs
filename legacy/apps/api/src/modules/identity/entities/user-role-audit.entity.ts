import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from "typeorm";

@Entity({ name: "user_role_audit" })
@Index("idx_user_role_audit_tenant_id", ["tenantId"])
@Index("idx_user_role_audit_actor_user_id", ["actorUserId"])
@Index("idx_user_role_audit_target_user_id", ["targetUserId"])
@Index("idx_user_role_audit_created_at", ["createdAt"])
export class UserRoleAuditEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId!: string;

  @Column({ type: "uuid", name: "actor_user_id" })
  actorUserId!: string;

  @Column({ type: "uuid", name: "target_user_id" })
  targetUserId!: string;

  @Column({ type: "varchar", name: "old_role", length: 64 })
  oldRole!: string;

  @Column({ type: "varchar", name: "new_role", length: 64 })
  newRole!: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
