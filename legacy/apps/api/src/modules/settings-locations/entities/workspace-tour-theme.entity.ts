import type { TourFormProfile } from "@repo/types";
import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

@Entity({ name: "workspace_tour_themes" })
@Index("idx_workspace_tour_themes_workspace_id", ["workspaceId"])
@Index("idx_workspace_tour_themes_workspace_slug", ["workspaceId", "slug"], { unique: true })
export class WorkspaceTourThemeEntity {
  @PrimaryGeneratedColumn("uuid", { name: "id" })
  id!: string;

  @Column({ name: "workspace_id", type: "uuid" })
  workspaceId!: string;

  @Column({ type: "varchar", length: 120 })
  name!: string;

  @Column({ type: "varchar", length: 120 })
  slug!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ name: "is_active", type: "boolean", default: true })
  isActive!: boolean;

  @Column({ name: "sort_order", type: "int", default: 0 })
  sortOrder!: number;

  /**
   * Drives tour creation wizard layout / validation profile.
   * @see packages/types `TOUR_FORM_PROFILE_VALUES`
   */
  @Column({ name: "form_profile", type: "varchar", length: 32, default: "general" })
  formProfile!: TourFormProfile;

  @CreateDateColumn({ name: "created_at", type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ name: "updated_at", type: "timestamptz" })
  updatedAt!: Date;
}
