import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

import { TenantEntity } from "../../identity/entities/tenant.entity";

/** Tenant-owned PSP credentials (Stripe secret, Zibal merchant, webhook signing secret). */
@Entity({ name: "tenant_payment_configs" })
@Index("idx_tenant_payment_configs_tenant_id", ["tenantId"])
export class TenantPaymentConfigEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId!: string;

  @ManyToOne(() => TenantEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tenant_id" })
  tenant!: TenantEntity;

  /** Provider slug: `stripe`, `zibal`, … */
  @Column({ type: "varchar", name: "provider", length: 32 })
  provider!: string;

  @Column({ type: "varchar", name: "api_key", length: 512, nullable: true })
  apiKey?: string | null;

  @Column({ type: "varchar", name: "merchant_id", length: 128, nullable: true })
  merchantId?: string | null;

  @Column({ type: "varchar", name: "callback_url", length: 512, nullable: true })
  callbackUrl?: string | null;

  @Column({ type: "varchar", name: "webhook_signing_secret", length: 512, nullable: true })
  webhookSigningSecret?: string | null;

  @Column({ type: "boolean", name: "is_active", default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
