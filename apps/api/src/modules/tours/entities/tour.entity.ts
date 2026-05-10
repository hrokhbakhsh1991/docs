import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne } from "typeorm";
import { Exclude } from "class-transformer";
import { TOUR_TYPES, type TourType } from "@repo/types";
import { BaseTenantEntity } from "../../../database/entities/base-tenant.entity";
import { WorkspaceDestinationEntity } from "../../settings-locations/entities/workspace-destination.entity";
import { TourDetails } from "./tour-details.entity";
import type { TourTransportMode } from "../tour-transport-modes";

export { TOUR_TYPES, type TourType };

export enum TourLifecycleStatus {
  DRAFT = "DRAFT",
  OPEN = "OPEN",
  CLOSED = "CLOSED",
  CANCELLED = "CANCELLED"
}

/**
 * Top-level tour **category**. Distinct from `tripDetails.overview.tripStyles`,
 * which is a sub-genre describing the *execution style* (adventure, luxury, …).
 *
 * Canonical slugs live in `@repo/types` {@link TOUR_TYPES}.
 *
 * Legacy values (`camp`, `other`) were dropped in migration
 * `1777591000000-RefineTourTypeEnum`: `camp → nature`, `other → NULL`.
 */

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
    enum: [...TOUR_TYPES],
    enumName: "tour_type_enum",
    name: "tour_type",
    nullable: true
  })
  tourType?: TourType;

  /**
   * Organized transport offered for this tour (multi-select).
   * Empty array = not specified / none. No legacy `mixed` slug — combine modes instead.
   */
  @Column({
    type: "varchar",
    array: true,
    name: "transport_modes"
  })
  transportModes!: TourTransportMode[];

  @ManyToOne(() => WorkspaceDestinationEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "destination_id" })
  destination?: WorkspaceDestinationEntity | null;

  @OneToOne(() => TourDetails, (details) => details.tour, { cascade: true, nullable: true })
  details?: TourDetails;
}
