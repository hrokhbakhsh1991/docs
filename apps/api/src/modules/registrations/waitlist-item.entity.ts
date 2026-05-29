import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseTenantEntity } from "../../database/entities/base-tenant.entity";
import { TourDepartureEntity } from "../tours/entities/tour-departure.entity";
import { TourEntity } from "../tours/entities/tour.entity";
import { WaitlistItemStatus } from "./domain/waitlist-status";

export { WaitlistItemStatus };

@Entity("waitlist_items")
@Index("idx_waitlist_items_tenant_id", ["tenantId"])
@Index("idx_waitlist_items_tour_id", ["tourId"])
@Index("idx_waitlist_items_tour_departure_id", ["tourDepartureId"])
@Index("idx_waitlist_items_status", ["status"])
export class WaitlistItemEntity extends BaseTenantEntity {
  @Column({ type: "uuid", name: "tour_id" })
  tourId!: string;

  @Column({ type: "uuid", name: "tour_departure_id" })
  tourDepartureId!: string;

  @Column({ type: "varchar", name: "participant_full_name", length: 255 })
  participantFullName!: string;

  @Column({ type: "varchar", name: "participant_contact_phone", length: 64 })
  participantContactPhone!: string;

  @Column({ type: "varchar", name: "transport_mode", length: 32 })
  transportMode!: string;

  @Column({ type: "varchar", name: "entry_mode", length: 16 })
  entryMode!: string;

  @Column({
    type: "enum",
    enum: WaitlistItemStatus,
    enumName: "waitlist_item_status_enum",
    name: "status",
    default: WaitlistItemStatus.WAITING
  })
  status!: WaitlistItemStatus;

  @Column({ type: "varchar", name: "conversion_reason", length: 64, nullable: true })
  conversionReason?: string;

  @Column({ type: "varchar", name: "cancel_reason", length: 255, nullable: true })
  cancelReason?: string;

  @Column({
    type: "uuid",
    name: "promoted_registration_id",
    nullable: true
  })
  promotedRegistrationId?: string;

  @ManyToOne(() => TourEntity, { nullable: false })
  @JoinColumn({ name: "tour_id", referencedColumnName: "id" })
  tour!: TourEntity;

  @ManyToOne(() => TourDepartureEntity, { nullable: false })
  @JoinColumn({ name: "tour_departure_id", referencedColumnName: "id" })
  tourDeparture!: TourDepartureEntity;
}
