import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from "typeorm";
import { UserEntity } from "../../identity/entities/user.entity";
import { TenantEntity } from "../../identity/entities/tenant.entity";
import { TOUR_WIZARD_DRAFT_INITIAL_VERSION } from "../utils/assert-tour-wizard-draft-version";

@Entity("tour_wizard_drafts")
@Unique("UQ_tour_wizard_drafts_workspace_user", ["workspaceId", "userId"])
@Index("idx_tour_wizard_drafts_workspace_id", ["workspaceId"])
export class TourWizardDraftEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ type: "uuid", name: "workspace_id", nullable: false })
  workspaceId!: string;

  @ManyToOne(() => TenantEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "workspace_id" })
  workspace!: TenantEntity;

  @Column({ type: "uuid", name: "user_id", nullable: false })
  userId!: string;

  @ManyToOne(() => UserEntity, { onDelete: "CASCADE" })
  @JoinColumn({ name: "user_id" })
  user!: UserEntity;

  @Column({ type: "int", name: "current_step_index", default: 0 })
  currentStepIndex!: number;

  @Column({ type: "jsonb", name: "payload", default: () => "'{}'::jsonb" })
  payload!: Record<string, any>;

  @Column({ type: "int", name: "version", default: TOUR_WIZARD_DRAFT_INITIAL_VERSION })
  version!: number;

  @CreateDateColumn({ type: "timestamptz", name: "created_at" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updated_at" })
  updatedAt!: Date;
}
