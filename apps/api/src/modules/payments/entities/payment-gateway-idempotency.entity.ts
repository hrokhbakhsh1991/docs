import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn
} from "typeorm";

export type PaymentGatewayIdempotencyStatus = "pending" | "completed";

@Entity("payment_gateway_idempotency")
@Index("idx_payment_gateway_idempotency_expires", ["expiresAt"])
@Index("idx_payment_gateway_idempotency_tenant", ["tenantId"])
export class PaymentGatewayIdempotencyEntity {
  @PrimaryColumn({ type: "varchar", length: 64 })
  digest!: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId!: string;

  @Column({ type: "varchar", length: 191 })
  operation!: string;

  @Column({ type: "varchar", length: 255, name: "idempotency_key" })
  idempotencyKey!: string;

  @Column({ type: "varchar", length: 16 })
  status!: PaymentGatewayIdempotencyStatus;

  @Column({ type: "jsonb", name: "result_payload", nullable: true })
  resultPayload!: Record<string, unknown> | null;

  @Column({ type: "timestamptz", name: "expires_at" })
  expiresAt!: Date;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
