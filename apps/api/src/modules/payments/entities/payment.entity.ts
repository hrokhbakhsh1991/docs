import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseTenantEntity } from "../../../database/entities/base-tenant.entity";
import { RegistrationEntity } from "../../registrations/registration.entity";

export enum PaymentStatus {
  PENDING = "Pending",
  PAID = "Paid",
  FAILED = "Failed",
  REFUNDED = "Refunded",
  CANCELLED = "Cancelled"
}

export enum PaymentMethod {
  ONLINE = "Online",
  MANUAL = "Manual"
}

@Entity("payments")
@Index("idx_payments_tenant_id", ["tenantId"])
@Index("idx_payments_registration_id", ["registrationId"])
@Index("idx_payments_status", ["status"])
@Index("idx_payments_method", ["method"])
@Index("idx_payments_provider_payment_id", ["providerPaymentId"], {
  unique: true,
  where: `"provider_payment_id" IS NOT NULL`
})
@Index("uq_payments_registration_pending", ["registrationId"], {
  unique: true,
  where: `"status" = 'Pending'`
})
export class PaymentEntity extends BaseTenantEntity {
  @Column({ type: "uuid", name: "registration_id" })
  registrationId!: string;

  @Column({ type: "numeric", name: "amount" })
  amount!: string;

  @Column({ type: "varchar", name: "currency", length: 8 })
  currency!: string;

  @Column({
    type: "enum",
    enum: PaymentMethod,
    enumName: "payment_method_enum",
    name: "method",
    default: PaymentMethod.ONLINE
  })
  method!: PaymentMethod;

  @Column({ type: "varchar", name: "provider", length: 64 })
  provider!: string;

  @Column({ type: "varchar", name: "provider_payment_id", length: 128, nullable: true })
  providerPaymentId!: string | null;

  @Column({
    type: "enum",
    enum: PaymentStatus,
    enumName: "payment_status_enum",
    name: "status",
    default: PaymentStatus.PENDING
  })
  status!: PaymentStatus;

  @Column({ type: "timestamptz", name: "paid_at", nullable: true })
  paidAt!: Date | null;

  @Column({ type: "timestamptz", name: "failed_at", nullable: true })
  failedAt!: Date | null;

  @Column({ type: "timestamptz", name: "refunded_at", nullable: true })
  refundedAt!: Date | null;

  @ManyToOne(() => RegistrationEntity, { nullable: false })
  @JoinColumn({ name: "registration_id", referencedColumnName: "id" })
  registration!: RegistrationEntity;
}
