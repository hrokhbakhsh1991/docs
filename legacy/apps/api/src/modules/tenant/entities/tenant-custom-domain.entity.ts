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

/** Maps a white-label FQDN and credentialed browser Origin to a workspace tenant. */
@Entity({ name: "tenant_custom_domains" })
@Index("idx_tenant_custom_domains_tenant_id", ["tenantId"])
export class TenantCustomDomainEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId!: string;

  @ManyToOne(() => TenantEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "tenant_id" })
  tenant!: TenantEntity;

  /** Lowercase inbound Host / X-Forwarded-Host FQDN (e.g. bookings.customer.com). */
  @Column({ type: "varchar", name: "hostname", length: 253 })
  hostname!: string;

  /** Normalized credentialed browser Origin (e.g. https://bookings.customer.com). */
  @Column({ type: "varchar", name: "web_origin", length: 512 })
  webOrigin!: string;

  @Column({ type: "boolean", name: "is_active", default: true })
  isActive!: boolean;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
