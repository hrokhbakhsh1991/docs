import type { TourFormProfile } from "@repo/types";
import type { DenaliCanonicalTemplateData } from "@repo/types/denali";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";

export type WorkspaceTourWizardStepOverrides = {
  skip: string[];
  insert: string[];
};

@Entity({ name: "workspace_tour_wizard_templates" })
@Index("idx_workspace_tour_wizard_templates_workspace_id", ["workspaceId"], { unique: true })
export class WorkspaceTourWizardTemplateEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ name: "workspace_id", type: "uuid" })
  workspaceId!: string;

  @Column({ name: "base_profile", type: "varchar", length: 32, default: "general" })
  baseProfile!: TourFormProfile;

  /** @deprecated Denali uses {@link canonicalData} only; kept empty for schema compatibility. */
  @Column({ name: "step_overrides", type: "jsonb", default: () => `'{"skip":[],"insert":[]}'` })
  stepOverrides!: WorkspaceTourWizardStepOverrides;

  /** @deprecated Denali uses {@link canonicalData} only; kept empty for schema compatibility. */
  @Column({ name: "field_rules_overlay", type: "jsonb", default: () => `'{}'` })
  fieldRulesOverlay!: Record<string, unknown>;

  /**
   * Partial {@link DenaliCanonicalTourModel} workspace seed (JSONB).
   * Hydrated in the Denali wizard via the canonical template rule-engine path.
   */
  @Column({ name: "canonical_data", type: "jsonb", default: () => `'{}'` })
  canonicalData!: DenaliCanonicalTemplateData;

  @Column({ name: "preset_id", type: "uuid", nullable: true })
  presetId!: string | null;

  @Column({ name: "wizard_contract_version", type: "int", default: 1 })
  wizardContractVersion!: number;

  @Column({ name: "form_profile_version", type: "int", default: 1 })
  formProfileVersion!: number;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
