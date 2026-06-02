import { Column, Entity, Index, PrimaryColumn, UpdateDateColumn, VersionColumn } from "typeorm";

@Entity("account_balances")
@Index("idx_account_balances_tenant_account_currency", ["tenantId", "account", "currency"])
export class AccountBalanceEntity {
  @PrimaryColumn("uuid", { name: "tenant_id" })
  tenantId!: string;

  @PrimaryColumn({ type: "varchar", length: 128, name: "account" })
  account!: string;

  @PrimaryColumn("varchar", { length: 8, name: "currency" })
  currency!: string;

  @Column({ type: "bigint", name: "balance_minor", default: "0" })
  balanceMinor!: string;

  @VersionColumn({ name: "row_version", default: 0 })
  rowVersion!: number;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
