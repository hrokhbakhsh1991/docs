import type { TourFormProfile } from "@repo/types";
import { Column, Entity, Index, JoinColumn, ManyToOne, OneToOne } from "typeorm";
import { Exclude } from "class-transformer";
import { TOUR_TYPES, type TourType } from "@repo/types";
import { BaseTenantEntity } from "../../../database/entities/base-tenant.entity";
import { UserEntity } from "../../identity/entities/user.entity";
import { WorkspaceDestinationEntity } from "../../settings-locations/entities/workspace-destination.entity";
import { TOUR_DETAILS_ENTITY, TourLifecycleStatus } from "@repo/domain-contracts";
import type { TourDetails } from "./tour-details.entity";
import type { TourTransportMode } from "../tour-transport-modes";

export { TOUR_TYPES, type TourType };
export { TourLifecycleStatus };

/**
 * Top-level tour **category**. Distinct from `tripDetails.overview.tripStyles`,
 * which is a sub-genre describing the *execution style* (adventure, luxury, …).
 *
 * Canonical slugs live in `@repo/types` {@link TOUR_TYPES}.
 *
 * Legacy values (`camp`, `other`) were dropped in migration
 * `1777591000000-RefineTourTypeEnum`: `camp → nature`, `other → NULL`.
 *
 * Longer-term product model may split immutable **product** definition from bookable **departure**
 * instances (pricing engine, GDPR, multi-locale). Current rows remain single-table with JSONB details.
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

  @OneToOne(TOUR_DETAILS_ENTITY, "tour", { cascade: true, nullable: true })
  details?: TourDetails;

  @Column({ type: "uuid", name: "tour_product_id", nullable: true })
  tourProductId?: string | null;

  @Column({ type: "uuid", name: "tour_departure_id", nullable: true })
  tourDepartureId?: string | null;

  @Column({ type: "uuid", name: "created_by_user_id", nullable: true })
  createdByUserId?: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: "SET NULL" })
  @JoinColumn({ name: "created_by_user_id" })
  createdBy?: UserEntity | null;

  @Column({ type: "varchar", length: 32, name: "form_profile_snapshot", nullable: true })
  formProfileSnapshot?: TourFormProfile | null;

  /** Denormalized from trip logistics for list/filter (see migrations). */
  @Column({ type: "date", name: "starts_on", nullable: true })
  startsOn?: string | null;

  @Column({ type: "date", name: "ends_on", nullable: true })
  endsOn?: string | null;

  @Column({ type: "varchar", length: 3, name: "currency_code", nullable: true })
  currencyCode?: string | null;

  @Column({ type: "bigint", name: "list_price_minor", nullable: true })
  listPriceMinor?: string | null;
}
