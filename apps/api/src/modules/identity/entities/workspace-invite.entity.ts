import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import { TenantEntity } from "./tenant.entity";
import { UserEntity } from "./user.entity";

export enum WorkspaceInviteStatus {
  PENDING = "PENDING",
  ACCEPTED = "ACCEPTED",
  EXPIRED = "EXPIRED"
}

@Entity({ name: "workspace_invites" })
@Index("idx_workspace_invites_tenant_id", ["tenantId"])
@Index("idx_workspace_invites_email", ["email"])
@Index("uq_workspace_invites_invite_token", ["inviteToken"], { unique: true })
export class WorkspaceInviteEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId!: string;

  @Column({ type: "varchar", name: "email", length: 320 })
  email!: string;

  @Column({ type: "varchar", name: "role", length: 64 })
  role!: string;

  @Column({ type: "uuid", name: "invited_by_user_id" })
  invitedByUserId!: string;

  @Column({ type: "varchar", name: "invite_token", length: 255 })
  inviteToken!: string;

  @Column({
    type: "enum",
    enum: WorkspaceInviteStatus,
    enumName: "workspace_invite_status_enum",
    name: "status",
    default: WorkspaceInviteStatus.PENDING
  })
  status!: WorkspaceInviteStatus;

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date;

  @Column({ type: "timestamptz", name: "invited_at", nullable: true })
  invitedAt?: Date | null;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @ManyToOne(() => TenantEntity, { nullable: false })
  @JoinColumn({ name: "tenant_id", referencedColumnName: "id" })
  tenant!: TenantEntity;

  @ManyToOne(() => UserEntity, { nullable: false })
  @JoinColumn({ name: "invited_by_user_id", referencedColumnName: "id" })
  invitedByUser!: UserEntity;
}
