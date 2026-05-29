import { Column, Entity, Index, JoinColumn, ManyToOne, VersionColumn } from "typeorm";
import { BaseTenantEntity } from "../../database/entities/base-tenant.entity";
import type { PricingLineItem } from "../pricing/pricing.types";
import { TourDepartureEntity } from "../tours/entities/tour-departure.entity";
import { TourEntity } from "../tours/entities/tour.entity";
import {
  BOOKING_PRICE_SNAPSHOT_ENTITY,
  type IBookingPriceSnapshotEntity
} from "@repo/domain-contracts";
import {
  RegistrationPaymentStatus,
  RegistrationStatus,
} from "./domain/registration-status";

export { RegistrationPaymentStatus, RegistrationStatus };

@Entity("registrations")
@Index("idx_registrations_tenant_id", ["tenantId"])
@Index("idx_registrations_tour_id", ["tourId"])
@Index("idx_registrations_tour_departure_id", ["tourDepartureId"])
@Index("idx_registrations_status", ["status"])
@Index("idx_registrations_payment_status", ["paymentStatus"])
export class RegistrationEntity extends BaseTenantEntity {
  /** Optimistic locking for registration / booking updates (see migration `1777594100000`). */
  @VersionColumn({ type: "int", name: "row_version", default: 1 })
  rowVersion!: number;

  @Column({ type: "uuid", name: "tour_id" })
  tourId!: string;

  /** Bookable inventory row (1:1 with legacy tour in foundation model). */
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

  @Column({ type: "varchar", name: "booking_target", length: 16, default: "self" })
  bookingTarget!: string;

  @Column({ type: "varchar", name: "participant_national_id", length: 10, nullable: true })
  participantNationalId?: string;

  @Column({ type: "varchar", name: "telegram_user_id", length: 255, nullable: true })
  telegramUserId?: string;

  @Column({ type: "varchar", name: "telegram_username", length: 255, nullable: true })
  telegramUsername?: string;

  @Column({ type: "int", name: "vehicle_seat_capacity", nullable: true })
  vehicleSeatCapacity?: number;

  @Column({ type: "text", name: "participant_note", nullable: true })
  participantNote?: string;

  /** Traveler intake metadata (e.g. `userPastPeaksCount` for Peak-Experience placement). */
  @Column({ type: "jsonb", name: "participant_metadata", nullable: true })
  participantMetadata?: Record<string, unknown>;

  @Column({
    type: "enum",
    enum: RegistrationStatus,
    enumName: "registration_status_enum",
    name: "status",
    default: RegistrationStatus.PENDING
  })
  status!: RegistrationStatus;

  @Column({
    type: "enum",
    enum: RegistrationPaymentStatus,
    enumName: "registration_payment_status_enum",
    name: "payment_status",
    default: RegistrationPaymentStatus.NOT_PAID
  })
  paymentStatus!: RegistrationPaymentStatus;

  @Column({ type: "numeric", name: "paid_amount", nullable: true })
  paidAmount?: string;

  @Column({ type: "jsonb", name: "payment_metadata", nullable: true })
  paymentMetadata?: Record<string, unknown>;

  /** List price minor units and currency captured from the tour at booking time (audit). */
  @Column({ type: "bigint", name: "quoted_list_price_minor", nullable: true })
  quotedListPriceMinor?: string | null;

  @Column({ type: "varchar", length: 3, name: "quoted_currency_code", nullable: true })
  quotedCurrencyCode?: string | null;

  /** Authoritative payable total in minor units at booking time (see `PricingEngineService`). */
  @Column({ type: "bigint", name: "quoted_total_minor", nullable: true })
  quotedTotalMinor?: string | null;

  @Column({ type: "varchar", length: 96, name: "quoted_pricing_version", nullable: true })
  quotedPricingVersion?: string | null;

  @Column({ type: "jsonb", name: "quoted_line_items_json", nullable: true })
  quotedLineItemsJson?: PricingLineItem[] | null;

  @ManyToOne(() => TourEntity, { nullable: false })
  @JoinColumn({ name: "tour_id", referencedColumnName: "id" })
  tour!: TourEntity;

  @ManyToOne(() => TourDepartureEntity, { nullable: false })
  @JoinColumn({ name: "tour_departure_id", referencedColumnName: "id" })
  tourDeparture!: TourDepartureEntity;

  /**
   * FK to the **canonical** booking price snapshot created during the checkout flow.
   * Nullable for backward-compatibility with registrations created before this column was introduced.
   * All new registrations created through the checkout/acceptance path MUST have this populated.
   * @see RegistrationsService — enforced via `assertPricingSnapshotRequiredForCheckout`.
   */
  @Column({ type: "uuid", name: "snapshot_id", nullable: true })
  snapshotId?: string | null;

  @ManyToOne(BOOKING_PRICE_SNAPSHOT_ENTITY, { nullable: true, eager: false })
  @JoinColumn({ name: "snapshot_id", referencedColumnName: "snapshotId" })
  priceSnapshot?: IBookingPriceSnapshotEntity | null;
}
