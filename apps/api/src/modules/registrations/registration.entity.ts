import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseTenantEntity } from "../../database/entities/base-tenant.entity";
import { TourEntity } from "../tours/entities/tour.entity";

export enum RegistrationStatus {
  PENDING = "Pending",
  ACCEPTED = "Accepted",
  ACCEPTED_PAID = "AcceptedPaid",
  REJECTED = "Rejected",
  CANCELLED = "Cancelled",
  NO_SHOW = "NoShow",
  REFUNDED = "Refunded"
}

export enum RegistrationPaymentStatus {
  NOT_PAID = "NotPaid",
  PAID = "Paid",
  REFUNDED = "Refunded",
  FAILED = "Failed",
  // Legacy value retained for backward compatibility with existing clients/contracts.
  PARTIAL = "Partial"
}

@Entity("registrations")
@Index("idx_registrations_tenant_id", ["tenantId"])
@Index("idx_registrations_tour_id", ["tourId"])
@Index("idx_registrations_status", ["status"])
@Index("idx_registrations_payment_status", ["paymentStatus"])
export class RegistrationEntity extends BaseTenantEntity {
  @Column({ type: "uuid", name: "tour_id" })
  tourId!: string;

  @Column({ type: "varchar", name: "participant_full_name", length: 255 })
  participantFullName!: string;

  @Column({ type: "varchar", name: "participant_contact_phone", length: 64 })
  participantContactPhone!: string;

  @Column({ type: "varchar", name: "transport_mode", length: 32 })
  transportMode!: string;

  @Column({ type: "varchar", name: "entry_mode", length: 16 })
  entryMode!: string;

  @Column({ type: "varchar", name: "telegram_user_id", length: 255, nullable: true })
  telegramUserId?: string;

  @Column({ type: "varchar", name: "telegram_username", length: 255, nullable: true })
  telegramUsername?: string;

  @Column({ type: "int", name: "vehicle_seat_capacity", nullable: true })
  vehicleSeatCapacity?: number;

  @Column({ type: "text", name: "participant_note", nullable: true })
  participantNote?: string;

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

  @ManyToOne(() => TourEntity, { nullable: false })
  @JoinColumn({ name: "tour_id", referencedColumnName: "id" })
  tour!: TourEntity;
}
