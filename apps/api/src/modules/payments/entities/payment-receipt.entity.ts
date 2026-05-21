import { Column, Entity, Index, JoinColumn, ManyToOne } from "typeorm";
import { BaseTenantEntity } from "../../../database/entities/base-tenant.entity";
import { PaymentEntity } from "./payment.entity";
import { UserEntity } from "../../identity/entities/user.entity";

export enum ReceiptStatus {
  PENDING = "Pending",
  APPROVED = "Approved",
  REJECTED = "Rejected"
}

@Entity("payment_receipts")
@Index("idx_payment_receipts_tenant_id", ["tenantId"])
@Index("idx_payment_receipts_payment_id", ["paymentId"])
@Index("idx_payment_receipts_status", ["status"])
export class PaymentReceiptEntity extends BaseTenantEntity {
  @Column({ type: "uuid", name: "payment_id" })
  paymentId!: string;

  @Column({ type: "varchar", name: "file_key", length: 1024 })
  fileKey!: string;

  @Column({
    type: "enum",
    enum: ReceiptStatus,
    enumName: "receipt_status_enum",
    name: "status",
    default: ReceiptStatus.PENDING
  })
  status!: ReceiptStatus;

  @Column({ type: "text", name: "note", nullable: true })
  note!: string | null;

  @Column({ type: "uuid", name: "reviewed_by_user_id", nullable: true })
  reviewedByUserId!: string | null;

  @Column({ type: "timestamptz", name: "reviewed_at", nullable: true })
  reviewedAt!: Date | null;

  @Column({ type: "text", name: "review_note", nullable: true })
  reviewNote!: string | null;

  @Column({ type: "uuid", name: "ledger_journal_id", nullable: true })
  ledgerJournalId!: string | null;

  @ManyToOne(() => PaymentEntity, { nullable: false })
  @JoinColumn({ name: "payment_id", referencedColumnName: "id" })
  payment!: PaymentEntity;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: "reviewed_by_user_id", referencedColumnName: "id" })
  reviewedBy!: UserEntity | null;
}
