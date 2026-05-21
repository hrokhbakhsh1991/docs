import { Column, Entity, Index, PrimaryColumn } from "typeorm";
import type { LedgerPostingSide } from "../ledger-journal-line";

@Entity("ledger_journal_lines")
@Index("idx_ledger_journal_lines_tenant_journal", ["tenantId", "journalId"])
@Index("idx_ledger_journal_lines_tenant_account_created", ["tenantId", "account", "createdAt"])
export class LedgerJournalLineEntity {
  @PrimaryColumn("uuid", { name: "id" })
  id!: string;

  @Column({ type: "uuid", name: "tenant_id" })
  tenantId!: string;

  @Column({ type: "uuid", name: "journal_id" })
  journalId!: string;

  @Column({ type: "varchar", length: 128, name: "account" })
  account!: string;

  @Column({
    type: "enum",
    enum: ["debit", "credit"],
    enumName: "ledger_posting_side_enum",
    name: "side"
  })
  side!: LedgerPostingSide;

  @Column({ type: "bigint", name: "amount_minor" })
  amountMinor!: string;

  @Column({ type: "varchar", length: 8, name: "currency" })
  currency!: string;

  @Column({ type: "varchar", length: 256, name: "idempotency_key" })
  idempotencyKey!: string;

  @Column({ type: "varchar", length: 256, name: "correlation_id" })
  correlationId!: string;

  @Column({ type: "uuid", name: "reverses_line_id", nullable: true })
  reversesLineId?: string | null;

  @Column({ type: "jsonb", name: "metadata", nullable: true })
  metadata?: Record<string, unknown> | null;

  @Column({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
