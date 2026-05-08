import { Column, Entity, Index, OneToOne } from "typeorm";
import { Exclude } from "class-transformer";
import { BaseTenantEntity } from "../../../database/entities/base-tenant.entity";
import { TourDetails } from "./tour-details.entity";

export enum TourLifecycleStatus {
  DRAFT = "DRAFT",
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  CANCELLED = "CANCELLED"
}

export enum TourType {
  CAMP = "camp",
  MOUNTAIN = "mountain",
  CITY = "city",
  DESERT = "desert",
  OTHER = "other"
}

export enum PrimaryTransportMode {
  BUS = "bus",
  TRAIN = "train",
  PLANE = "plane",
  PRIVATE_CAR = "private_car",
  MIXED = "mixed",
  NONE = "none"
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

  @Column({ type: "boolean", name: "auto_accept_registrations", nullable: true })
  autoAcceptRegistrations?: boolean;

  @Column({
    type: "enum",
    enum: TourType,
    enumName: "tour_type_enum",
    name: "tour_type",
    nullable: true
  })
  tourType?: TourType;

  @Column({
    type: "enum",
    enum: PrimaryTransportMode,
    enumName: "primary_transport_mode_enum",
    name: "primary_transport_mode",
    nullable: true
  })
  primaryTransportMode?: PrimaryTransportMode;

  @OneToOne(() => TourDetails, (details) => details.tour, { cascade: true, nullable: true })
  details?: TourDetails;
}
