import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseTenantEntity } from "../../../database/entities/base-tenant.entity";
import { UserEntity } from "../../identity/entities/user.entity";

@Entity("emergency_contacts")
@Index("idx_emergency_contacts_tenant_user", ["tenantId", "userId"])
export class EmergencyContactEntity extends BaseTenantEntity {
  /** Workspace member this ICE contact belongs to. */
  @Column({ type: "uuid", name: "user_id" })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: UserEntity;

  @Column({ type: "varchar", length: 255, name: "display_name" })
  displayName!: string;

  @Column({ type: "varchar", length: 32, name: "phone_e164" })
  phoneE164!: string;

  @Column({ type: "varchar", length: 64, name: "relationship" })
  relationship!: string;

  @Column({ type: "boolean", name: "is_primary", default: false })
  isPrimary!: boolean;

  @Column({ type: "int", name: "sort_order", default: 0 })
  sortOrder!: number;
}
