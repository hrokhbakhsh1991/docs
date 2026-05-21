import type { TourFormProfile } from "@repo/types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

@Entity({ name: "workspace_tour_creation_presets" })
@Index("idx_workspace_tour_creation_presets_workspace_id", ["workspaceId"])
export class WorkspaceTourCreationPresetEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ name: "workspace_id", type: "uuid" })
  workspaceId!: string;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "sort_order", type: "int", default: 0 })
  sortOrder!: number;

  @Column({ name: "match_tour_type", type: "varchar", length: 64, nullable: true })
  matchTourType!: string | null;

  @Column({ name: "match_main_tour_theme_id", type: "uuid", nullable: true })
  matchMainTourThemeId!: string | null;

  @Column({ type: "varchar", length: 32, name: "form_profile", default: "classic" })
  formProfile!: TourFormProfile;

  /** Partial tour wizard defaults (JSON). */
  @Column({ type: "jsonb" })
  defaults!: Record<string, unknown>;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
