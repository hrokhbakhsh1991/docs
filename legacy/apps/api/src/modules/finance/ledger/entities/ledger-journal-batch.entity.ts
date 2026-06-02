import { CreateDateColumn, Entity, PrimaryColumn } from "typeorm";

@Entity("ledger_journal_batches")
export class LedgerJournalBatchEntity {
  @PrimaryColumn("uuid", { name: "tenant_id" })
  tenantId!: string;

  @PrimaryColumn("uuid", { name: "journal_id" })
  journalId!: string;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;
}
