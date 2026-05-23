import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateIf
} from "class-validator";
import { UserTenantEntity } from "./user-tenant.entity";

/** Single DNS label: lowercase [a-z0-9], hyphens inside only; no dots or spaces. */
export const TENANT_SUBDOMAIN_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

@Entity({ name: "tenants" })
export class TenantEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ type: "varchar", name: "name", length: 255 })
  name!: string;

  /**
   * DNS label-style slug for workspace routing (e.g. acme → acme.app.example.com).
   * Nullable until backfilled; uniqueness enforced in DB for active rows via partial unique index on lower(subdomain).
   */
  @Column({ type: "varchar", name: "subdomain", length: 63, nullable: true })
  @ValidateIf((_, v: unknown) => v != null)
  @IsString()
  @IsNotEmpty()
  @MaxLength(63)
  @Matches(TENANT_SUBDOMAIN_REGEX, {
    message:
      "subdomain must be lowercase, contain no spaces or dots, and use only letters, digits, and inner hyphens (DNS label)"
  })
  subdomain!: string | null;

  @Column({ type: "text", name: "description", nullable: true })
  description?: string;

  /** Product modules enabled for this tenant (`finance`, `form_builder`, …). */
  @Column({ type: "jsonb", name: "enabled_modules", default: () => "'[]'::jsonb" })
  enabledModules!: string[];

  /** Primary ledger/display currency for member wallets and finance surfaces. */
  @Column({ type: "varchar", name: "operating_currency_code", length: 10, default: "IRR" })
  operatingCurrencyCode!: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;

  @DeleteDateColumn({ type: "timestamptz", name: "deleted_at", nullable: true })
  deletedAt?: Date;

  @OneToMany(() => UserTenantEntity, (membership) => membership.tenant)
  members!: UserTenantEntity[];
}
