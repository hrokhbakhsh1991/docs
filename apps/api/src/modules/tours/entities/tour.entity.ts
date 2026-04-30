import { Column, Entity, Index } from "typeorm";
import { Exclude } from "class-transformer";
import { BaseTenantEntity } from "../../../database/entities/base-tenant.entity";

export enum TourLifecycleStatus {
  DRAFT = "DRAFT",
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  CANCELLED = "CANCELLED"
}

@Entity("tours")
@Index("idx_tours_tenant_id", ["tenantId"])
@Index("idx_tours_lifecycle_status", ["lifecycleStatus"])
export class TourEntity extends BaseTenantEntity {
  @Exclude()
  declare tenantId: string;

  @Exclude()
  declare deletedAt?: Date;

  @Column({ type: "varchar", length: 255, name: "title" })
  title!: string;

  @Column({ type: "text", name: "description", nullable: true })
  description?: string;

  @Column({ type: "int", name: "total_capacity", default: 0 })
  totalCapacity!: number;

  @Column({ type: "int", name: "accepted_count", default: 0 })
  acceptedCount!: number;

  @Column({
    type: "enum",
    enum: TourLifecycleStatus,
    enumName: "tour_lifecycle_status_enum",
    name: "lifecycle_status",
    default: TourLifecycleStatus.DRAFT
  })
  lifecycleStatus!: TourLifecycleStatus;

  @Column({ type: "varchar", length: 2048, name: "chat_link", nullable: true })
  chatLink?: string;

  @Column({ type: "jsonb", name: "cost_context", nullable: true })
  costContext?: Record<string, unknown>;
}
