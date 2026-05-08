import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique
} from "typeorm";
import { BaseTenantEntity } from "../../../database/entities/base-tenant.entity";
import { MembershipStatus } from "../membership-status.enum";
import { TenantEntity } from "./tenant.entity";
import { UserEntity } from "./user.entity";

@Entity({ name: "user_tenants" })
@Unique("uq_user_tenants_user_id_tenant_id", ["userId", "tenantId"])
@Index("idx_user_tenants_tenant_id", ["tenantId"])
@Index("idx_user_tenants_user_id", ["userId"])
@Index("uq_user_tenants_active_owner_per_workspace", ["tenantId"], {
  unique: true,
  where: `deleted_at IS NULL AND lower(role) = 'owner'`
})
export class UserTenantEntity extends BaseTenantEntity {
  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @Column({ type: "varchar", name: "role", length: 64 })
  role!: string;

  /** Workspace membership lifecycle state (invite/active/suspended). */
  @Column({
    type: "enum",
    enum: MembershipStatus,
    enumName: "user_membership_status_enum",
    name: "membership_status",
    default: MembershipStatus.INVITED
  })
  status!: MembershipStatus;

  /** Timestamp when workspace invitation was created for this membership. */
  @Column({ type: "timestamptz", name: "invited_at", nullable: true })
  invitedAt?: Date | null;

  /** Timestamp when invite was accepted / membership became active. */
  @Column({ type: "timestamptz", name: "joined_at", nullable: true })
  joinedAt?: Date | null;

  /** Timestamp when membership was suspended by an admin. */
  @Column({ type: "timestamptz", name: "suspended_at", nullable: true })
  suspendedAt?: Date | null;

  /** Bumped on role change, invite re-accept, etc.; embedded in JWT as `sess_ver` for revocation. */
  @Column({ type: "int", name: "session_version", default: 1 })
  sessionVersion!: number;

  @ManyToOne(() => UserEntity, (user) => user.memberships, { nullable: false })
  @JoinColumn({ name: "user_id", referencedColumnName: "id" })
  user!: UserEntity;

  @ManyToOne(() => TenantEntity, (tenant) => tenant.members, { nullable: false })
  @JoinColumn({ name: "tenant_id", referencedColumnName: "id" })
  tenant!: TenantEntity;
}
