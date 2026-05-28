import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import {
  REGISTRATION_ENTITY,
  type IRegistrationEntity
} from "@repo/domain-contracts";

/**
 * **Append-only** immutable price fact for a booking (`registrations.id` as `booking_id`).
 *
 * - **Immutable:** never UPDATE or soft-delete rows; treat persisted values as historical truth at `created_at`.
 * - **Corrections:** insert a **new** row (new `snapshot_id`) for the same `booking_id`; do not rewrite prior snapshots.
 *
 * Rows are created only from {@link createPricingSnapshot} after a complete persisted registration quote
 * (see `RegistrationsService.ensureBookingPriceSnapshotLockedAndEmit`).
 */
@Entity("booking_price_snapshots")
@Index("idx_booking_price_snapshots_tenant_id", ["tenantId"])
@Index("idx_booking_price_snapshots_booking_id", ["bookingId"])
@Index("idx_booking_price_snapshots_booking_created", ["bookingId", "createdAt"])
export class BookingPriceSnapshotEntity {
  @PrimaryGeneratedColumn("uuid", { name: "snapshot_id" })
  snapshotId!: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId!: string;

  @Column({ type: "uuid", name: "booking_id" })
  bookingId!: string;

  @ManyToOne(REGISTRATION_ENTITY, { onDelete: "NO ACTION", nullable: false })
  @JoinColumn({ name: "booking_id", referencedColumnName: "id" })
  booking!: IRegistrationEntity;

  /** Catalog / list reference in minor units (integer money). */
  @Column({ type: "bigint", name: "list_price_minor" })
  listPriceMinor!: string;

  @Column({ type: "varchar", length: 3, name: "currency" })
  currency!: string;

  /** Version / hash of the rule set used when totals were computed (engine-owned string). */
  @Column({ type: "varchar", length: 96, name: "pricing_rule_version" })
  pricingRuleVersion!: string;

  /** Final computed total in minor units at snapshot time. */
  @Column({ type: "bigint", name: "computed_total_minor" })
  computedTotalMinor!: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
