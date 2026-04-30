import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique
} from "typeorm";
import { BaseTenantEntity } from "../../../database/entities/base-tenant.entity";
import { TenantEntity } from "./tenant.entity";
import { UserEntity } from "./user.entity";

@Entity({ name: "user_tenants" })
@Unique("uq_user_tenants_user_id_tenant_id", ["userId", "tenantId"])
@Index("idx_user_tenants_tenant_id", ["tenantId"])
@Index("idx_user_tenants_user_id", ["userId"])
export class UserTenantEntity extends BaseTenantEntity {
  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @Column({ type: "varchar", name: "role", length: 64 })
  role!: string;

  @ManyToOne(() => UserEntity, (user) => user.memberships, { nullable: false })
  @JoinColumn({ name: "user_id", referencedColumnName: "id" })
  user!: UserEntity;

  @ManyToOne(() => TenantEntity, (tenant) => tenant.members, { nullable: false })
  @JoinColumn({ name: "tenant_id", referencedColumnName: "id" })
  tenant!: TenantEntity;
}
