import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

@Entity({ name: "workspace_tour_wizard_drafts" })
@Index("idx_workspace_tour_wizard_drafts_workspace_user", ["workspaceId", "userId"], {
  unique: true,
})
export class WorkspaceTourWizardDraftEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ name: "workspace_id", type: "uuid" })
  workspaceId!: string;

  @Column({ name: "user_id", type: "uuid" })
  userId!: string;

  @Column({ type: "jsonb", default: () => `'{}'` })
  envelope!: Record<string, unknown>;

  @Column({ name: "wizard_contract_version", type: "int", default: 1 })
  wizardContractVersion!: number;

  @Column({ name: "row_version", type: "int", default: 1 })
  rowVersion!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
